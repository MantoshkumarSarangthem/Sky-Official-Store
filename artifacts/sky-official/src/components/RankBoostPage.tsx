import { useEffect, useRef, useState } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";
const WA_NUMBER_FALLBACK = "919362003788";

const RANK_ORDER = ["warrior","elite","master","epic","legend","mythic","mythic_honor","mythic_glory","mythic_immortal"] as const;
type RankKey = typeof RANK_ORDER[number];

const RANK_BASE: Record<RankKey, number> = {
  warrior: 0, elite: 10, master: 27, epic: 44, legend: 70,
  mythic: 96, mythic_honor: 121, mythic_glory: 146, mythic_immortal: 196,
};
const RANK_LABELS: Record<RankKey, string> = {
  warrior:"Warrior", elite:"Elite", master:"Master", epic:"Epic", legend:"Legend",
  mythic:"Mythic", mythic_honor:"Mythic Honor", mythic_glory:"Mythic Glory", mythic_immortal:"Mythic Immortal",
};

interface SubOption { value: string; label: string; }

function getTotalStars(rank: string, sub: string) { return (RANK_BASE[rank as RankKey] ?? 0) + parseInt(sub || "0"); }

function buildSubOptions(rank: string): SubOption[] {
  if (!rank) return [];
  if (["mythic","mythic_honor","mythic_glory","mythic_immortal"].includes(rank)) {
    const max = rank === "mythic_immortal" ? 100 : rank === "mythic_glory" ? 49 : 24;
    const label = RANK_LABELS[rank as RankKey];
    return Array.from({ length: max + 1 }, (_, s) => ({ value: String(s), label: `${label} — ${s} ★` }));
  }
  const divCount = rank === "warrior" ? 3 : (rank === "elite" || rank === "master") ? 4 : 5;
  const starCount = divCount;
  const rName = RANK_LABELS[rank as RankKey] ?? rank;
  const opts: SubOption[] = [];
  for (let lvl = divCount; lvl >= 1; lvl--)
    for (let s = 0; s < starCount; s++)
      opts.push({ value: String((divCount - lvl) * starCount + s), label: `${rName} ${lvl} — ${"★".repeat(s)}${"☆".repeat(starCount - s)} (${s}/${starCount})` });
  opts.push({ value: String(divCount * starCount), label: `${rName} 1 — ${"★".repeat(starCount)} (promotion ready)` });
  return opts;
}

function calcTieredBase(curT: number, tarT: number): number {
  const ZONE2 = 70, ZONE3 = 121, ZONE4 = 146;
  let price = 0;
  const z1 = Math.min(tarT, ZONE2) - Math.min(curT, ZONE2);
  if (z1 > 0) price += z1 * 5;
  const z2 = Math.min(tarT, ZONE3) - Math.min(Math.max(curT, ZONE2), ZONE3);
  if (z2 > 0) price += z2 * 10;
  const z3 = Math.min(tarT, ZONE4) - Math.min(Math.max(curT, ZONE3), ZONE4);
  if (z3 > 0) price += z3 * 15;
  const z4 = tarT - Math.max(curT, ZONE4);
  if (z4 > 0) price += z4 * 20;
  return price;
}

function calcPrice(curRank: string, curSub: string, tarRank: string, tarSub: string, service: "urgent" | "not-urgent") {
  if (!curRank || !tarRank) return null;
  const curT = getTotalStars(curRank, curSub), tarT = getTotalStars(tarRank, tarSub);
  if (tarT <= curT) return null;
  const stars = tarT - curT;
  const base = calcTieredBase(curT, tarT);
  const price = service === "urgent" ? Math.round(base * 1.2) : base;
  const note = service === "urgent" ? `${stars} stars (tiered rate) + 20% urgent` : `${stars} stars (tiered rate)`;
  return { stars, price, note };
}

