import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import ordersRouter from "./orders";
import walletRouter from "./wallet";
import profileRouter from "./profile";
import verifyRouter from "./verify";
import pushRouter from "./push";
import notificationsRouter from "./notifications";
import leaderboardRouter from "./leaderboard";
import offersRouter from "./offers";
import pool from "../lib/db";
import { sendInquiryEmail } from "../lib/email";
import { createClerkClient } from "@clerk/express";

const router: IRouter = Router();

router.use((req, res, next) => {
  if (req.method !== "GET") return next();
  const p = req.path;
  if (
    p.startsWith("/wallet") || p.startsWith("/orders") ||
    p.startsWith("/notifications") || p.startsWith("/profile") ||
    p.startsWith("/verify") || p.startsWith("/push")
  ) {
    res.set("Cache-Control", "no-store");
  } else if (p === "/packages") {
    res.set("Cache-Control", "no-store");
  } else if (p.startsWith("/games")) {
    if (req.query.v) {
      res.set("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.set("Cache-Control", "no-store");
    }
  } else if (p.startsWith("/settings/category")) {
    res.set("Cache-Control", "public, max-age=86400");
  } else if (p === "/settings/promo_banners") {
    res.set("Cache-Control", "public, max-age=600");
  } else if (
    p === "/settings/pack_images" || p === "/settings/pass_images" ||
    p === "/settings/starlight_images" || p.startsWith("/games")
  ) {
    res.set("Cache-Control", "public, max-age=3600");
  } else {
    res.set("Cache-Control", "public, max-age=300");
  }
  next();
});

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/orders", ordersRouter);
router.use("/wallet", walletRouter);
router.use("/profile", profileRouter);
router.use("/verify", verifyRouter);
router.use("/push", pushRouter);
router.use("/notifications", notificationsRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/offers", offersRouter);

router.get("/settings/category_popular", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='category_popular'");
    res.json(JSON.parse(rows[0]?.value || "{}"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/category_availability", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='category_availability'");
    res.json(JSON.parse(rows[0]?.value || "{}"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/qr", async (_req, res) => {
  try {
    // Build combined pool: available staff + admin if admin_status = 'available'
    const { rows: staffList } = await pool.query(
      `SELECT id, qr_image, whatsapp, upi_id FROM recharge_staff WHERE status = 'available' ORDER BY sort_order ASC, id ASC`
    );

    const { rows: adminRows } = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('admin_status', 'qr_code', 'admin_upi_id')`
    );
    const adminSettings: Record<string, string> = {};
    adminRows.forEach((r: any) => { adminSettings[r.key] = r.value; });

    type PoolEntry = { qr_image: string | null; upi_id: string | null; whatsapp: string | null };
    const entries: PoolEntry[] = [...staffList];
    if (adminSettings["admin_status"] === "available" && adminSettings["qr_code"]) {
      entries.push({ qr_image: adminSettings["qr_code"], upi_id: adminSettings["admin_upi_id"] || null, whatsapp: null });
    }

    if (entries.length > 0) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ('staff_rr_idx', '0') ON CONFLICT (key) DO NOTHING`
      );
      const { rows: idxRows } = await pool.query(
        `SELECT value FROM settings WHERE key = 'staff_rr_idx'`
      );
      const currentIdx = parseInt(idxRows[0]?.value ?? "0");
      const peekIdx = currentIdx % entries.length;
      const next = entries[peekIdx];

      if (next?.qr_image) {
        res.json({ qr: next.qr_image, upi_id: next.upi_id || null, whatsapp: next.whatsapp || null });
        return;
      }
    }

    // Final fallback: admin QR + UPI regardless of availability
    res.json({ qr: adminSettings["qr_code"] || null, upi_id: adminSettings["admin_upi_id"] || null, whatsapp: null });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/staff-contact", async (_req, res) => {
  try {
    const { rows: staffList } = await pool.query(
      `SELECT whatsapp, upi_id FROM recharge_staff WHERE status = 'available' ORDER BY sort_order ASC, id ASC LIMIT 1`
    );
    res.json({ whatsapp: staffList[0]?.whatsapp || null, upi_id: staffList[0]?.upi_id || null });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/trustpilot", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('trustpilot_url','trustpilot_enabled')");
    const m: Record<string, string> = {};
    rows.forEach((r: any) => { m[r.key] = r.value; });
    res.json({ url: m["trustpilot_url"] || "", enabled: m["trustpilot_enabled"] === "true" });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/community_links", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('community_whatsapp','community_instagram','community_support_wa')");
    const m: Record<string, string> = {};
    rows.forEach((r: any) => { m[r.key] = r.value; });
    res.json({ whatsapp: m["community_whatsapp"] || "", instagram: m["community_instagram"] || "", support_wa: m["community_support_wa"] || "" });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/offer_banners", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='offer_banners'");
    res.json(JSON.parse(rows[0]?.value || "[]"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/daily_offer_packages", async (_req, res) => {
  try {
    const { rows: settRows } = await pool.query("SELECT value FROM settings WHERE key='daily_offer_packages'");
    const ids: number[] = JSON.parse(settRows[0]?.value || "[]");
    if (ids.length === 0) return res.json([]);
    const { rows } = await pool.query(
      `SELECT
         p.id, p.name, p.diamonds, p.bonus_diamonds, p.category, p.label,
         p.status, p.image, p.is_popular, p.sort_order, p.currency_label, p.game_id,
         g.name AS game_name,
         CASE WHEN oa.offer_price IS NOT NULL THEN oa.offer_price::text ELSE p.price::text END AS price,
         CASE WHEN oa.offer_price IS NOT NULL THEN COALESCE(p.old_price::text, p.price::text) ELSE p.old_price::text END AS old_price,
         (oa.offer_price IS NOT NULL) AS has_offer
       FROM packages p
       LEFT JOIN games g ON g.id = p.game_id
       LEFT JOIN (
         SELECT DISTINCT ON (op.package_id) op.package_id, op.offer_price
         FROM offer_packages op
         JOIN offers o ON o.id = op.offer_id
         WHERE o.is_active = true
           AND (o.max_claims IS NULL OR o.total_claims < o.max_claims)
         ORDER BY op.package_id, o.created_at DESC
       ) oa ON oa.package_id = p.id
       WHERE p.id = ANY($1::int[])
       ORDER BY array_position($1::int[], p.id)`,
      [ids]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/pack_images", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='pack_images'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : null);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/pass_images", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='pass_images'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : null);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/starlight_images", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='starlight_images'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : {});
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/category_availability", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='category_availability'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : {});
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/latest_event", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='latest_event'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : { enabled: false, image: "", targetCategory: "" });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/maintenance", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('maintenance_enabled','maintenance_end_time','maintenance_message')");
    const m: Record<string, string> = {};
    rows.forEach((r: any) => { m[r.key] = r.value; });
    res.json({
      enabled: m["maintenance_enabled"] === "true",
      end_time: m["maintenance_end_time"] || null,
      message: m["maintenance_message"] || "We'll be back soon.",
    });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/packages", async (req, res) => {
  try {
    const gameId = req.query.game_id ? parseInt(req.query.game_id as string, 10) : null;
    // updated_at and sort_order are internal — omit from public response
    let query = `SELECT p.id, p.name, p.diamonds, p.bonus_diamonds, p.price, p.old_price,
                        p.label, p.is_popular, p.category, p.status, p.game_id,
                        p.image, p.currency_label, g.name AS game_name
                 FROM packages p LEFT JOIN games g ON g.id = p.game_id`;
    const params: unknown[] = [];
    if (gameId && !isNaN(gameId)) {
      query += " WHERE p.game_id = $1";
      params.push(gameId);
    }
    query += " ORDER BY p.sort_order ASC, p.diamonds ASC";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// ── Public stats (real DB counts) ────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT id)::int AS total_orders,
        COALESCE(SUM(diamonds), 0)::bigint AS total_diamonds,
        COUNT(DISTINCT clerk_user_id)::int AS total_users
      FROM orders
    `);
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Public recent completed orders (masked for live ticker) ──────────────────
router.get("/orders/recent", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.clerk_user_id, o.mlbb_ign, o.diamonds, o.created_at, p.name AS pack_name, p.currency_label
      FROM orders o
      LEFT JOIN packages p ON p.id = o.package_id
      WHERE o.status = 'completed' AND o.diamonds > 0
      ORDER BY o.created_at DESC
      LIMIT 12
    `);
    const uniqueIds: string[] = [...new Set(rows.map((r: any) => r.clerk_user_id).filter(Boolean) as string[])];
    const nameMap: Record<string, string> = {};
    if (uniqueIds.length > 0 && process.env.CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const result = await clerk.users.getUserList({ userId: uniqueIds, limit: 100 });
        for (const u of result.data) {
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || null;
          if (name) nameMap[u.id] = name;
        }
      } catch {}
    }
    res.json(rows.map((r: any) => ({
      mlbb_ign: r.mlbb_ign,
      diamonds: r.diamonds,
      created_at: r.created_at,
      pack_name: r.pack_name,
      currency_label: r.currency_label,
      user_display_name: nameMap[r.clerk_user_id] || null,
    })));
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Promo banners (active only, public) ───────────────────────────────────────
router.get("/settings/promo_banners", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='promo_banners'");
    const banners = JSON.parse(rows[0]?.value || "[]");
    res.json(banners.filter((b: any) => b.active !== false));
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Content version (no-store, always fresh) — bumped on admin Publish ───────
router.get("/content-version", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='content_version'");
    res.json({ v: rows[0]?.value ?? "1" });
  } catch { res.json({ v: "1" }); }
});

// ── Games version (no-store, always fresh) ───────────────────────────────────
router.get("/games-version", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='games_version'");
    res.json({ v: rows[0]?.value ?? "1" });
  } catch { res.json({ v: "1" }); }
});

// ── Games (public) ────────────────────────────────────────────────────────────
router.get("/games", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, image, sort_order, region FROM games ORDER BY sort_order ASC, id ASC");
    res.json(rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/games/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, image, sort_order, region FROM games WHERE id = $1", [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: "Game not found" }); return; }
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Promo events (active only) ────────────────────────────────────────────────
router.get("/promo-events", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='promo_events'");
    const events = JSON.parse(rows[0]?.value || "[]");
    res.json(events.filter((e: any) => e.active !== false));
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Support inquiry submission ────────────────────────────────────────────────
router.post("/support", async (req, res) => {
  const { userEmail, userName, inquiryType, description } = req.body;
  if (!inquiryType || !description?.trim()) {
    res.status(400).json({ error: "Inquiry type and description are required." });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO support_inquiries (user_email, user_name, inquiry_type, description) VALUES ($1, $2, $3, $4)`,
      [userEmail || null, userName || null, inquiryType, description.trim()]
    );

    console.log(`[notify] INQUIRY_SAVED — type: ${inquiryType}, from: ${userEmail || "anonymous"}`);

    // Respond immediately — fire email in background
    res.json({ ok: true });

    console.log(`[notify] NOTIFICATION_TRIGGERED — inquiry from ${userEmail || "anonymous"}`);
    sendInquiryEmail({ userEmail: userEmail || null, userName: userName || null, inquiryType, description }).catch((err: any) => {
      console.error("[notify] EMAIL_FAILED — inquiry:", err?.message);
    });
  } catch (err: any) {
    console.error("[support] POST /support failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
