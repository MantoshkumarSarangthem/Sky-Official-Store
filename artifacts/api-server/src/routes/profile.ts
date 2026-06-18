import { Router } from "express";
import pool from "../lib/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/", requireAuth, async (req: any, res) => {
  const userId = req.clerkUserId as string;
  try {
    const [ordersRes, walletRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) AS total_orders,
           COALESCE(SUM(CASE WHEN status = 'completed' THEN diamonds ELSE 0 END), 0) AS total_diamonds,
           COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS total_spent
         FROM orders WHERE clerk_user_id = $1`,
        [userId]
      ),
      pool.query(
        "SELECT balance FROM wallets WHERE clerk_user_id = $1",
        [userId]
      ),
    ]);

    const stats = ordersRes.rows[0];
    res.json({
      total_orders: parseInt(stats.total_orders, 10),
      total_diamonds: parseInt(stats.total_diamonds, 10),
      total_spent: parseFloat(stats.total_spent),
      wallet_balance: parseFloat(walletRes.rows[0]?.balance ?? "0"),
    });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// GET /profile/username — fetch current user's username
router.get("/username", requireAuth, async (req: any, res) => {
  const userId = req.clerkUserId as string;
  try {
    const { rows } = await pool.query(
      "SELECT username FROM user_profiles WHERE clerk_user_id = $1",
      [userId]
    );
    res.json({ username: rows[0]?.username ?? null });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// GET /profile/username-check?username=xxx — check availability + suggestions
router.get("/username-check", async (req, res) => {
  const raw = String(req.query.username || "").trim().toLowerCase();
  const valid = /^[a-z0-9_]{3,20}$/.test(raw);
  if (!valid) {
    res.json({ available: false, suggestions: [] });
    return;
  }
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM user_profiles WHERE username = $1",
      [raw]
    );
    if (rows.length === 0) {
      res.json({ available: true, suggestions: [] });
      return;
    }
    // Generate up to 3 available suggestions
    const suggestions: string[] = [];
    for (let i = 1; suggestions.length < 3 && i <= 999; i++) {
      const candidate = `${raw}${i}`;
      if (candidate.length > 20) break;
      const { rows: r } = await pool.query(
        "SELECT 1 FROM user_profiles WHERE username = $1",
        [candidate]
      );
      if (r.length === 0) suggestions.push(candidate);
    }
    res.json({ available: false, suggestions });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// POST /profile/username — set or update username
router.post("/username", requireAuth, async (req: any, res) => {
  const userId = req.clerkUserId as string;
  const raw = String(req.body?.username || "").trim().toLowerCase();
  if (!raw || !/^[a-z0-9_]{3,20}$/.test(raw)) {
    res.status(400).json({ error: "Invalid username. Use 3–20 characters: letters, numbers, underscores only." });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO user_profiles (clerk_user_id, username)
       VALUES ($1, $2)
       ON CONFLICT (clerk_user_id) DO UPDATE SET username = EXCLUDED.username`,
      [userId, raw]
    );
    res.json({ ok: true, username: raw });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Username already taken." });
    } else {
      res.status(500).json({ error: "DB error" });
    }
  }
});

export default router;