const CARD: React.CSSProperties = {
  background: "#111316",
  border: "1px solid rgba(245,158,11,0.18)",
  borderRadius: 16,
  padding: "22px 20px",
  marginBottom: 14,
};
const LBL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
  display: "block", marginBottom: 8,
};
const INPUT: React.CSSProperties = {
  width: "100%", background: "#0d0d11",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  color: "#fff", fontSize: 16, padding: "12px 14px",
  outline: "none", boxSizing: "border-box",
  fontFamily: "inherit",
  WebkitAppearance: "none", appearance: "none",
  touchAction: "manipulation",
};
const SEL: React.CSSProperties = {
  ...INPUT,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%23f59e0b' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 13px center",
  paddingRight: 36,
  cursor: "pointer",
};
const BTN_BASE: React.CSSProperties = {
  border: "none", borderRadius: 14, padding: "16px 0",
  fontSize: 15, fontWeight: 800, cursor: "pointer",
  width: "100%", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  userSelect: "none",
};

function useIosSelectPoll(ref: React.RefObject<HTMLSelectElement | null>, setter: (v: string) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const poll = () => setTimeout(() => { if (ref.current) setter(ref.current.value); }, 150);
    (["touchstart","touchend","change","click"] as const).forEach(ev => el.addEventListener(ev, poll, { passive: true }));
    return () => (["touchstart","touchend","change","click"] as const).forEach(ev => el.removeEventListener(ev, poll));
  }, []);
}

function focusOn(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(245,158,11,0.6)";
  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(245,158,11,0.08)";
  (e.currentTarget as HTMLElement).style.background  = "#14120a";
}
function focusOff(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  (e.currentTarget as HTMLElement).style.boxShadow = "none";
  (e.currentTarget as HTMLElement).style.background  = "#0d0d11";
}

