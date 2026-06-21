import { Router } from "express";
import pool from "../lib/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/active", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.id, o.name, o.description, o.eligibility, o.max_claims, o.total_claims,
             op.package_id, op.offer_price
      FROM offers o
      JOIN offer_packages op ON op.offer_id = o.id
      WHERE o.is_active = true
        AND (o.max_claims IS NULL OR o.total_claims < o.max_claims)
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    console.error("[offers] GET /active failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

router.get("/my-claims", requireAuth, async (req: any, res) => {
  const userId = req.clerkUserId as string;
  try {
    const { rows } = await pool.query(
      "SELECT offer_id FROM claimed_offers WHERE user_id = $1",
      [userId]
    );
    res.json(rows.map((r: any) => r.offer_id));
  } catch (err: any) {
    console.error("[offers] GET /my-claims failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
