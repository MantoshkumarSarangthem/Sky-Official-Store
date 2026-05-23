import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import ordersRouter from "./orders";
import walletRouter from "./wallet";
import profileRouter from "./profile";
import verifyRouter from "./verify";
import pushRouter from "./push";
import pool from "../lib/db";
import { sendInquiryEmail } from "../lib/email";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/orders", ordersRouter);
router.use("/wallet", walletRouter);
router.use("/profile", profileRouter);
router.use("/verify", verifyRouter);
router.use("/push", pushRouter);

router.get("/settings/category_popular", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='category_popular'");
    res.json(JSON.parse(rows[0]?.value || "{}"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/qr", async (_req, res) => {
  try {
    // Peek at the next staff in round-robin order (same logic as assignAvailableStaff,
    // but does NOT increment the counter — so the order submission later picks the same person)
    const { rows: staffList } = await pool.query(
      `SELECT id, qr_image, whatsapp, upi_id FROM recharge_staff WHERE status = 'available' ORDER BY sort_order ASC, id ASC`
    );

    if (staffList.length > 0) {
      // Read current round-robin index without touching it
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ('staff_rr_idx', '0') ON CONFLICT (key) DO NOTHING`
      );
      const { rows: idxRows } = await pool.query(
        `SELECT value FROM settings WHERE key = 'staff_rr_idx'`
      );
      const currentIdx = parseInt(idxRows[0]?.value ?? "0");
      const peekIdx = currentIdx % staffList.length;
      const nextStaff = staffList[peekIdx];

      if (nextStaff?.qr_image) {
        res.json({ qr: nextStaff.qr_image, upi_id: nextStaff.upi_id || null, whatsapp: nextStaff.whatsapp || null });
        return;
      }
    }

    // Fallback to admin/owner QR if no staff available or staff has no QR uploaded
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='qr_code'");
    res.json({ qr: rows[0]?.value || null, upi_id: null, whatsapp: null });
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

router.get("/settings/offer_banners", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='offer_banners'");
    res.json(JSON.parse(rows[0]?.value || "[]"));
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

router.get("/packages", async (req, res) => {
  try {
    const gameId = req.query.game_id ? parseInt(req.query.game_id as string, 10) : null;
    let query = "SELECT * FROM packages";
    const params: unknown[] = [];
    if (gameId && !isNaN(gameId)) {
      query += " WHERE game_id = $1";
      params.push(gameId);
    }
    query += " ORDER BY sort_order ASC, diamonds ASC";
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
      SELECT mlbb_ign, diamonds, created_at
      FROM orders
      WHERE status = 'completed' AND diamonds > 0
      ORDER BY created_at DESC
      LIMIT 12
    `);
    res.json(rows);
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

// ── Games (public) ────────────────────────────────────────────────────────────
router.get("/games", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, image, sort_order FROM games ORDER BY sort_order ASC, id ASC");
    res.json(rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/games/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, image, sort_order FROM games WHERE id = $1", [req.params.id]);
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