function StepHead({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 20 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000",
        fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {n}
      </div>
      <div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

export default function RankBoostPage({ onBack: _onBack }: { onBack?: () => void }) {
  const [service, setService] = useState<"urgent" | "not-urgent">("not-urgent");
  const [curRank, setCurRank] = useState("");
  const [curSub,  setCurSub]  = useState("0");
  const [tarRank, setTarRank] = useState("");
  const [tarSub,  setTarSub]  = useState("0");
  const [playerName, setPlayerName] = useState("");
  const [contact,    setContact]    = useState("");
  const [accountId,  setAccountId]  = useState("");
  const [notes,      setNotes]      = useState("");
  const [payment,    setPayment]    = useState("");
  const [agreed,     setAgreed]     = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState("");
  const [staffWA,    setStaffWA]    = useState(WA_NUMBER_FALLBACK);

  const curSubRef  = useRef<HTMLSelectElement>(null);
  const tarSubRef  = useRef<HTMLSelectElement>(null);
  const curRankRef = useRef<HTMLSelectElement>(null);
  const tarRankRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    fetch(`${API}/settings/qr`)
      .then(r => r.json())
      .then(d => { if (d.whatsapp) setStaffWA(d.whatsapp); })
      .catch(() => {});
  }, []);

  const curSubOpts = buildSubOptions(curRank);
  const tarSubOpts = buildSubOptions(tarRank);
  const priceResult = calcPrice(curRank, curSub, tarRank, tarSub, service);

  useEffect(() => { setCurSub(curSubOpts[0]?.value ?? "0"); }, [curRank]);
  useEffect(() => { setTarSub(tarSubOpts[0]?.value ?? "0"); }, [tarRank]);

  useIosSelectPoll(curRankRef, v => { if (v) setCurRank(v); });
  useIosSelectPoll(tarRankRef, v => { if (v) setTarRank(v); });
  useIosSelectPoll(curSubRef,  v => { if (v) setCurSub(v);  });
  useIosSelectPoll(tarSubRef,  v => { if (v) setTarSub(v);  });

  const buildWaMsg = () => {
    const curLabel = curSubOpts.find(o => o.value === curSub)?.label ?? curSub;
    const tarLabel = tarSubOpts.find(o => o.value === tarSub)?.label ?? tarSub;
    const payLabels: Record<string,string> = { upi:"UPI", bank:"Bank Transfer", crypto:"Crypto (USDT)" };
    const p = priceResult;
    return `🎮 *New MLBB Boost Order*
━━━━━━━━━━━━━━
👤 *Name/IGN:* ${playerName}
📱 *Contact:* ${contact}
⚡ *Urgency:* ${service === "urgent" ? "Urgent (ASAP) +20%" : "Not Urgent"}
📊 *Current:* ${curLabel}
🎯 *Target:* ${tarLabel}
⭐ *Stars to boost:* ${p?.stars ?? "?"}
💰 *Price:* ₹${p?.price ?? "?"}
💳 *Payment:* ${payLabels[payment] ?? payment}
${accountId ? `🆔 *Account ID:* ${accountId}` : ""}
${notes     ? `📝 *Notes:* ${notes}` : ""}
━━━━━━━━━━━━━━
✅ Ready to boost!`;
  };

  const handleSubmit = () => {
    setError("");
    if (!playerName.trim()) { setError("Please enter your name or IGN."); return; }
    if (!contact.trim())    { setError("Please enter your contact info."); return; }
    if (!curRank || !tarRank) { setError("Please select your current and target rank."); return; }
    if (!priceResult)       { setError("Target rank must be higher than current rank."); return; }
    if (!payment)           { setError("Please select a payment method."); return; }
    if (!agreed)            { setError("Please agree to the terms before submitting."); return; }
    setSubmitted(true);
    window.location.href = `https://wa.me/${staffWA}?text=${encodeURIComponent(buildWaMsg())}`;
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 60 }}>
      <style>{`
        @keyframes rbCardIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .rb-card { animation: rbCardIn 0.35s cubic-bezier(0.22,1,0.36,1) both; }
        .rb-card:nth-child(1){animation-delay:.04s}
        .rb-card:nth-child(2){animation-delay:.09s}
        .rb-card:nth-child(3){animation-delay:.14s}
        .rb-card:nth-child(4){animation-delay:.19s}
        select option { background:#111316; color:#fff; }
      `}</style>

      {/* ── Step 1: Urgency ─────────────────────────────────────────── */}
      <div className="rb-card" style={CARD}>
        <StepHead n={1} title="Choose Urgency" sub="Urgent: completed ASAP (+20%) · Not Urgent: standard delivery" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["not-urgent","urgent"] as const).map(type => (
            <button
              key={type}
              onClick={() => setService(type)}
              style={{
                background: service === type ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
                border: service === type ? "1.5px solid rgba(245,158,11,0.65)" : "1.5px solid rgba(255,255,255,0.12)",
                borderRadius: 12, padding: "16px 14px", cursor: "pointer",
                textAlign: "left", fontFamily: "inherit",
                touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <span style={{ fontSize: 22, display: "block", marginBottom: 8 }}>
                {type === "urgent" ? "⚡" : "🕐"}
              </span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: service === type ? "#f59e0b" : "#fff" }}>
                {type === "urgent" ? "Urgent (+20%)" : "Not Urgent"}
              </span>
              <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
                {type === "urgent" ? "Completed as soon as possible" : "Standard delivery time"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Step 2: Rank ─────────────────────────────────────────────── */}
      <div className="rb-card" style={CARD}>
        <StepHead n={2} title="Select Your Rank" sub="Where are you now, and where do you want to reach?" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={LBL}>Current Rank</label>
            <select ref={curRankRef} value={curRank}
              onChange={e => setCurRank(e.target.value)}
              style={SEL} onFocus={focusOn as any} onBlur={focusOff as any}>
              <option value="">Select rank...</option>
              {RANK_ORDER.map(r => <option key={r} value={r}>{RANK_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Current Level / Stars</label>
            <select ref={curSubRef} value={curSub}
              onChange={e => setCurSub(e.target.value)}
              disabled={!curRank}
              style={{ ...SEL, opacity: curRank ? 1 : 0.35, cursor: curRank ? "pointer" : "not-allowed" }}
              onFocus={focusOn as any} onBlur={focusOff as any}>
              {curRank
                ? curSubOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
                : <option value="0">— select rank first —</option>}
            </select>
          </div>
          <div>
            <label style={LBL}>Target Rank</label>
            <select ref={tarRankRef} value={tarRank}
              onChange={e => setTarRank(e.target.value)}
              style={SEL} onFocus={focusOn as any} onBlur={focusOff as any}>
              <option value="">Select rank...</option>
              {RANK_ORDER.filter(r => r !== "warrior").map(r => (
                <option key={r} value={r}>
                  {RANK_LABELS[r]}{r === "mythic_honor" ? " (25★)" : r === "mythic_glory" ? " (50★)" : r === "mythic_immortal" ? " (100★)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={LBL}>Target Level / Stars</label>
            <select ref={tarSubRef} value={tarSub}
              onChange={e => setTarSub(e.target.value)}
              disabled={!tarRank}
              style={{ ...SEL, opacity: tarRank ? 1 : 0.35, cursor: tarRank ? "pointer" : "not-allowed" }}
              onFocus={focusOn as any} onBlur={focusOff as any}>
              {tarRank
                ? tarSubOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
                : <option value="0">— select rank first —</option>}
            </select>
          </div>
        </div>

        {/* Price strip */}
        <div style={{
          background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>Estimated Price</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
              {priceResult
                ? priceResult.note
                : curRank && tarRank ? "⚠ Target must be higher" : "Select your ranks above"}
            </div>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 30, fontWeight: 700, letterSpacing: "-1px", whiteSpace: "nowrap",
            color: priceResult ? "#f59e0b" : "rgba(255,255,255,0.18)" }}>
            {priceResult ? `₹${priceResult.price}` : "—"}
          </div>
        </div>
      </div>

      {/* ── Step 3: Details ──────────────────────────────────────────── */}
      <div className="rb-card" style={CARD}>
        <StepHead n={3} title="Your Details" sub="We'll contact you on WhatsApp to confirm" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={LBL}>Name / IGN</label>
            <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
              placeholder="Your in-game name" autoComplete="name"
              style={INPUT} onFocus={focusOn as any} onBlur={focusOff as any} />
          </div>
          <div>
            <label style={LBL}>Contact (FB / TG / WA)</label>
            <input type="text" value={contact} onChange={e => setContact(e.target.value)}
              placeholder="e.g. @yourname" autoComplete="off"
              style={INPUT} onFocus={focusOn as any} onBlur={focusOff as any} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Account ID</label>
          <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)}
            placeholder="Your MLBB User ID — no password needed yet"
            inputMode="numeric" autoComplete="off"
            style={INPUT} onFocus={focusOn as any} onBlur={focusOff as any} />
        </div>
        <div>
          <label style={LBL}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Preferred heroes, schedule, special requests..."
            style={{ ...INPUT, resize: "vertical", minHeight: 80, lineHeight: 1.55 } as React.CSSProperties}
            onFocus={focusOn as any} onBlur={focusOff as any} />
        </div>
      </div>

      {/* ── Step 4: Payment ──────────────────────────────────────────── */}
      <div className="rb-card" style={CARD}>
        <StepHead n={4} title="Payment Method" sub="50% to start · 50% after your rank is boosted" />
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>How will you pay?</label>
          <select value={payment} onChange={e => setPayment(e.target.value)}
            style={SEL} onFocus={focusOn as any} onBlur={focusOff as any}>
            <option value="">Select payment method...</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank Transfer</option>
            <option value="crypto">Crypto (USDT)</option>
          </select>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 10, padding: "12px 16px",
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🔒</span>
          <div>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>Safe Payment Policy</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>Pay 50% upfront · Remaining 50% only after boost is complete</div>
          </div>
        </div>
      </div>

      {/* ── Terms ────────────────────────────────────────────────────── */}
      <div
        onClick={() => setAgreed(v => !v)}
        style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18,
          padding: "0 2px", cursor: "pointer", touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent", userSelect: "none" }}
      >
        <div style={{
          width: 22, height: 22, minWidth: 22, borderRadius: 6, marginTop: 1, flexShrink: 0,
          background: agreed ? "#f59e0b" : "rgba(255,255,255,0.05)",
          border: agreed ? "none" : "1.5px solid rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.15s",
        }}>
          {agreed && <svg width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1 4l3 3 6-6" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.6 }}>
          I understand that boosting carries a minor risk and agree to the 50% upfront payment policy. My account password will only be requested after payment is confirmed.
        </span>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      <button onClick={handleSubmit} style={{
        ...BTN_BASE,
        background: submitted ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg,#fcd34d,#f59e0b)",
        color: submitted ? "#22c55e" : "#000",
        border: submitted ? "1px solid rgba(34,197,94,0.3)" : "none",
        boxShadow: submitted ? "none" : "0 0 24px rgba(245,158,11,0.28)",
      }}>
        {submitted ? "✅ Order Details Sent" : "Send Order Details 🚀"}
      </button>

      <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 16, lineHeight: 1.6 }}>
        Your order goes directly to our WhatsApp.<br />We confirm within 1 hour. ✅
      </p>
    </div>
  );
}
