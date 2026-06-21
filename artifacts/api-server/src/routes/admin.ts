import { Router } from "express";
import pool from "../lib/db";
import { brevoSend } from "../lib/email";
import { createClerkClient } from "@clerk/express";
import multer from "multer";
import crypto from "crypto";
import { insertNotification } from "../lib/notifications";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function fileToDataUrl(file: Express.Multer.File): string {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

const router = Router();

async function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  if (token === process.env.ADMIN_PASSWORD) {
    req.isSuperAdmin = true;
    return next();
  }

  try {
    const { rows } = await pool.query("SELECT id FROM admin_tokens WHERE token = $1", [token]);
    if (rows.length > 0) {
      req.isSuperAdmin = false;
      return next();
    }
  } catch {}

  return res.status(401).json({ error: "Unauthorized" });
}

function requireSuperAdmin(req: any, res: any, next: any) {
  if (!req.isSuperAdmin) return res.status(403).json({ error: "Super admin access required" });
  next();
}

function generateAdminToken(): string {
  return "SKY-" + crypto.randomBytes(10).toString("hex").toUpperCase();
}

async function getClerkUserEmail(userId: string): Promise<string | null> {
  if (!process.env.CLERK_SECRET_KEY || !userId) return null;
  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(userId);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

async function getClerkUserProfile(userId: string): Promise<{ email: string | null; name: string | null }> {
  if (!process.env.CLERK_SECRET_KEY || !userId) return { email: null, name: null };
  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress ?? null;
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || null;
    return { email, name };
  } catch {
    return { email: null, name: null };
  }
}

