/**
 * Standalone email test — runs independently of any order.
 * Usage: node scripts/test-email.mjs
 *
 * Requires NOTIFY_EMAIL and NOTIFY_EMAIL_APP_PASSWORD to be in the environment.
 */

import nodemailer from "nodemailer";

const user = process.env.NOTIFY_EMAIL;
const pass = process.env.NOTIFY_EMAIL_APP_PASSWORD;

console.log("=== Sky Official — Email Test ===");
console.log("NOTIFY_EMAIL        :", user ?? "NOT SET ❌");
console.log("NOTIFY_EMAIL_APP_PASSWORD:", pass ? "SET ✅ (hidden)" : "NOT SET ❌");

if (!user || !pass) {
  console.error("\n❌ Cannot send test — one or both env vars are missing.");
  console.error("   Set NOTIFY_EMAIL and NOTIFY_EMAIL_APP_PASSWORD in Replit Secrets and retry.");
  process.exit(1);
}

console.log("\nConnecting to Gmail SMTP...");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user, pass },
});

try {
  await transporter.verify();
  console.log("✅ SMTP connection verified — credentials are valid");
} catch (err) {
  console.error("❌ SMTP verification failed:", err.message);
  console.error("\nCommon causes:");
  console.error("  • Wrong App Password (must be 16 chars, no spaces)");
  console.error("  • 2-Step Verification not enabled on the Gmail account");
  console.error("  • App Password created for wrong app/device");
  process.exit(1);
}

console.log("\nSending test email to", user, "...");

try {
  const info = await transporter.sendMail({
    from: `"Sky Official Test" <${user}>`,
    to: user,
    subject: "✅ Sky Official — Email Test Successful",
    html: `
      <div style="font-family:sans-serif;max-width:480px;background:#0a0a0a;border-radius:16px;padding:32px;border:1px solid rgba(245,158,11,0.3);color:#fff">
        <h2 style="color:#f59e0b;margin:0 0 12px">✅ Email Notifications Are Working!</h2>
        <p style="color:rgba(255,255,255,0.6);margin:0 0 16px">This is a test email from Sky Official. If you received this, your email notification system is configured correctly.</p>
        <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px;font-size:13px;color:rgba(255,255,255,0.5)">
          Sent: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
        </div>
      </div>
    `,
  });
  console.log("✅ Test email sent! Message ID:", info.messageId);
  console.log("\nCheck your inbox at", user, "— it should arrive within a minute.");
  console.log("If not in inbox, check your Spam/Junk folder.");
} catch (err) {
  console.error("❌ Failed to send test email:", err.message);
  process.exit(1);
}
