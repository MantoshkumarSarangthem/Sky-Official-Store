import { Router } from "express";
import pool from "../lib/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/mlbb", requireAuth, async (req: any, res) => {
  const userId = req.clerkUserId as string;
  try {
    const { rows } = await pool.query(
      "SELECT mlbb_user_id, mlbb_server_id, mlbb_ign, verified_at FROM mlbb_accounts WHERE clerk_user_id = $1",
      [userId]
    );
    if (rows.length === 0) return res.json({ ok: true, account: null });
    return res.json({ ok: true, account: rows[0] });
  } catch {
    return res.status(500).json({ ok: false, error: "DB error" });
  }
});

router.post("/mlbb", requireAuth, async (req: any, res) => {
  const clerkUserId = req.clerkUserId as string;
  const { userId, serverId, ign } = req.body;

  if (!userId || !serverId || !ign) {
    return res.status(400).json({ ok: false, error: "User ID, Server ID, and IGN are required." });
  }

  const uid = String(userId).trim();
  const sid = String(serverId).trim();
  const ignStr = String(ign).trim();

  if (!/^\d+$/.test(uid) || !/^\d+$/.test(sid)) {
    return res.status(400).json({ ok: false, error: "User ID and Server ID must be numbers only." });
  }

  if (ignStr.length < 1 || ignStr.length > 64) {
    return res.status(400).json({ ok: false, error: "IGN must be between 1 and 64 characters." });
  }

  try {
    await pool.query(
      `INSERT INTO mlbb_accounts (clerk_user_id, mlbb_user_id, mlbb_server_id, mlbb_ign, verified_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (clerk_user_id) DO UPDATE
         SET mlbb_user_id = EXCLUDED.mlbb_user_id,
             mlbb_server_id = EXCLUDED.mlbb_server_id,
             mlbb_ign = EXCLUDED.mlbb_ign,
             verified_at = NOW()`,
      [clerkUserId, uid, sid, ignStr]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "DB error. Please try again." });
  }
});

export default router;