async function sendOrderCompletedEmail(to: string, order: any, customerName: string | null): Promise<void> {
  if (!process.env.BREVO_API_KEY || !process.env.FROM_EMAIL) {
    console.error("[email] sendOrderCompletedEmail skipped — BREVO_API_KEY or FROM_EMAIL not set");
    return;
  }

  const greeting = customerName ? customerName : "Customer";
  const orderId = order.display_id || `#${order.id}`;
  const diamonds = Number(order.diamonds).toLocaleString("en-IN");
  const date = new Date(order.completed_at || order.created_at || Date.now())
    .toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const storeName = "Sky Official";

  try {
    const messageId = await brevoSend({
      to,
      subject: `Order Delivered — ♦${diamonds} Diamonds · ${storeName}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order Delivered</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0c0c0c;padding:28px 32px;text-align:center;">
            <div style="color:#f59e0b;font-size:22px;font-weight:800;letter-spacing:0.04em;">${storeName}</div>
            <div style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:0.14em;margin-top:4px;">MLBB DIAMOND TOP-UP</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 6px;color:#111827;font-size:15px;">Hello <strong>${greeting}</strong>,</p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">Good news — your order has been successfully completed.</p>

            <!-- Order Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
              <tr>
                <td colspan="2" style="background:#f9fafb;padding:10px 16px;border-bottom:1px solid #e5e7eb;">
                  <span style="color:#374151;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Order Details</span>
                </td>
              </tr>
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Order ID</td>
                <td style="padding:12px 16px;color:#111827;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;">${orderId}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Date</td>
                <td style="padding:12px 16px;color:#111827;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;">${date}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Product</td>
                <td style="padding:12px 16px;color:#111827;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;">MLBB Diamonds</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Quantity</td>
                <td style="padding:12px 16px;color:#d97706;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #f3f4f6;">&#9830; ${diamonds} Diamonds</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;">Status</td>
                <td style="padding:12px 16px;text-align:right;">
                  <span style="display:inline-block;background:#d1fae5;color:#065f46;font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;">Delivered</span>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">Your diamonds have been credited to your account.</p>
            <p style="margin:0 0 28px;color:#374151;font-size:14px;line-height:1.7;">If you do not see them in your game, please wait a few minutes or contact support by replying to this email.</p>
            <p style="margin:0 0 4px;color:#374151;font-size:14px;">Thank you for choosing <strong>${storeName}</strong>.</p>
            <p style="margin:0 0 32px;color:#374151;font-size:14px;line-height:1.8;">Best regards,<br><strong>${storeName}</strong></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:11px;">© 2026 ${storeName}. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
  } catch (err: any) {
    console.error(`[email] EMAIL_FAILED — order completed ${orderId} to ${to}: ${err?.message}`);
  }
}

router.post("/login", async (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true, role: "superadmin" });
  }
  try {
    const { rows } = await pool.query("SELECT id FROM admin_tokens WHERE token = $1", [password]);
    if (rows.length > 0) {
      return res.json({ success: true, role: "admin" });
    }
  } catch {}
  res.status(401).json({ error: "Wrong password" });
});

router.get("/me", requireAdmin, (req: any, res) => {
  res.json({ role: req.isSuperAdmin ? "superadmin" : "admin" });
});

router.get("/tokens", requireAdmin, requireSuperAdmin, async (_req, res): Promise<void> => {
  try {
    const { rows } = await pool.query("SELECT id, name, token, created_at FROM admin_tokens ORDER BY created_at DESC");
    res.json(rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.post("/tokens", requireAdmin, requireSuperAdmin, async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
  try {
    const token = generateAdminToken();
    const { rows } = await pool.query(
      "INSERT INTO admin_tokens (name, token) VALUES ($1, $2) RETURNING *",
      [name.trim(), token]
    );
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.delete("/tokens/:id", requireAdmin, requireSuperAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM admin_tokens WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/packages", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM packages ORDER BY sort_order ASC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/packages", requireAdmin, async (req, res) => {
  const { diamonds, bonus_diamonds, price, old_price, label, is_popular, sort_order, name, category, status, game_id, image } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO packages (diamonds, bonus_diamonds, price, old_price, label, is_popular, sort_order, name, category, status, game_id, image, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING *`,
      [diamonds, bonus_diamonds || 0, price, old_price || null, label || null, is_popular || false, sort_order || 0, name || null, category || null, status || "available", game_id || null, image || null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.put("/packages/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { diamonds, bonus_diamonds, price, old_price, label, is_popular, sort_order, name, category, status, game_id, image } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE packages SET diamonds=$1, bonus_diamonds=$2, price=$3, old_price=$4, label=$5, is_popular=$6, sort_order=$7, name=$8, category=$9, status=$10, game_id=$11, image=CASE WHEN $12::TEXT IS NOT NULL THEN NULLIF($12, '') ELSE image END, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [diamonds, bonus_diamonds || 0, price, old_price || null, label || null, is_popular || false, sort_order || 0, name || null, category || null, status || "available", game_id || null, image !== undefined ? (image || null) : null, id]
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.delete("/packages/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM packages WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.get("/orders", requireAdmin, async (_req, res) => {
  try {
    const { rows: orders } = await pool.query(
      `SELECT o.*, p.image AS pack_image, p.name AS pack_name_from_pkg
       FROM orders o
       LEFT JOIN packages p ON p.id = o.package_id
       ORDER BY o.created_at DESC LIMIT 100`
    );
    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(price), 0) AS total_revenue,
        COALESCE(SUM(diamonds), 0) AS total_diamonds
      FROM orders
    `);
    res.json({ orders, stats: stats[0] });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/orders", requireAdmin, async (req, res) => {
  const { package_id, diamonds, price, mlbb_id, status, note } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO orders (package_id, diamonds, price, mlbb_id, status, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [package_id || null, diamonds, price, mlbb_id || null, status || "pending", note || null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.put("/orders/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { status, note } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET status=$1, note=$2 WHERE id=$3 RETURNING *`,
      [status, note || null, id]
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    const order = rows[0];

    // Send completion email when order is marked as completed
    if (status === "completed" && order.clerk_user_id) {
      const orderId = order.display_id || `#${order.id}`;
      const diamonds = Number(order.diamonds).toLocaleString("en-IN");
      insertNotification(
        order.clerk_user_id,
        "order_completed",
        "Order Delivered",
        `Your order ${orderId} (${diamonds} diamonds) has been delivered to your account.`
      );
      getClerkUserProfile(order.clerk_user_id).then(({ email, name }) => {
        if (email) {
          sendOrderCompletedEmail(email, order, name).catch(() => {});
        }
      }).catch(() => {});
    }

    if (status === "failed" && order.clerk_user_id) {
      const orderId = order.display_id || `#${order.id}`;
      insertNotification(
        order.clerk_user_id,
        "payment_failed",
        "Payment Issue ⚠️",
        `There was an issue with your order ${orderId}. Please contact support if you need help.`
      );
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.delete("/orders/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM orders WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

router.get("/settings/qr", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('qr_code', 'admin_upi_id')"
    );
    const m: Record<string, string> = {};
    rows.forEach((r: any) => { m[r.key] = r.value; });
    res.json({ qr: m["qr_code"] || null, upi_id: m["admin_upi_id"] || null });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/qr", requireAdmin, async (req, res) => {
  const { qr } = req.body;
  if (!qr) { res.status(400).json({ error: "qr is required" }); return; }
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('qr_code', $1) ON CONFLICT (key) DO UPDATE SET value=$1`,
      [qr]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/admin-upi", requireAdmin, async (req, res) => {
  const { upi_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('admin_upi_id', $1) ON CONFLICT (key) DO UPDATE SET value=$1`,
      [upi_id || ""]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/admin-status", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='admin_status'");
    res.json({ status: rows[0]?.value || "offline" });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/admin-status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!["available", "offline"].includes(status)) { res.status(400).json({ error: "invalid status" }); return; }
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('admin_status', $1) ON CONFLICT (key) DO UPDATE SET value=$1`,
      [status]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/category_popular", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='category_popular'");
    res.json(JSON.parse(rows[0]?.value || "{}"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/category_popular", requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('category_popular', $1)
       ON CONFLICT (key) DO UPDATE SET value=$1`,
      [JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/offer_banners", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='offer_banners'");
    res.json(JSON.parse(rows[0]?.value || "[]"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/offer_banners", requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('offer_banners',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(req.body)]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/daily_offer_packages", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='daily_offer_packages'");
    res.json(JSON.parse(rows[0]?.value || "[]"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/daily_offer_packages", requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('daily_offer_packages',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(req.body)]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/promo_banners", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='promo_banners'");
    res.json(JSON.parse(rows[0]?.value || "[]"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/promo_banners", requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('promo_banners',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(req.body)]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/trustpilot", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('trustpilot_url','trustpilot_enabled')");
    const m: Record<string, string> = {};
    rows.forEach((r: any) => { m[r.key] = r.value; });
    res.json({ url: m["trustpilot_url"] || "", enabled: m["trustpilot_enabled"] === "true" });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/trustpilot", requireAdmin, async (req, res) => {
  const { url, enabled } = req.body;
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('trustpilot_url',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [url || ""]);
    await pool.query(`INSERT INTO settings (key,value) VALUES ('trustpilot_enabled',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [enabled ? "true" : "false"]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/community_links", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('community_whatsapp','community_instagram')");
    const m: Record<string, string> = {};
    rows.forEach((r: any) => { m[r.key] = r.value; });
    res.json({ whatsapp: m["community_whatsapp"] || "", instagram: m["community_instagram"] || "" });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/community_links", requireAdmin, async (req, res) => {
  const { whatsapp, instagram } = req.body;
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('community_whatsapp',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [whatsapp || ""]);
    await pool.query(`INSERT INTO settings (key,value) VALUES ('community_instagram',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [instagram || ""]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/pack_images", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='pack_images'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : null);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/pack_images", requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('pack_images',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(req.body)]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/pass_images", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='pass_images'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : null);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/pass_images", requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('pass_images',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(req.body)]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/starlight_images", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='starlight_images'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : {});
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/starlight_images", requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('starlight_images',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(req.body)]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.post("/upload-image", requireAdmin, upload.single("image"), (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: fileToDataUrl(req.file) });
});

router.post("/upload-media", requireAdmin, mediaUpload.single("file"), (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: fileToDataUrl(req.file) });
});

router.get("/settings/category_availability", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='category_availability'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : {});
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/category_availability", requireAdmin, async (req, res) => {
  try {
    await pool.query(`INSERT INTO settings (key,value) VALUES ('category_availability',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [JSON.stringify(req.body)]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/wallet-requests", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 100`
    );
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
    res.json(rows.map((r: any) => ({ ...r, display_name: nameMap[r.clerk_user_id] || null })));
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/wallet-requests/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const txRes = await pool.query(
      "SELECT * FROM wallet_transactions WHERE id=$1 AND status='pending'",
      [id]
    );
    if (!txRes.rows[0]) { res.status(404).json({ error: "Not found or already processed" }); return; }
    const tx = txRes.rows[0];

    await pool.query(
      `INSERT INTO wallets (clerk_user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (clerk_user_id)
       DO UPDATE SET balance = wallets.balance + $2, updated_at = NOW()`,
      [tx.clerk_user_id, tx.amount]
    );

    await pool.query(
      "UPDATE wallet_transactions SET status='approved' WHERE id=$1",
      [id]
    );

    insertNotification(
      tx.clerk_user_id,
      "wallet_approved",
      "Wallet Topped Up ✅",
      `Your top-up request of ₹${Number(tx.amount).toFixed(0)} has been approved and added to your wallet.`
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/wallet-requests/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const txRes = await pool.query(
      "SELECT * FROM wallet_transactions WHERE id=$1 AND status='pending'",
      [id]
    );
    const tx = txRes.rows[0];
    const { rowCount } = await pool.query(
      "UPDATE wallet_transactions SET status='rejected' WHERE id=$1 AND status='pending'",
      [id]
    );
    if (!rowCount) { res.status(404).json({ error: "Not found or already processed" }); return; }

    if (tx) {
      insertNotification(
        tx.clerk_user_id,
        "wallet_rejected",
        "Top-up Request Rejected",
        `Your wallet top-up request of ₹${Number(tx.amount).toFixed(0)} was not approved. Please contact support if you need help.`
      );
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// ── User Search (Clerk) ───────────────────────────────────────────────────────
router.get("/users/search", requireAdmin, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) { res.json([]); return; }
  try {
    if (!process.env.CLERK_SECRET_KEY) { res.json([]); return; }
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const result = await clerk.users.getUserList({ query: q, limit: 10 });
    res.json(result.data.map(u => ({
      clerk_user_id: u.id,
      display_name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || null,
      email: u.emailAddresses[0]?.emailAddress || null,
    })));
  } catch {
    res.json([]);
  }
});

// ── Direct Wallet Credit ──────────────────────────────────────────────────────
router.get("/wallet/known-users", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT clerk_user_id, MAX(display_name) AS display_name
       FROM (
         SELECT clerk_user_id, display_name FROM wallet_transactions WHERE clerk_user_id IS NOT NULL
         UNION ALL
         SELECT clerk_user_id, display_name FROM orders WHERE clerk_user_id IS NOT NULL
       ) combined
       GROUP BY clerk_user_id
       ORDER BY MAX(display_name) NULLS LAST`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// Search users by username for wallet credit
router.get("/wallet/user-by-username", requireAdmin, async (req, res) => {
  const q = String(req.query.username || "").trim().toLowerCase();
  if (!q) { res.json([]); return; }
  try {
    const { rows } = await pool.query(
      "SELECT clerk_user_id, username FROM user_profiles WHERE username ILIKE $1 LIMIT 10",
      [`${q}%`]
    );
    res.json(rows);
  } catch {
    res.json([]);
  }
});

router.post("/wallet/direct-credit", requireAdmin, async (req, res): Promise<void> => {
  let { clerk_user_id, username, amount, note } = req.body;

  // Resolve clerk_user_id from username if only username given
  if (!clerk_user_id && username) {
    const { rows } = await pool.query(
      "SELECT clerk_user_id FROM user_profiles WHERE username = $1",
      [String(username).trim().toLowerCase()]
    );
    clerk_user_id = rows[0]?.clerk_user_id ?? null;
  }

  if (!clerk_user_id || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: "User not found or invalid amount" });
    return;
  }

  // Fetch username for display_name storage
  const usernameForDisplay = username
    ? String(username).trim().toLowerCase()
    : (await pool.query("SELECT username FROM user_profiles WHERE clerk_user_id = $1", [clerk_user_id]).catch(() => ({ rows: [] }))).rows[0]?.username ?? null;

  try {
    await pool.query(
      `INSERT INTO wallets (clerk_user_id, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (clerk_user_id)
       DO UPDATE SET balance = wallets.balance + $2, updated_at = NOW()`,
      [clerk_user_id, Number(amount)]
    );
    await pool.query(
      `INSERT INTO wallet_transactions (clerk_user_id, amount, type, status, description, display_name)
       VALUES ($1, $2, 'admin_credit', 'approved', $3, $4)
       ON CONFLICT DO NOTHING`,
      [clerk_user_id, Number(amount), note || "Admin credit", usernameForDisplay]
    ).catch(async () => {
      // display_name column might not exist on older installs — fall back without it
      await pool.query(
        `INSERT INTO wallet_transactions (clerk_user_id, amount, type, status, description)
         VALUES ($1, $2, 'admin_credit', 'approved', $3)`,
        [clerk_user_id, Number(amount), note || "Admin credit"]
      );
    });
    insertNotification(
      clerk_user_id,
      "wallet_credited",
      `Wallet Credited +₹${Number(amount).toFixed(0)}`,
      `₹${Number(amount).toFixed(0)} has been credited to your wallet${note ? ` — ${note}` : ""}.`
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// ── Promo Events ──────────────────────────────────────────────────────────────
router.get("/promo-events", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='promo_events'");
    res.json(JSON.parse(rows[0]?.value || "[]"));
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/promo-events", requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO settings (key,value) VALUES ('promo_events',$1) ON CONFLICT (key) DO UPDATE SET value=$1`,
      [JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Recharge Staff ────────────────────────────────────────────────────────────
router.get("/staff", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM recharge_staff ORDER BY sort_order ASC, id ASC");
    res.json(rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.post("/staff", requireAdmin, upload.single("qr_image"), async (req: any, res: any) => {
  const { name, email, whatsapp, status, shift_hours, sort_order, staff_pin, notify_orders, upi_id } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const qrImage = req.file ? fileToDataUrl(req.file) : (req.body.qr_image || null);
  const notifyOrders = notify_orders === "false" || notify_orders === false ? false : true;
  try {
    const { rows } = await pool.query(
      `INSERT INTO recharge_staff (name, email, qr_image, whatsapp, status, shift_hours, sort_order, staff_pin, notify_orders, upi_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, email || null, qrImage, whatsapp || null, status || "offline", shift_hours || null, sort_order || 0, staff_pin || null, notifyOrders, upi_id || null]
    );
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/staff/:id", requireAdmin, upload.single("qr_image"), async (req: any, res: any): Promise<void> => {
  const { id } = req.params;
  const { name, email, whatsapp, status, shift_hours, sort_order, qr_image, notify_orders, upi_id } = req.body;
  const qrImage = req.file ? fileToDataUrl(req.file) : (qr_image || null);
  const notifyOrders = notify_orders === "false" || notify_orders === false ? false : true;
  try {
    const { rows } = await pool.query(
      `UPDATE recharge_staff SET name=$1, email=$2, qr_image=COALESCE($3, qr_image), whatsapp=$4, status=$5, shift_hours=$6, sort_order=$7, notify_orders=$8, upi_id=$9
       WHERE id=$10 RETURNING *`,
      [name, email || null, qrImage, whatsapp || null, status || "offline", shift_hours || null, sort_order || 0, notifyOrders, upi_id || null, id]
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/staff/:id/status", requireAdmin, requireSuperAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  if (!["available", "offline"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  try {
    const { rows } = await pool.query(
      `UPDATE recharge_staff SET status=$1 WHERE id=$2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/staff/:id/notify", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { notify_orders } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE recharge_staff SET notify_orders=$1 WHERE id=$2 RETURNING *`,
      [!!notify_orders, id]
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.post("/staff/:id/test-email", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!process.env.BREVO_API_KEY || !process.env.FROM_EMAIL) {
    res.status(400).json({ error: "BREVO_API_KEY or FROM_EMAIL not configured in secrets." });
    return;
  }
  try {
    const { rows } = await pool.query("SELECT name, email FROM recharge_staff WHERE id=$1", [id]);
    const staff = rows[0];
    if (!staff) { res.status(404).json({ error: "Staff not found" }); return; }
    if (!staff.email) { res.status(400).json({ error: "This staff member has no email address saved." }); return; }

    const messageId = await brevoSend({
      to: staff.email,
      subject: `✅ Test Notification — Sky Official`,
      html: `<div style="font-family:sans-serif;background:#0a0a0a;color:#f9fafb;padding:24px;max-width:440px;border-radius:14px;border:1px solid rgba(34,197,94,0.25);">
        <h2 style="color:#22c55e;margin:0 0 12px;">✅ Email Notifications Working!</h2>
        <p style="color:rgba(255,255,255,0.6);margin:0 0 12px;">Hi ${staff.name}, this is a test email from Sky Official.</p>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0;">You will receive emails like this whenever a new order comes in. You're all set! 🎉</p>
      </div>`,
    });
    res.json({ ok: true, sentTo: staff.email });
  } catch (err: any) {
    console.error("[email] EMAIL_FAILED — test email to staff:", err?.message);
    res.status(500).json({ error: err?.message || "Failed to send test email." });
  }
});

router.delete("/staff/:id", requireAdmin, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM recharge_staff WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Test notification pipeline ────────────────────────────────────────────────
router.post("/test-notification", requireAdmin, async (_req, res): Promise<void> => {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  const brevoKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const log: string[] = [];
  const result: Record<string, any> = { env: {}, steps: [] };

  result.env.NOTIFY_EMAIL = notifyEmail ? `set (${notifyEmail})` : "NOT SET";
  result.env.BREVO_API_KEY = brevoKey ? "set (hidden)" : "NOT SET";
  result.env.FROM_EMAIL = fromEmail ? `set (${fromEmail})` : "NOT SET";

  log.push("STEP_1: env vars checked");

  if (!brevoKey || !fromEmail) {
    result.steps = log;
    result.error = "BREVO_API_KEY or FROM_EMAIL not configured";
    res.status(400).json(result);
    return;
  }

  log.push("STEP_2: Brevo API configured — no SMTP connection needed");

  log.push("STEP_3: sending test owner email via Brevo");
  try {
    const messageId = await brevoSend({
      to: notifyEmail ?? fromEmail,
      subject: `🧪 Test Notification — Sky Official`,
      html: `<div style="font-family:sans-serif;background:#0a0a0a;padding:24px;border-radius:14px;border:1px solid rgba(245,158,11,0.3)">
        <h2 style="color:#f59e0b">🧪 Test Notification</h2>
        <p style="color:rgba(255,255,255,0.6)">This is a test from the Sky Official /test-notification endpoint. If you received this, email delivery is working correctly.</p>
      </div>`,
    });
    log.push(`STEP_3_SUCCESS: owner email sent, messageId: ${messageId}`);
    result.ownerEmail = { ok: true, messageId, sentTo: notifyEmail ?? fromEmail };
  } catch (err: any) {
    log.push(`STEP_3_FAILED: ${err?.message}`);
    result.ownerEmail = { ok: false, error: err?.message };
  }

  log.push("STEP_4: checking available staff with email + notify_orders");
  let staffResults: any[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, status, notify_orders FROM recharge_staff WHERE email IS NOT NULL AND email != '' ORDER BY id`
    );
    log.push(`STEP_4: found ${rows.length} staff with email (${rows.filter((r: any) => r.status === 'available' && r.notify_orders).length} eligible for notifications)`);
    for (const staff of rows) {
      const eligible = staff.status === 'available' && staff.notify_orders;
      if (eligible) {
        log.push(`STEP_5: sending test email to staff ${staff.name} <${staff.email}>`);
        try {
          const messageId = await brevoSend({
            to: staff.email,
            subject: `🧪 Test Staff Notification — Sky Official`,
            html: `<div style="font-family:sans-serif;background:#0a0a0a;padding:24px;border-radius:14px;border:1px solid rgba(245,158,11,0.3)">
              <h2 style="color:#f59e0b">🧪 Staff Test</h2>
              <p style="color:rgba(255,255,255,0.6)">Hi ${staff.name}, this confirms you will receive real order alerts at this email address.</p>
            </div>`,
          });
          log.push(`STEP_5_SUCCESS: staff ${staff.name}, messageId: ${messageId}`);
          staffResults.push({ name: staff.name, email: staff.email, ok: true, messageId });
        } catch (err: any) {
          log.push(`STEP_5_FAILED: staff ${staff.name}: ${err?.message}`);
          staffResults.push({ name: staff.name, email: staff.email, ok: false, error: err?.message });
        }
      } else {
        staffResults.push({ name: staff.name, email: staff.email, ok: null, skipped: `status=${staff.status}, notify_orders=${staff.notify_orders}` });
      }
    }
  } catch (err: any) {
    log.push(`STEP_4_FAILED: ${err?.message}`);
  }

  result.staffEmails = staffResults;
  result.steps = log;
  result.summary = "Test complete — check steps for details";
  res.json(result);
});

// ── Support Inquiries ─────────────────────────────────────────────────────────
router.get("/support-inquiries", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM support_inquiries ORDER BY created_at DESC LIMIT 100"
    );
    res.json(rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/support-inquiries/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query("UPDATE support_inquiries SET status=$1 WHERE id=$2", [status, id]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Enhanced order search ──────────────────────────────────────────────────────
router.get("/orders/search", requireAdmin, async (req, res) => {
  const { q, status: statusFilter } = req.query as Record<string, string>;
  try {
    let query = `SELECT o.*, s.name AS staff_name FROM orders o
      LEFT JOIN recharge_staff s ON o.assigned_staff_id = s.id
      WHERE 1=1`;
    const params: any[] = [];
    if (q) {
      params.push(`%${q}%`);
      query += ` AND (o.display_id ILIKE $${params.length} OR o.mlbb_id ILIKE $${params.length} OR o.mlbb_ign ILIKE $${params.length} OR o.clerk_user_id ILIKE $${params.length})`;
    }
    if (statusFilter) {
      params.push(statusFilter);
      query += ` AND o.status = $${params.length}`;
    }
    query += " ORDER BY o.created_at DESC LIMIT 100";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Mark order completed with timestamp ───────────────────────────────────────
router.put("/orders/:id/complete", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { note } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET status='completed', completed_at=NOW(), note=COALESCE($1, note) WHERE id=$2 RETURNING *`,
      [note || null, id]
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    const order = rows[0];

    if (order.clerk_user_id) {
      const orderId = order.display_id || `#${order.id}`;
      const diamonds = Number(order.diamonds).toLocaleString("en-IN");
      insertNotification(
        order.clerk_user_id,
        "order_completed",
        "Order Delivered",
        `Your order ${orderId} (${diamonds} diamonds) has been delivered to your account.`
      );
      getClerkUserProfile(order.clerk_user_id).then(({ email, name }) => {
        if (email) sendOrderCompletedEmail(email, order, name).catch(() => {});
      }).catch(() => {});
    }

    res.json(order);
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Test email notification ────────────────────────────────────────────────────
router.post("/test-email", requireAdmin, async (_req, res) => {
  const ownerEmail = process.env.NOTIFY_EMAIL;
  const fromEmail = process.env.FROM_EMAIL;

  if (!process.env.BREVO_API_KEY || !fromEmail) {
    res.status(400).json({ ok: false, error: "BREVO_API_KEY or FROM_EMAIL is not configured." });
    return;
  }

  const to = ownerEmail ?? fromEmail;
  try {
    const messageId = await brevoSend({
      to,
      subject: "✅ Email Test — Sky Official",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;border-radius:16px;overflow:hidden;border:1px solid rgba(34,197,94,0.3);padding:28px;">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:36px;margin-bottom:8px;">✅</div>
            <div style="color:#4ade80;font-weight:800;font-size:20px;">Email Notifications Working!</div>
            <div style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:6px;">This is a test email from your Sky Official admin panel.</div>
          </div>
          <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:14px 16px;color:rgba(255,255,255,0.6);font-size:13px;line-height:1.6;text-align:center;">
            Order and inquiry notifications will be delivered to <strong style="color:#fff;">${to}</strong>
          </div>
        </div>
      `,
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error(`[email] EMAIL_FAILED — test email: ${err?.message}`);
    res.status(500).json({ ok: false, error: err?.message || "Failed to send test email." });
  }
});

// ── Games CRUD ────────────────────────────────────────────────────────────────
router.get("/games", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { rows } = await pool.query("SELECT id, name, image, sort_order, region FROM games ORDER BY sort_order ASC, id ASC");
    res.json(rows);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.post("/games", requireAdmin, upload.single("image"), async (req, res): Promise<void> => {
  try {
    const { name, sort_order, region } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    const image = req.file ? fileToDataUrl(req.file) : null;
    const { rows } = await pool.query(
      "INSERT INTO games (name, image, sort_order, region) VALUES ($1, $2, $3, $4) RETURNING id, name, image, sort_order, region",
      [name.trim(), image, parseInt(sort_order) || 0, region?.trim() || null]
    );
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/games/:id", requireAdmin, upload.single("image"), async (req, res): Promise<void> => {
  try {
    const { name, sort_order, region } = req.body;
    const id = parseInt(String(req.params.id));
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    if (req.file) {
      const image = fileToDataUrl(req.file);
      await pool.query("UPDATE games SET name=$1, image=$2, sort_order=$3, region=$4 WHERE id=$5", [name.trim(), image, parseInt(sort_order) || 0, region?.trim() || null, id]);
    } else {
      await pool.query("UPDATE games SET name=$1, sort_order=$2, region=$3 WHERE id=$4", [name.trim(), parseInt(sort_order) || 0, region?.trim() || null, id]);
    }
    const { rows } = await pool.query("SELECT id, name, image, sort_order, region FROM games WHERE id=$1", [id]);
    res.json(rows[0]);
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.delete("/games/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    await pool.query("DELETE FROM games WHERE id=$1", [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Latest Event popup setting ────────────────────────────────────────────────
router.get("/settings/latest_event", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='latest_event'");
    res.json(rows[0] ? JSON.parse(rows[0].value) : { enabled: false, image: "", targetCategory: "" });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.put("/settings/latest_event", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { enabled, image, targetCategory } = req.body;
    const value = JSON.stringify({ enabled: !!enabled, image: image || "", targetCategory: targetCategory || "" });
    await pool.query(`INSERT INTO settings (key, value) VALUES ('latest_event', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [value]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

router.get("/settings/maintenance", requireAdmin, async (_req, res): Promise<void> => {
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

router.put("/settings/maintenance", requireAdmin, requireSuperAdmin, async (req, res): Promise<void> => {
  try {
    const { enabled, end_time, message } = req.body;
    await pool.query(`INSERT INTO settings (key,value) VALUES ('maintenance_enabled',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [enabled ? "true" : "false"]);
    await pool.query(`INSERT INTO settings (key,value) VALUES ('maintenance_end_time',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [end_time || ""]);
    await pool.query(`INSERT INTO settings (key,value) VALUES ('maintenance_message',$1) ON CONFLICT (key) DO UPDATE SET value=$1`, [message || "We'll be back soon."]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── Offers CRUD ───────────────────────────────────────────────────────────────

router.get("/offers", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*,
             COALESCE(json_agg(
               json_build_object(
                 'package_id', op.package_id,
                 'offer_price', op.offer_price,
                 'package_name', p.name,
                 'package_diamonds', p.diamonds,
                 'package_price', p.price,
                 'game_name', g.name
               )
             ) FILTER (WHERE op.package_id IS NOT NULL), '[]') AS packages
      FROM offers o
      LEFT JOIN offer_packages op ON op.offer_id = o.id
      LEFT JOIN packages p ON p.id = op.package_id
      LEFT JOIN games g ON g.id = p.game_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    console.error("[admin] GET /offers failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/offers", requireAdmin, async (req, res) => {
  const { name, description, eligibility, max_claims, is_active, packages } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const eligVal = eligibility || "first_time";
    const maxClaims = eligVal === "first_time" && max_claims ? parseInt(max_claims) : null;
    const { rows } = await client.query(
      `INSERT INTO offers (name, description, eligibility, max_claims, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name.trim(), description?.trim() || null, eligVal, maxClaims, is_active !== false]
    );
    const offerId = rows[0].id;
    for (const pkg of (packages || [])) {
      await client.query(
        `INSERT INTO offer_packages (offer_id, package_id, offer_price) VALUES ($1, $2, $3)`,
        [offerId, pkg.package_id, parseFloat(pkg.offer_price)]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, id: offerId });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[admin] POST /offers failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

router.put("/offers/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, eligibility, max_claims, is_active, packages } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const eligVal = eligibility || "first_time";
    const maxClaims = eligVal === "first_time" && max_claims ? parseInt(max_claims) : null;
    await client.query(
      `UPDATE offers SET name=$1, description=$2, eligibility=$3, max_claims=$4, is_active=$5 WHERE id=$6`,
      [name.trim(), description?.trim() || null, eligVal, maxClaims, is_active !== false, id]
    );
    await client.query("DELETE FROM offer_packages WHERE offer_id = $1", [id]);
    for (const pkg of (packages || [])) {
      await client.query(
        `INSERT INTO offer_packages (offer_id, package_id, offer_price) VALUES ($1, $2, $3)`,
        [id, pkg.package_id, parseFloat(pkg.offer_price)]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("[admin] PUT /offers/:id failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

router.delete("/offers/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM offers WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[admin] DELETE /offers/:id failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/offers/:id/reset-claims", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM claimed_offers WHERE offer_id = $1", [id]);
    await pool.query("UPDATE offers SET total_claims = 0 WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[admin] POST /offers/:id/reset-claims failed:", err?.message);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
