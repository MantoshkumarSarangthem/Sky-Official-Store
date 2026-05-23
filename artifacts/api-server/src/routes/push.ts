import { Router } from "express";
import webpush from "web-push";
import pool from "../lib/db";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers["authorization"] || "";
  const password = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:admin@skyofficial.app",
    vapidPublicKey,
    vapidPrivateKey
  );
}

router.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: vapidPublicKey || null });
});

router.post("/subscribe", requireAdmin, async (req, res): Promise<void> => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription object" });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3`,
      [endpoint, keys.p256dh, keys.auth]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/unsubscribe", requireAdmin, async (req, res): Promise<void> => {
  const { endpoint } = req.body;
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  try {
    await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

export async function sendPushToAll(payload: object) {
  if (!vapidPublicKey || !vapidPrivateKey) return;
  try {
    const { rows } = await pool.query("SELECT endpoint, p256dh, auth FROM push_subscriptions");
    for (const row of rows) {
      const sub = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(async (err: any) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
        }
      });
    }
  } catch {}
}

export default router;
