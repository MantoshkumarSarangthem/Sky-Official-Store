import { Router } from "express";
import pool from "../lib/db";
import * as orderService from "../services/orderService";
import type { OrderStatus } from "../services/orderService";
import crypto from "crypto";

const router = Router();

const STAFF_SESSION_COOKIE = "sky_staff_sess";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function staffCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  };
}

async function requireStaffAuth(req: any, res: any, next: any): Promise<void> {
  const sessionId = req.cookies?.[STAFF_SESSION_COOKIE];
  if (!sessionId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.status, s.qr_image
       FROM staff_sessions ss
       JOIN recharge_staff s ON s.id = ss.staff_id
       WHERE ss.id = $1 AND ss.expires_at > NOW()`,
      [sessionId]
    );
    if (!rows[0]) { res.status(401).json({ error: "Session expired" }); return; }
    req.staffId = rows[0].id;
    req.staffMember = rows[0];
    req.staffSessionId = sessionId;
    next();
  } catch { res.status(500).json({ error: "DB error" }); }
}

router.post("/login", async (req: any, res: any): Promise<void> => {
  const { name, pin } = req.body;
  if (!name || !pin) { res.status(400).json({ error: "Name and PIN required" }); return; }
  try {
    const result = await pool.query(
      "SELECT id, name, status, qr_image, shift_hours FROM recharge_staff WHERE LOWER(name) = LOWER($1) AND staff_pin = $2",
      [String(name).trim(), String(pin).trim()]
    );
    const staff = result.rows[0];
    if (!staff) { res.status(401).json({ error: "Invalid name or PIN" }); return; }
    await pool.query("UPDATE recharge_staff SET last_active = NOW() WHERE id = $1", [staff.id]);

    const sessionId = crypto.randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO staff_sessions (id, staff_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '12 hours')",
      [sessionId, staff.id]
    );
    res.cookie(STAFF_SESSION_COOKIE, sessionId, staffCookieOptions());
    res.json({ staff: { id: staff.id, name: staff.name, status: staff.status, qr_image: staff.qr_image, shift_hours: staff.shift_hours } });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.post("/logout", requireStaffAuth, async (req: any, res: any) => {
  try {
    await pool.query("DELETE FROM staff_sessions WHERE id = $1", [req.staffSessionId]);
  } catch {}
  res.clearCookie(STAFF_SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

// Called after biometric credential creation — returns a device token stored in localStorage
router.post("/bio-device-register", requireStaffAuth, async (req: any, res: any) => {
  try {
    const deviceToken = "SBDT-" + crypto.randomBytes(24).toString("hex");
    await pool.query(
      "INSERT INTO staff_device_tokens (id, staff_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
      [deviceToken, req.staffId]
    );
    res.json({ deviceToken });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// Called during biometric login — verifies device token, creates a new session cookie
router.post("/bio-session", async (req: any, res: any): Promise<void> => {
  const { deviceToken } = req.body;
  if (!deviceToken) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT dt.staff_id, s.name, s.status, s.qr_image, s.shift_hours
       FROM staff_device_tokens dt
       JOIN recharge_staff s ON s.id = dt.staff_id
       WHERE dt.id = $1 AND dt.expires_at > NOW()`,
      [deviceToken]
    );
    if (!rows[0]) { res.status(401).json({ error: "Invalid device credential" }); return; }

    const sessionId = crypto.randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO staff_sessions (id, staff_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '12 hours')",
      [sessionId, rows[0].staff_id]
    );
    res.cookie(STAFF_SESSION_COOKIE, sessionId, staffCookieOptions());
    res.json({ staff: { id: rows[0].staff_id, name: rows[0].name, status: rows[0].status, qr_image: rows[0].qr_image, shift_hours: rows[0].shift_hours } });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/me", requireStaffAuth, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      "SELECT id, name, status, qr_image, shift_hours FROM recharge_staff WHERE id = $1",
      [req.staffId]
    );
    res.json(result.rows[0] ?? null);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/orders", requireStaffAuth, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.display_id, o.diamonds, o.price, o.mlbb_id, o.mlbb_ign, o.mlbb_server_id,
              o.status, o.note, o.created_at,
              p.name AS pack_name, p.currency_label, g.name AS game_name
       FROM orders o
       LEFT JOIN packages p ON o.package_id = p.id
       LEFT JOIN games g ON p.game_id = g.id
       WHERE o.assigned_staff_id = $1
       ORDER BY
         CASE WHEN o.status IN ('waiting_staff','processing') THEN 0 ELSE 1 END,
         o.created_at DESC
       LIMIT 50`,
      [req.staffId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/orders/:id/events", requireStaffAuth, async (req: any, res: any): Promise<void> => {
  const orderId = parseInt(req.params.id);
  try {
    const check = await pool.query(
      "SELECT id FROM orders WHERE id = $1 AND assigned_staff_id = $2",
      [orderId, req.staffId]
    );
    if (!check.rows[0]) { res.status(403).json({ error: "Not your order" }); return; }
    const events = await orderService.getOrderEvents(orderId);
    res.json(events);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/orders/:id/status", requireStaffAuth, async (req: any, res: any): Promise<void> => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;

  const staffAllowed: OrderStatus[] = ["processing", "completed", "waiting_staff"];
  if (!staffAllowed.includes(status as OrderStatus)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  try {
    const check = await pool.query(
      "SELECT id FROM orders WHERE id = $1 AND assigned_staff_id = $2",
      [orderId, req.staffId]
    );
    if (!check.rows[0]) { res.status(403).json({ error: "Not your order" }); return; }

    const result = await orderService.transitionOrder(
      orderId,
      status as OrderStatus,
      `staff:${req.staffId}`,
      `Staff action — ${status}`
    );

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Keep last_active updated
    await pool.query("UPDATE recharge_staff SET last_active = NOW() WHERE id = $1", [req.staffId]);

    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

export default router;
