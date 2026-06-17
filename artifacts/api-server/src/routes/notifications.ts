import { Router } from "express";
import pool from "../lib/db";
import { requireAuth } from "../middlewares/requireAuth";
import { insertNotification } from "../lib/notifications";

const router = Router();

router.get("/", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_notifications
       WHERE clerk_user_id = $1 OR clerk_user_id IS NULL
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.get("/unread-count", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM user_notifications
       WHERE (clerk_user_id = $1 OR clerk_user_id IS NULL) AND read = FALSE`,
      [userId]
    );
    res.json({ count: rows[0]?.count ?? 0 });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.patch("/:id/read", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE user_notifications SET read = TRUE
       WHERE id = $1 AND (clerk_user_id = $2 OR clerk_user_id IS NULL)`,
      [id, userId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/read-all", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  try {
    await pool.query(
      `UPDATE user_notifications SET read = TRUE
       WHERE (clerk_user_id = $1 OR clerk_user_id IS NULL) AND read = FALSE`,
      [userId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/broadcast", async (req: any, res): Promise<void> => {
  const auth = req.headers["authorization"] || "";
  const password = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { type, title, body } = req.body;
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }
  await insertNotification(null, type || "news", title.trim(), body.trim());
  res.json({ ok: true });
});

export default router;
