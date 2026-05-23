import { Router } from "express";
import pool from "../lib/db";
import { requireAuth } from "../middlewares/requireAuth";
import { sendPushToAll } from "./push";
import { sendOrderEmail, notifyAvailableStaff } from "../lib/email";

const router = Router();


async function getNextDisplayId(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `order_seq_${year}`;
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, '0') ON CONFLICT (key) DO NOTHING`,
    [key]
  );
  const { rows } = await pool.query(
    `UPDATE settings SET value = (value::int + 1)::text WHERE key = $1 RETURNING value`,
    [key]
  );
  const seq = parseInt(rows[0]?.value ?? "1");
  return `SKY-${year}-${seq.toString().padStart(6, "0")}`;
}

async function assignAvailableStaff(): Promise<number | null> {
  const { rows: staffList } = await pool.query(
    `SELECT id FROM recharge_staff WHERE status = 'available' ORDER BY sort_order ASC, id ASC`
  );
  if (staffList.length === 0) return null;

  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('staff_rr_idx', '0') ON CONFLICT (key) DO NOTHING`
  );
  const { rows: idxRows } = await pool.query(
    `SELECT value FROM settings WHERE key = 'staff_rr_idx'`
  );
  const currentIdx = parseInt(idxRows[0]?.value ?? "0");
  const assignedIdx = currentIdx % staffList.length;
  await pool.query(
    `UPDATE settings SET value = $1 WHERE key = 'staff_rr_idx'`,
    [(assignedIdx + 1).toString()]
  );
  return staffList[assignedIdx].id;
}

function fireNotifications(displayId: string, orderId: number, staffId: number | null, pkg: { diamonds: number; price: string }, mlbbId: string | null, remark: string | null, extra: { serverId: string | null; ign: string | null; isForFriend: boolean }) {
  const diamonds = Number(pkg.diamonds).toLocaleString("en-IN");
  const price = parseFloat(pkg.price).toFixed(0);

  console.log(`[notify] NOTIFICATION_TRIGGERED — order ${displayId} (db id: ${orderId})`);

  sendPushToAll({
    title: "💎 New Order!",
    body: `${displayId} · ${diamonds} diamonds · ₹${price}`,
    tag: "new-order",
    url: "/admin",
  });

  sendOrderEmail({ orderId, diamonds: pkg.diamonds, price: pkg.price, mlbbId, remark }).catch((err) => {
    console.error(`[notify] EMAIL_FAILED — owner email for order ${displayId}:`, err?.message);
  });

  notifyAvailableStaff(displayId, staffId, { diamonds: pkg.diamonds, price: pkg.price, mlbbId }, pool).catch((err) => {
    console.error(`[notify] EMAIL_FAILED — staff notifications for order ${displayId}:`, err?.message);
  });
}

