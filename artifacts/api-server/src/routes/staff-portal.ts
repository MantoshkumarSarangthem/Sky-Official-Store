import { Router } from "express";
import pool from "../lib/db";

const router = Router();

function parseStaffAuth(authHeader: string | undefined): { id: number; pin: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = Buffer.from(authHeader.slice(7), "base64").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx < 1) return null;
    const id = parseInt(decoded.slice(0, colonIdx));
    const pin = decoded.slice(colonIdx + 1);
    if (!id || !pin) return null;
    return { id, pin };
  } catch { return null; }
}

async function requireStaffAuth(req: any, res: any, next: any): Promise<void> {
  const auth = parseStaffAuth(req.headers.authorization);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const result = await pool.query(
      "SELECT id, name, status, qr_image FROM recharge_staff WHERE id = $1 AND staff_pin = $2",
      [auth.id, auth.pin]
    );
    if (!result.rows[0]) { res.status(401).json({ error: "Invalid credentials" }); return; }
    req.staffId = auth.id;
    req.staffMember = result.rows[0];
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
    const token = Buffer.from(`${staff.id}:${String(pin).trim()}`).toString("base64");
    res.json({ token, staff: { id: staff.id, name: staff.name, status: staff.status, qr_image: staff.qr_image, shift_hours: staff.shift_hours } });
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
      `SELECT id, display_id, diamonds, price, mlbb_id, mlbb_ign, mlbb_server_id, status, note, created_at
       FROM orders
       WHERE assigned_staff_id = $1
       ORDER BY
         CASE WHEN status IN ('pending','processing') THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 50`,
      [req.staffId]
    );
    res.json(result.rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/orders/:id/status", requireStaffAuth, async (req: any, res: any): Promise<void> => {
  const orderId = parseInt(req.params.id);
  const { status } = req.body;
  const allowed = ["processing", "completed", "pending"];
  if (!allowed.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  try {
    const check = await pool.query(
      "SELECT id FROM orders WHERE id = $1 AND assigned_staff_id = $2",
      [orderId, req.staffId]
    );
    if (!check.rows[0]) { res.status(403).json({ error: "Not your order" }); return; }
    await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2",
      [status, orderId]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

export default router;
