import { Router } from "express";
import pool from "../lib/db";
import { requireAuth } from "../middlewares/requireAuth";
import { insertNotification } from "../lib/notifications";

const ADMIN_SESSION_COOKIE = "sky_admin_sess";

async function requireAdminSession(req: any, res: any, next: any): Promise<void> {
  const sessionId = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (!sessionId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { rows } = await pool.query(
      "SELECT role FROM admin_sessions WHERE id = $1 AND expires_at > NOW()",
      [sessionId]
    );
    if (!rows[0]) { res.status(401).json({ error: "Session expired" }); return; }
    next();
  } catch { res.status(500).json({ error: "DB error" }); }
}

const router = Router();

router.get("/", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  try {
    // clerk_user_id is internal — omit from user-facing response
    const { rows } = await pool.query(
      `SELECT id, type, title, body, read, created_at FROM user_notifications
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

router.post("/broadcast", requireAdminSession, async (req: any, res): Promise<void> => {
  const { type, title, body } = req.body;
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }
  await insertNotification(null, type || "news", title.trim(), body.trim());
  res.json({ ok: true });
});

export default router;
