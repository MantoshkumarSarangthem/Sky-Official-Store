import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

const INQUIRY_TYPES = [
  { id: "order",   label: "Order Related",       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: "payment", label: "Payment Related",     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M16 14a1 1 0 110-2 1 1 0 010 2z" fill="currentColor"/><path d="M2 11h20" stroke="currentColor" strokeWidth="1.8"/></svg> },
  { id: "bug",     label: "Bug / Technical",     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 9a3 3 0 016 0v4a3 3 0 01-6 0V9z" stroke="currentColor" strokeWidth="1.8"/><path d="M12 3v3M6 6l2 2M18 6l-2 2M3 13h3M18 13h3M6 18l2-2M18 18l-2-2M12 19v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id: "other",   label: "Other",               icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
];

export default function SupportPage() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const [selectedType, setSelectedType] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const userName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.username ?? "";

  const handleSubmit = async () => {
    if (!selectedType) { setResult({ ok: false, msg: "Please select a problem type." }); return; }
    if (!description.trim()) { setResult({ ok: false, msg: "Please describe your problem." }); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, userName, inquiryType: selectedType, description }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: "Your inquiry has been submitted! We'll get back to you soon." });
        setSelectedType("");
        setDescription("");
      } else {
        setResult({ ok: false, msg: data.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      setResult({ ok: false, msg: "Network error. Please check your connection." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: 48 }}>
      <style>{`@keyframes supIn{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}`}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(10,10,10,0.94)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button onClick={() => setLocation("/")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Support / Inquiry</span>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "72px 16px 0" }}>

        <div style={{ textAlign: "center", paddingTop: 24, paddingBottom: 28, animation: "supIn 0.45s ease both" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ color: "#fff", fontWeight: 800, fontSize: 22, margin: "0 0 6px" }}>How can we help?</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0 }}>Tell us your issue and we'll get back to you as soon as possible.</p>
        </div>

        <div style={{ animation: "supIn 0.45s ease 0.08s both", opacity: 0 }}>

          <div style={{ marginBottom: 20 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Select problem type</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {INQUIRY_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  style={{
                    padding: "14px 12px",
                    borderRadius: 14,
                    border: selectedType === t.id ? "1.5px solid rgba(245,158,11,0.7)" : "1px solid rgba(255,255,255,0.1)",
                    background: selectedType === t.id ? "rgba(245,158,11,0.1)" : "#111",
                    color: selectedType === t.id ? "#f59e0b" : "rgba(255,255,255,0.65)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    fontWeight: 600,
                    fontSize: 13,
                    textAlign: "left",
                  }}
                >
                  <span style={{ color: selectedType === t.id ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Describe your problem</div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Please describe your issue in detail. Include order IDs, screenshots descriptions, or anything that helps us understand the problem..."
              rows={5}
              style={{ width: "100%", background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px 16px", color: "#fff", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box", transition: "border-color 0.2s" }}
              onFocus={e => (e.target.style.borderColor = "rgba(245,158,11,0.5)")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {userEmail && (
            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zM4 8l8 5 8-5" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Reply will be sent to <strong style={{ color: "#f59e0b" }}>{userEmail}</strong></span>
            </div>
          )}

          {result && (
            <div style={{ padding: "12px 16px", borderRadius: 12, background: result.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${result.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, color: result.ok ? "#4ade80" : "#f87171", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              {result.msg}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: submitting ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 800, fontSize: 15, border: "none", cursor: submitting ? "default" : "pointer", transition: "all 0.2s" }}
          >
            {submitting ? "Submitting…" : "Submit Inquiry"}
          </button>

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 16 }}>
            We typically respond within a few hours via WhatsApp or email.
          </p>
        </div>

        <FAQ />
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "How long does diamond delivery take?",
    a: "Diamonds are credited to your MLBB account within minutes of payment confirmation. During peak hours it may take up to 15 minutes — we'll keep you updated on WhatsApp.",
  },
  {
    q: "Which payment methods do you accept?",
    a: "We accept all UPI apps — Google Pay, PhonePe, Paytm, BHIM, and direct bank UPI transfers. Simply scan the QR code shown at checkout.",
  },
  {
    q: "What if I entered the wrong MLBB ID?",
    a: "Contact us on WhatsApp immediately with your order details. If diamonds haven't been delivered yet we can correct the account. If already delivered, please review our Refund Policy.",
  },
  {
    q: "Can I order without creating an account?",
    a: "You can browse all packages without signing in. A free account lets you track orders, save your MLBB ID for faster checkout, and view full order history.",
  },
];

function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div style={{ marginTop: 40, animation: "supIn 0.45s ease 0.15s both", opacity: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>Frequently Asked</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {FAQS.map((faq, i) => (
          <div
            key={i}
            style={{ background: "#111", border: `1px solid ${openIdx === i ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s ease" }}
          >
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ color: openIdx === i ? "#f59e0b" : "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.4, transition: "color 0.2s ease" }}>{faq.q}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: openIdx === i ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}>
                <path d="M6 9l6 6 6-6" stroke={openIdx === i ? "#f59e0b" : "rgba(255,255,255,0.35)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {openIdx === i && (
              <div style={{ padding: "0 16px 14px", color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.65 }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