router.get("/my", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE clerk_user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(rows);
  } catch (err: any) {
    console.error("[orders] GET /my failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/", requireAuth, async (req: any, res): Promise<void> => {
  console.log("[notify] ORDER_API_HIT — POST /api/orders");
  const clerkUserId = req.clerkUserId as string;
  const { packageId, refId, remark, mlbbUserId, mlbbServerId, mlbbIgn, isForFriend } = req.body;

  if (!packageId) {
    res.status(400).json({ ok: false, error: "packageId is required." });
    return;
  }

  try {
    const { rows: pkgs } = await pool.query(
      "SELECT id, diamonds, price FROM packages WHERE id = $1",
      [packageId]
    );
    if (pkgs.length === 0) {
      res.status(404).json({ ok: false, error: "Package not found." });
      return;
    }
    const pkg = pkgs[0];

    let mlbbId = mlbbUserId || null;
    let serverId = mlbbServerId || null;
    let ign = mlbbIgn || null;
    if (!mlbbId) {
      const { rows: accounts } = await pool.query(
        "SELECT mlbb_user_id, mlbb_server_id, mlbb_ign FROM mlbb_accounts WHERE clerk_user_id = $1",
        [clerkUserId]
      );
      if (accounts.length > 0) {
        mlbbId = accounts[0].mlbb_user_id;
        serverId = accounts[0].mlbb_server_id;
        ign = accounts[0].mlbb_ign;
      }
    }

    const noteBase = remark ? `Ref: ${remark}` : refId ? `Ref: ${refId}` : null;
    const friendNote = isForFriend ? " [For Friend]" : "";
    const note = noteBase ? noteBase + friendNote : friendNote || null;

    const displayId = await getNextDisplayId();
    const staffId = await assignAvailableStaff();

    const { rows: inserted } = await pool.query(
      `INSERT INTO orders (clerk_user_id, package_id, diamonds, price, mlbb_id, mlbb_server_id, mlbb_ign, is_for_friend, status, note, display_id, assigned_staff_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11)
       RETURNING id`,
      [clerkUserId, pkg.id, pkg.diamonds, pkg.price, mlbbId, serverId, ign, isForFriend || false, note, displayId, staffId]
    );

    const orderId = inserted[0].id;
    console.log(`[notify] ORDER_SAVED — id: ${orderId}, displayId: ${displayId}, staffId: ${staffId ?? "none"}`);

    res.json({ ok: true, id: orderId, displayId });

    fireNotifications(displayId, orderId, staffId, { diamonds: pkg.diamonds, price: pkg.price }, mlbbId, remark ?? null, { serverId, ign, isForFriend: isForFriend || false });

  } catch (err: any) {
    console.error("[orders] POST / failed:", err?.message, err?.stack);
    res.status(500).json({ ok: false, error: "DB error. Please try again." });
  }
});

router.post("/cart", requireAuth, async (req: any, res): Promise<void> => {
  console.log("[notify] ORDER_API_HIT — POST /api/orders/cart");
  const clerkUserId = req.clerkUserId as string;
  const { items, refId, remark, mlbbUserId, mlbbServerId, mlbbIgn, isForFriend } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ ok: false, error: "items array is required." });
    return;
  }

  try {
    let mlbbId = mlbbUserId || null;
    let serverId = mlbbServerId || null;
    let ign = mlbbIgn || null;
    if (!mlbbId) {
      const { rows: accounts } = await pool.query(
        "SELECT mlbb_user_id, mlbb_server_id, mlbb_ign FROM mlbb_accounts WHERE clerk_user_id = $1",
        [clerkUserId]
      );
      if (accounts.length > 0) {
        mlbbId = accounts[0].mlbb_user_id;
        serverId = accounts[0].mlbb_server_id;
        ign = accounts[0].mlbb_ign;
      }
    }

    const noteBase = remark ? `Ref: ${remark}` : refId ? `Ref: ${refId}` : null;
    const friendNote = isForFriend ? " [For Friend]" : "";
    const orderIds: number[] = [];
    const displayIds: string[] = [];
    const staffId = await assignAvailableStaff();

    for (const item of items) {
      const { packageId, quantity = 1 } = item;
      const { rows: pkgs } = await pool.query(
        "SELECT id, diamonds, price FROM packages WHERE id = $1", [packageId]
      );
      if (!pkgs[0]) continue;
      const pkg = pkgs[0];
      for (let q = 0; q < quantity; q++) {
        const note = noteBase ? noteBase + friendNote : friendNote || null;
        const displayId = await getNextDisplayId();
        const { rows: inserted } = await pool.query(
          `INSERT INTO orders (clerk_user_id, package_id, diamonds, price, mlbb_id, mlbb_server_id, mlbb_ign, is_for_friend, status, note, display_id, assigned_staff_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11) RETURNING id`,
          [clerkUserId, pkg.id, pkg.diamonds, pkg.price, mlbbId, serverId, ign, isForFriend || false, note, displayId, staffId]
        );
        orderIds.push(inserted[0].id);
        displayIds.push(displayId);
      }
    }

    console.log(`[notify] ORDER_SAVED — cart: ${orderIds.length} orders saved, displayIds: ${displayIds.join(", ")}`);

    res.json({ ok: true, ids: orderIds, displayIds });

    const totalDiamonds = items.reduce((s: number, i: any) => s + (i.diamonds || 0) * (i.quantity || 1), 0);
    const totalPrice = items.reduce((s: number, i: any) => s + parseFloat(i.price || "0") * (i.quantity || 1), 0);

    console.log(`[notify] NOTIFICATION_TRIGGERED — cart order, ${orderIds.length} items, ₹${totalPrice.toFixed(0)}`);

    sendPushToAll({ title: "🛒 Cart Order!", body: `${orderIds.length} items · ₹${totalPrice.toFixed(0)}`, tag: "new-order", url: "/admin" });

    const firstDisplayId = displayIds[0] ?? "CART";
    sendOrderEmail({
      orderId: orderIds[0] ?? 0,
      diamonds: totalDiamonds,
      price: totalPrice.toFixed(2),
      mlbbId,
      remark: remark ?? `${orderIds.length} cart items — ${displayIds.join(", ")}`,
    }).catch((err: any) => {
      console.error(`[notify] EMAIL_FAILED — owner cart email: ${err?.message}`);
    });

    notifyAvailableStaff(firstDisplayId, staffId, {
      diamonds: totalDiamonds,
      price: totalPrice.toFixed(2),
      mlbbId,
    }, pool).catch((err: any) => {
      console.error(`[notify] EMAIL_FAILED — staff cart email: ${err?.message}`);
    });

  } catch (err: any) {
    console.error("[orders] POST /cart failed:", err?.message, err?.stack);
    res.status(500).json({ ok: false, error: "DB error. Please try again." });
  }
});

