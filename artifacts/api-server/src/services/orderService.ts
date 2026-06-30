import type { PoolClient } from "pg";
import pool from "../lib/db";
import { assignAvailableStaff } from "./staffService";
import { getRechargeProvider } from "../providers/recharge";
import * as notif from "./notificationService";

export type OrderStatus =
  | "pending_payment"
  | "payment_confirmed"
  | "processing_auto"
  | "waiting_staff"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment:   ["payment_confirmed", "failed", "cancelled"],
  payment_confirmed: ["processing_auto", "waiting_staff", "failed"],
  processing_auto:   ["completed", "waiting_staff", "failed"],
  waiting_staff:     ["processing", "failed", "cancelled"],
  processing:        ["completed", "waiting_staff", "failed"],
  completed:         [],
  failed:            [],
  cancelled:         [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

export async function logOrderEvent(
  orderId: number,
  fromStatus: string,
  toStatus: string,
  actor: string,
  note?: string,
  client?: PoolClient
): Promise<void> {
  const db = client ?? pool;
  await db.query(
    `INSERT INTO order_events (order_id, from_status, to_status, actor, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, fromStatus, toStatus, actor, note ?? null]
  );
}

export async function transitionOrder(
  orderId: number,
  toStatus: OrderStatus,
  actor: string,
  note?: string,
  client?: PoolClient
): Promise<{ ok: boolean; error?: string; order?: any }> {
  const db = client ?? pool;

  const { rows } = await db.query(
    `SELECT id, status, display_id, clerk_user_id, diamonds, price, mlbb_id, mlbb_server_id, mlbb_ign, package_id
     FROM orders WHERE id = $1${client ? " FOR UPDATE" : ""}`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return { ok: false, error: "Order not found" };

  const fromStatus = order.status as OrderStatus;
  if (!canTransition(fromStatus, toStatus)) {
    return {
      ok: false,
      error: `Cannot transition from "${fromStatus}" to "${toStatus}"`,
    };
  }

  const extra = toStatus === "completed" ? ", completed_at = NOW()" : "";
  await db.query(
    `UPDATE orders SET status = $2${extra} WHERE id = $1`,
    [orderId, toStatus]
  );

  await logOrderEvent(orderId, fromStatus, toStatus, actor, note, client);

  return { ok: true, order };
}

export async function getNextDisplayId(client?: PoolClient): Promise<string> {
  const db = client ?? pool;
  const year = new Date().getFullYear();
  const key = `order_seq_${year}`;
  await db.query(
    `INSERT INTO settings (key, value) VALUES ($1, '0') ON CONFLICT (key) DO NOTHING`,
    [key]
  );
  const { rows } = await db.query(
    `UPDATE settings SET value = (value::int + 1)::text WHERE key = $1 RETURNING value`,
    [key]
  );
  const seq = parseInt(rows[0]?.value ?? "1");
  return `SKY-${year}-${seq.toString().padStart(6, "0")}`;
}

export async function getOrderEvents(orderId: number): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId]
  );
  return rows;
}

async function routeToStaff(order: any, reason: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const staffId = await assignAvailableStaff(client);
    if (staffId) {
      await client.query(
        `UPDATE orders SET assigned_staff_id = $1 WHERE id = $2`,
        [staffId, order.id]
      );
    }

    await transitionOrder(order.id, "waiting_staff", "system", reason, client);
    await client.query("COMMIT");

    notif.notifyStaffNewOrder(order.display_id, reason);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[orderService] routeToStaff failed:", err.message);
  } finally {
    client.release();
  }
}

export async function processAfterPayment(orderId: number): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, status, display_id, clerk_user_id, diamonds, price,
            mlbb_id, mlbb_server_id, mlbb_ign, package_id
     FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return;

  const rechargeProvider = getRechargeProvider();

  if (rechargeProvider.isAutomatic) {
    const { ok, error } = await transitionOrder(
      orderId,
      "processing_auto",
      "system:auto",
      `Attempting auto-recharge via ${rechargeProvider.name}`
    );
    if (!ok) {
      console.error("[orderService] Failed to enter processing_auto:", error);
      return;
    }

    try {
      const result = await rechargeProvider.processRecharge({
        orderId: order.id,
        displayId: order.display_id,
        gameUserId: order.mlbb_id,
        gameServerId: order.mlbb_server_id,
        diamonds: order.diamonds,
        packageId: order.package_id,
      });

      if (result.success) {
        await transitionOrder(
          orderId,
          "completed",
          "system:auto",
          `Auto-recharge OK via ${rechargeProvider.name} — txId: ${result.transactionId ?? "n/a"}`
        );
        if (order.clerk_user_id) {
          await notif.notifyAutoProcessSuccess(
            order.clerk_user_id,
            order.display_id,
            order.diamonds
          );
        }
      } else {
        await routeToStaff(
          order,
          `Auto-recharge failed (${result.error ?? "unknown"})`
        );
      }
    } catch (err: any) {
      console.error("[orderService] Auto-recharge threw:", err.message);
      await routeToStaff(order, `Auto-recharge error: ${err.message}`);
    }
  } else {
    await routeToStaff(order, "No automatic recharge provider configured");
  }
}

export async function confirmPayment(
  orderId: number,
  actor: string,
  upiRef?: string
): Promise<{ ok: boolean; error?: string }> {
  const { rows } = await pool.query(
    `SELECT id, status, display_id, clerk_user_id, price FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return { ok: false, error: "Order not found" };

  const alreadyPast: OrderStatus[] = [
    "payment_confirmed", "processing_auto", "waiting_staff", "processing", "completed",
  ];
  if (alreadyPast.includes(order.status as OrderStatus)) {
    return { ok: false, error: `Payment already confirmed (current status: ${order.status})` };
  }

  const { rows: existing } = await pool.query(
    `SELECT id FROM payment_attempts WHERE order_id = $1 AND status = 'confirmed'`,
    [orderId]
  );
  if (existing.length > 0) {
    return { ok: false, error: "Payment already confirmed (idempotency check)" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO payment_attempts (order_id, provider, status, ref_id, actor)
       VALUES ($1, 'manual', 'confirmed', $2, $3)
       ON CONFLICT (order_id) DO UPDATE
         SET status = 'confirmed', ref_id = $2, actor = $3, confirmed_at = NOW()`,
      [orderId, upiRef ?? null, actor]
    );

    const result = await transitionOrder(
      orderId,
      "payment_confirmed",
      actor,
      upiRef ? `UPI Ref: ${upiRef}` : "Manual confirmation",
      client
    );
    if (!result.ok) {
      await client.query("ROLLBACK");
      return result;
    }

    await client.query("COMMIT");

    if (order.clerk_user_id) {
      notif.notifyPaymentConfirmed(
        order.clerk_user_id,
        order.display_id,
        order.price
      ).catch(() => {});
    }

    processAfterPayment(orderId).catch((err: any) => {
      console.error("[orderService] processAfterPayment failed:", err.message);
    });

    return { ok: true };
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: err.message };
  } finally {
    client.release();
  }
}

export async function adminOverrideStatus(
  orderId: number,
  toStatus: string,
  actor: string,
  note?: string
): Promise<{ ok: boolean; error?: string; order?: any }> {
  const { rows } = await pool.query(
    `SELECT id, status, display_id, clerk_user_id, diamonds, price FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return { ok: false, error: "Order not found" };

  await pool.query(
    `UPDATE orders SET status = $2${toStatus === "completed" ? ", completed_at = NOW()" : ""}
     WHERE id = $1`,
    [orderId, toStatus]
  );
  await logOrderEvent(orderId, order.status, toStatus, actor, note ?? "Admin override");

  if (toStatus === "completed" && order.clerk_user_id) {
    notif.notifyOrderCompleted(order.clerk_user_id, order.display_id, order.diamonds).catch(() => {});
  }
  if (toStatus === "failed" && order.clerk_user_id) {
    notif.notifyOrderFailed(order.clerk_user_id, order.display_id, note).catch(() => {});
  }

  return { ok: true, order: { ...order, status: toStatus } };
}
