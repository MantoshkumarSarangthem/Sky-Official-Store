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

export default router;