router.post("/wallet-pay", requireAuth, async (req: any, res): Promise<void> => {
  console.log("[notify] ORDER_API_HIT — POST /api/orders/wallet-pay");
  const clerkUserId = req.clerkUserId as string;
  const { packageId, mlbbUserId, mlbbServerId, mlbbIgn, isForFriend } = req.body;

  if (!packageId) {
    res.status(400).json({ ok: false, error: "packageId is required." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: pkgs } = await client.query(
      "SELECT id, diamonds, price FROM packages WHERE id = $1",
      [packageId]
    );
    if (!pkgs[0]) {
      await client.query("ROLLBACK");
      res.status(404).json({ ok: false, error: "Package not found." });
      return;
    }
    const pkg = pkgs[0];
    const price = parseFloat(pkg.price);

    const { rows: wallets } = await client.query(
      "SELECT balance FROM wallets WHERE clerk_user_id = $1 FOR UPDATE",
      [clerkUserId]
    );
    const balance = parseFloat(wallets[0]?.balance ?? "0");

    if (balance < price) {
      await client.query("ROLLBACK");
      res.status(400).json({ ok: false, error: `Insufficient wallet balance. You have ₹${balance.toFixed(0)}, need ₹${price.toFixed(0)}.` });
      return;
    }

    await client.query(
      "UPDATE wallets SET balance = balance - $1 WHERE clerk_user_id = $2",
      [price, clerkUserId]
    );

    await client.query(
      `INSERT INTO wallet_transactions (clerk_user_id, amount, type, status, description)
       VALUES ($1, $2, 'debit', 'approved', 'Diamond purchase via wallet')`,
      [clerkUserId, price.toFixed(2)]
    );

    let mlbbId = mlbbUserId || null;
    let serverId = mlbbServerId || null;
    let ign = mlbbIgn || null;
    if (!mlbbId) {
      const { rows: accounts } = await client.query(
        "SELECT mlbb_user_id, mlbb_server_id, mlbb_ign FROM mlbb_accounts WHERE clerk_user_id = $1",
        [clerkUserId]
      );
      if (accounts[0]) { mlbbId = accounts[0].mlbb_user_id; serverId = accounts[0].mlbb_server_id; ign = accounts[0].mlbb_ign; }
    }

    const displayId = await getNextDisplayId();
    const staffId = await assignAvailableStaff();

    const { rows: inserted } = await client.query(
      `INSERT INTO orders (clerk_user_id, package_id, diamonds, price, mlbb_id, mlbb_server_id, mlbb_ign, is_for_friend, status, note, display_id, assigned_staff_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'Paid via wallet', $9, $10) RETURNING id`,
      [clerkUserId, pkg.id, pkg.diamonds, pkg.price, mlbbId, serverId, ign, isForFriend || false, displayId, staffId]
    );

    await client.query("COMMIT");

    const orderId = inserted[0].id;
    console.log(`[notify] WALLET_ORDER_SAVED — id: ${orderId}, displayId: ${displayId}`);
    res.json({ ok: true, id: orderId, displayId });

    fireNotifications(displayId, orderId, staffId, { diamonds: pkg.diamonds, price: pkg.price }, mlbbId, "Wallet payment", { serverId, ign, isForFriend: isForFriend || false });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[orders] wallet-pay failed:", err?.message, err?.stack);
    res.status(500).json({ ok: false, error: "DB error. Please try again." });
  } finally {
    client.release();
  }
});

export default router;
