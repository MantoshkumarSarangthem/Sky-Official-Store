import { Router } from "express";
import pool from "../lib/db";
import { createClerkClient } from "@clerk/express";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    // Sum approved wallet top-ups + direct UPI orders (non-wallet) per user
    const { rows } = await pool.query(`
      SELECT
        sq.clerk_user_id,
        SUM(sq.amount)::numeric AS total_spent,
        MAX(up.username) AS username
      FROM (
        SELECT clerk_user_id, amount::numeric
        FROM wallet_transactions
        WHERE status = 'approved' AND type = 'credit' AND clerk_user_id IS NOT NULL

        UNION ALL

        SELECT clerk_user_id, price::numeric
        FROM orders
        WHERE clerk_user_id IS NOT NULL
          AND status NOT IN ('cancelled', 'refunded')
          AND (note IS NULL OR note NOT ILIKE '%wallet%')
      ) sq
      LEFT JOIN user_profiles up ON sq.clerk_user_id = up.clerk_user_id
      WHERE sq.clerk_user_id IS NOT NULL
      GROUP BY sq.clerk_user_id
      ORDER BY total_spent DESC
      LIMIT 20
    `);

    if (rows.length === 0) {
      res.json({ leaderboard: [] });
      return;
    }

    // Batch-fetch Clerk profile data (imageUrl, name) for all users
    let clerkMap: Record<string, { imageUrl: string; displayName: string }> = {};
    if (process.env.CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const userIds = rows.map((r: any) => r.clerk_user_id);
        const clerkUsers = await clerk.users.getUserList({ userId: userIds, limit: 20 });
        for (const u of clerkUsers.data) {
          const displayName =
            [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
            u.username ||
            "Anonymous";
          clerkMap[u.id] = { imageUrl: u.imageUrl, displayName };
        }
      } catch {
        // Clerk unavailable — continue without images
      }
    }

    const leaderboard = rows.map((r: any, i: number) => ({
      rank: i + 1,
      username: r.username || clerkMap[r.clerk_user_id]?.displayName || "Anonymous",
      imageUrl: clerkMap[r.clerk_user_id]?.imageUrl || null,
      totalSpent: parseFloat(r.total_spent) || 0,
    }));

    res.json({ leaderboard });
  } catch (err: any) {
    console.error("[leaderboard] error:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
