import { Router } from "express";
import pool from "../lib/db";
import { requireAuth } from "../middlewares/requireAuth";
import { brevoSend } from "../lib/email";

const router = Router();

router.get("/balance", requireAuth, async (req: any, res) => {
  const userId = req.clerkUserId as string;
  try {
    const walletRes = await pool.query(
      "SELECT balance FROM wallets WHERE clerk_user_id = $1",
      [userId]
    );
    const balance = walletRes.rows[0]?.balance ?? "0";

    const txRes = await pool.query(
      "SELECT * FROM wallet_transactions WHERE clerk_user_id = $1 ORDER BY created_at DESC LIMIT 20",
      [userId]
    );

    res.json({ balance: parseFloat(balance), transactions: txRes.rows });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

router.post("/topup", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.clerkUserId as string;
  const { amount } = req.body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  try {
    const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
    const requestId = `TUP-${Date.now().toString(36).toUpperCase().slice(-5)}${rand}`;

    await pool.query(
      `INSERT INTO wallet_transactions (clerk_user_id, amount, type, status, upi_ref, description)
       VALUES ($1, $2, 'credit', 'pending', $3, 'Wallet top-up request')`,
      [userId, Number(amount).toFixed(2), requestId]
    );

    if (process.env.BREVO_API_KEY && process.env.FROM_EMAIL) {
      const ownerEmail = process.env.NOTIFY_EMAIL ?? process.env.FROM_EMAIL;
      console.log(`[notify] EMAIL_ATTEMPT_STARTED — wallet topup request ${requestId}`);
      try {
        const messageId = await brevoSend({
          to: ownerEmail,
          fromName: "Sky Official Wallet",
          subject: `💰 Wallet Top-up Request — ₹${Number(amount).toFixed(0)} (${requestId})`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;border-radius:16px;overflow:hidden;border:1px solid rgba(245,158,11,0.3);padding:28px;">
              <h2 style="color:#f59e0b;margin:0 0 16px;">💰 New Wallet Top-up Request</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="color:rgba(255,255,255,0.4);padding:8px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.07);">Request ID</td><td style="color:#f59e0b;font-weight:700;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.07);">${requestId}</td></tr>
                <tr><td style="color:rgba(255,255,255,0.4);padding:8px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.07);">Amount</td><td style="color:#fff;font-weight:700;font-size:16px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.07);">₹${Number(amount).toFixed(0)}</td></tr>
                <tr><td style="color:rgba(255,255,255,0.4);padding:8px 0;font-size:13px;">User ID</td><td style="color:rgba(255,255,255,0.7);font-size:11px;text-align:right;word-break:break-all;">${userId}</td></tr>
              </table>
              <div style="margin-top:20px;background:rgba(245,158,11,0.08);border-radius:10px;padding:14px;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.6;">
                Please open the <strong style="color:#f59e0b;">Admin Panel → Wallet tab</strong> to approve or reject this request.
              </div>
            </div>
          `,
        });
        console.log(`[notify] EMAIL_SENT_SUCCESS — wallet topup request ${requestId}, messageId: ${messageId}`);
      } catch (err: any) {
        console.error(`[notify] EMAIL_FAILED — wallet topup request ${requestId}: ${err?.message}`);
      }
    }

    res.json({ ok: true, message: "Top-up request submitted. Admin will credit your wallet shortly.", requestId });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
