// Email delivery via Brevo transactional API (HTTP — no SMTP, no firewall issues)

async function brevoSend({
  to,
  subject,
  html,
  fromName = "Sky Official",
}: {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
}): Promise<string> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error("BREVO_API_KEY or FROM_EMAIL not configured");
  }

  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: recipients,
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { messageId?: string };
  return data.messageId ?? "unknown";
}

export { brevoSend };

export async function sendInquiryEmail(inquiry: {
  userEmail: string | null;
  userName: string | null;
  inquiryType: string;
  description: string;
}) {
  const ownerEmail = process.env.NOTIFY_EMAIL;

  if (!process.env.BREVO_API_KEY || !process.env.FROM_EMAIL) {
    console.error("[notify] EMAIL_FAILED — BREVO_API_KEY or FROM_EMAIL not set");
    return;
  }

  const typeLabels: Record<string, string> = {
    order: "Order Related",
    payment: "Payment Related",
    bug: "Bug / Technical Issue",
    other: "Other",
  };

  try {
    const messageId = await brevoSend({
      to: ownerEmail ?? process.env.FROM_EMAIL!,
      fromName: "Sky Official Support",
      subject: `📩 Support Inquiry — ${typeLabels[inquiry.inquiryType] || inquiry.inquiryType}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;border-radius:16px;overflow:hidden;border:1px solid rgba(245,158,11,0.3);padding:28px;">
          <h2 style="color:#f59e0b;margin:0 0 16px;">📩 New Support Inquiry</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:rgba(255,255,255,0.4);padding:8px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.07);">Type</td><td style="color:#fff;font-weight:700;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.07);">${typeLabels[inquiry.inquiryType] || inquiry.inquiryType}</td></tr>
            ${inquiry.userEmail ? `<tr><td style="color:rgba(255,255,255,0.4);padding:8px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.07);">From</td><td style="color:#fff;font-weight:700;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.07);">${inquiry.userEmail}</td></tr>` : ""}
            ${inquiry.userName ? `<tr><td style="color:rgba(255,255,255,0.4);padding:8px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.07);">Name</td><td style="color:#fff;font-weight:700;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.07);">${inquiry.userName}</td></tr>` : ""}
          </table>
          <div style="margin-top:16px;background:rgba(255,255,255,0.04);border-radius:10px;padding:14px;color:rgba(255,255,255,0.8);font-size:14px;line-height:1.7;white-space:pre-wrap;">${inquiry.description}</div>
        </div>
      `,
    });
  } catch (err: any) {
    console.error(`[notify] EMAIL_FAILED — inquiry notification: ${err?.message}`);
  }
}
