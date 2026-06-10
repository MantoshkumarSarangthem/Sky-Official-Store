import { useState, useRef, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { getMLBBTarget } from "./MLBBTargetPage";
import { useCart } from "../context/CartContext";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";
const UPI_ID_FALLBACK = "mk1108477-1@okhdfcbank";
const UPI_NAME = "Mantoshkumar Sarangthem";
const QR_FALLBACK = "/upi-qr.jpg";
const PAYMENT_TIMEOUT = 5 * 60; // 300 seconds

export interface SelectedPackage {
  id: number;
  diamonds: number;
  bonus_diamonds: number;
  price: string;
  old_price?: string | null;
  name: string | null;
  category: string | null;
  image?: string | null;
  gameName?: string;
  currencyLabel?: string;
}

let _selectedPackage: SelectedPackage | null = null;
export function setSelectedPackage(pkg: SelectedPackage | null) { _selectedPackage = pkg; }
export function getSelectedPackage() { return _selectedPackage; }

let _walletTopupAmount = 0;
export function setWalletTopupAmount(n: number) { _walletTopupAmount = n; }
export function getWalletTopupAmount() { return _walletTopupAmount; }

function InfoRow({ label, value, mono, accent, action }: { label: string; value: string; mono?: boolean; accent?: boolean; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid rgba(197,180,162,0.25)", gap: 8 }}>
      <span style={{ color: "rgba(61,43,31,0.45)", fontSize: 13, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ color: accent ? "#A89482" : "#3D2B1F", fontWeight: mono ? 600 : 700, fontSize: 13, fontFamily: mono ? "'Courier New', monospace" : undefined, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
        {action}
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} style={{ background: copied ? "rgba(34,197,94,0.12)" : "rgba(141,110,99,0.1)", border: `1px solid ${copied ? "rgba(34,197,94,0.35)" : "rgba(197,180,162,0.6)"}`, borderRadius: 6, padding: "4px 11px", color: copied ? "#22c55e" : "#8D6E63", fontWeight: 700, fontSize: 11, cursor: "pointer", transition: "all 0.2s", flexShrink: 0 }}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CountdownBadge({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const urgent = seconds <= 60;
  const label = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: urgent ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.10)",
      border: `1px solid ${urgent ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.28)"}`,
      borderRadius: 20, padding: "5px 14px",
      animation: urgent ? "urgentPulse 1s ease-in-out infinite" : "none",
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={urgent ? "#ef4444" : "#f59e0b"} strokeWidth="2"/>
        <path d="M12 7v5l3 3" stroke={urgent ? "#ef4444" : "#f59e0b"} strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <span style={{ color: urgent ? "#ef4444" : "#f59e0b", fontSize: 13, fontWeight: 800, fontFamily: "'Courier New', monospace", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ color: urgent ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.35)", fontSize: 11 }}>left</span>
    </div>
  );
}

export default function PaymentPage() {
  const [, setLocation] = useLocation();
  const { getToken, isSignedIn } = useAuth();
  const { items: cartItems, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderIds, setOrderIds] = useState<number[]>([]);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [upiOpened, setUpiOpened] = useState(false);
  const [qrSrc, setQrSrc] = useState<string>(QR_FALLBACK);
  const [upiId, setUpiId] = useState(UPI_ID_FALLBACK);
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_TIMEOUT);
  const [expired, setExpired] = useState(false);
  const [wc] = useState<{ orderId: number | null; displayId: string; diamonds: number; price: string; userId: string; currencyLabel: string; gameName: string } | null>(() => {
    const raw = sessionStorage.getItem("walletConfirm");
    if (!raw) return null;
    sessionStorage.removeItem("walletConfirm");
    try { return JSON.parse(raw); } catch { return null; }
  });

  // When arriving from a wallet payment, jump straight to the success screen
  useEffect(() => {
    if (wc) {
      setOrderId(wc.orderId);
      setSubmitted(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pkg = _selectedPackage;
  const target = getMLBBTarget();
  const isCartMode = pkg?.id === 0;
  const pkgGameName = pkg?.gameName || target?.gameName || "";
  const isMlbbPkg = !pkgGameName || pkgGameName.toLowerCase().includes("mobile legends") || pkgGameName.toLowerCase().includes("mlbb") || pkgGameName.toLowerCase().includes("bang bang");
  const currLabel = pkg?.currencyLabel || "Diamonds";
  const pkgIcon = pkg?.image || "/diamond.png";
  const [walletTopupAmt] = useState<number>(() => {
    const stored = Number(sessionStorage.getItem("walletTopupAmount") ?? 0);
    if (stored > 0) sessionStorage.removeItem("walletTopupAmount");
    return stored;
  });
  const isWalletTopup = walletTopupAmt > 0;

  useEffect(() => {
    fetch(`${API}/settings/qr`)
      .then(r => r.json())
      .then(data => { if (data.qr) setQrSrc(data.qr); if (data.upi_id) setUpiId(data.upi_id); })
      .catch(() => {});
  }, []);

  // 5-minute countdown
  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted]);

  const refId = useMemo(() => `${Date.now()}`, []);
  const remark = useMemo(() => `SKY-${refId.slice(-8)}`, [refId]);

  if (!pkg && !isWalletTopup && !wc) {
    setTimeout(() => setLocation("/packages"), 0);
    return null;
  }

  const amount = isWalletTopup ? walletTopupAmt : Number(pkg?.price ?? 0);
  const upiParams = `pa=${upiId}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(remark)}`;
  const upiLink     = `upi://pay?${upiParams}`;
  const phonePeLink = `phonepe://pay?${upiParams}`;
  const gpayLink    = `tez://upi/pay?${upiParams}`;
  const paytmLink   = `paytmmp://pay?${upiParams}`;

  const intentLink = `intent://pay?${upiParams}#Intent;scheme=upi;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;

  function downloadQR() {
    const a = document.createElement("a");
    a.href = qrSrc;
    a.download = "SkyOfficial-UPI-QR.jpg";
    a.click();
  }

  function openUPI(link: string) {
    setUpiOpened(true);
    window.location.href = link;
  }

  async function confirmOrder() {
    if (!pkg && !isWalletTopup) return;
    setSubmitting(true);
    setError("");
    try {
      const token = isSignedIn ? await getToken() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (isWalletTopup) {
        const r = await fetch(`${API}/wallet/topup`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ amount: walletTopupAmt, remark }),
        });
        const data = await r.json();
        if (r.ok) {
          setSubmitted(true);
        } else {
          setError(data.error ?? "Could not submit top-up request. Please try again.");
        }
        setSubmitting(false);
        return;
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
      return;
    }
    try {
      if (!pkg) { setSubmitting(false); return; }
      const token = isSignedIn ? await getToken() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const basePayload = {
        refId,
        remark,
        mlbbUserId: target?.userId,
        mlbbServerId: target?.serverId,
        mlbbIgn: target?.ign,
        isForFriend: target?.isForFriend,
      };

      if (isCartMode && cartItems.length > 0) {
        const r = await fetch(`${API}/orders/cart`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            ...basePayload,
            items: cartItems.map(i => ({
              packageId: i.pkg.id,
              quantity: i.quantity,
              diamonds: i.pkg.diamonds,
              price: i.pkg.price,
            })),
          }),
        });
        const data = await r.json();
        if (data.ok) {
          setOrderIds(data.ids ?? []);
          setSubmitted(true);
          clearCart();
          setSelectedPackage(null);
        } else {
          setError(data.error ?? "Could not submit order. Please try again.");
        }
      } else {
        const r = await fetch(`${API}/orders`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ packageId: pkg.id, ...basePayload }),
        });
        const data = await r.json();
        if (data.ok || data.id) {
          setOrderId(data.id ?? null);
          setSubmitted(true);
        } else {
          setError(data.error ?? "Could not submit order. Please try again.");
        }
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    }
    setSubmitting(false);
  }

  // ── Success screen ──────────────────────────────────────────────────────
  if (submitted) {
    // Resolve display values — wallet confirm (wc) takes priority over UPI flow
    const successDiamonds = wc ? wc.diamonds : pkg?.diamonds;
    const successCurrLabel = wc ? (wc.currencyLabel || "Diamonds") : currLabel;
    const successAmount = wc ? parseFloat(wc.price) : amount;
    const successReference = wc?.displayId ?? remark;
    const successUserId = wc ? wc.userId : (target?.ign ? `${target.ign} (${target.userId})` : target?.userId ?? "");
    const isWalletOrder = !!wc;

    return (
      <div style={{ background: "#FAF9F6", minHeight: "100vh", paddingBottom: 48 }}>
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(230,222,211,0.97)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(197,180,162,0.35)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
          <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 16 }}>Order Submitted</div>
        </div>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "88px 16px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#3D2B1F", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>{isWalletTopup ? "Top-up Submitted!" : "Order Placed!"}</div>
            <div style={{ color: "rgba(61,43,31,0.55)", fontSize: 13, lineHeight: 1.6 }}>
              {isWalletTopup
                ? <>Your wallet top-up of <strong style={{ color: "#A89482" }}>₹{walletTopupAmt}</strong> has been submitted. Funds will be added once payment is verified.</>
                : isCartMode
                  ? `Your cart order (${orderIds.length} order${orderIds.length !== 1 ? "s" : ""}) has been submitted. Diamonds will be delivered once payment is confirmed.`
                  : <>Your order for <strong style={{ color: "#A89482" }}>{successDiamonds?.toLocaleString()} {successCurrLabel}</strong> has been submitted. {successCurrLabel} will be delivered once payment is confirmed.</>
              }
            </div>
          </div>
          <div style={{ width: "100%", background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.4)", borderRadius: 18, padding: "4px 20px", boxShadow: "0 2px 8px rgba(61,43,31,0.04)" }}>
            {orderId && <InfoRow label="Order ID" value={`#${orderId}`} />}
            {orderIds.length > 0 && <InfoRow label="Order IDs" value={orderIds.map(id => `#${id}`).join(", ")} />}
            <InfoRow label="Reference" value={successReference} mono />
            {isWalletTopup
              ? <InfoRow label="Top-up Amount" value={`₹${walletTopupAmt.toLocaleString("en-IN")}`} accent />
              : <><InfoRow label={successCurrLabel} value={`${successDiamonds?.toLocaleString()}`} accent />
                 <InfoRow label="Amount" value={`₹${successAmount.toLocaleString("en-IN")}`} accent /></>
            }
            {successUserId && !isWalletTopup && <InfoRow label={(() => { const n = pkgGameName.toLowerCase(); if (n.includes("pubg") || n.includes("bgmi")) return "PUBG/BGMI Account"; if (n.includes("free fire") || n.includes("freefire")) return "Free Fire Account"; if (n.includes("clash")) return "Clash Account"; if (n.includes("cod") || n.includes("call of duty")) return "CoD Account"; if (n.includes("genshin")) return "Genshin Account"; return "MLBB Account"; })()} value={successUserId} />}
            {!isWalletOrder && target?.isForFriend && <InfoRow label="For" value="Friend / Relative" />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 11 }}>
              <span style={{ color: "rgba(61,43,31,0.45)", fontSize: 13 }}>Status</span>
              <span style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 700, fontSize: 11, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(245,158,11,0.22)" }}>Pending</span>
            </div>
          </div>
          <div style={{ width: "100%", background: "rgba(168,148,130,0.07)", border: "1px solid rgba(197,180,162,0.4)", borderRadius: 14, padding: "12px 16px", fontSize: 13, color: "rgba(61,43,31,0.55)", lineHeight: 1.6 }}>
            💬 Need help? Chat with us on WhatsApp for instant support.
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {isWalletTopup
              ? <button onClick={() => setLocation("/profile")} style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "#A89482", color: "#FAF9F6", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer" }}>Back to Profile</button>
              : <><button onClick={() => setLocation("/orders")} style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "#7F00FF", color: "#FFFFFF", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(127,0,255,0.35)" }}>View My Orders</button>
                 <button onClick={() => setLocation("/packages")} style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "rgba(61,43,31,0.04)", border: "1px solid rgba(197,180,162,0.4)", color: "rgba(61,43,31,0.55)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Buy More</button></>
            }
          </div>
        </div>
      </div>
    );
  }

  // ── Expired screen ──────────────────────────────────────────────────────
  if (expired) {
    return (
      <div style={{ background: "#FAF9F6", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
            <path d="M12 7v6" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="1" fill="#ef4444"/>
          </svg>
        </div>
        <div style={{ color: "#3D2B1F", fontWeight: 800, fontSize: 22, textAlign: "center", marginBottom: 10 }}>Session Expired</div>
        <div style={{ color: "rgba(61,43,31,0.55)", fontSize: 14, textAlign: "center", lineHeight: 1.6, marginBottom: 28, maxWidth: 300 }}>
          The payment window has expired. Please go back and start a new transaction.
        </div>
        <button
          onClick={() => setLocation(isWalletTopup ? "/profile" : isCartMode ? "/cart" : "/packages")}
          style={{ padding: "14px 36px", borderRadius: 14, background: "#8D6E63", color: "#FFFFFF", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(141,110,99,0.35)" }}
        >
          Go Back
        </button>
      </div>
    );
  }

  // ── Payment screen ──────────────────────────────────────────────────────
  return (
    <div style={{ background: "#FAF9F6", minHeight: "100vh", paddingBottom: 60 }}>
      <style>{`
        @keyframes payIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes qrPulse { 0%,100%{box-shadow:0 0 0 0 rgba(168,148,130,0)} 50%{box-shadow:0 0 0 8px rgba(168,148,130,0.12)} }
        @keyframes confirmBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes urgentPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>

      {/* Header */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(230,222,211,0.97)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(197,180,162,0.35)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button onClick={() => setLocation(isWalletTopup ? "/profile" : isCartMode ? "/cart" : "/packages")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", border: "1.5px solid rgba(197,180,162,0.5)", flexShrink: 0 }}>
            <img src="/logo.webp" alt="Sky Official" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Sky Official</div>
            <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 10 }}>Secure UPI Payment</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "4px 10px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>Secure</span>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "72px 14px 0", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── Amount Card ── */}
        <div style={{ background: "#FFFFFF", border: "1.5px solid rgba(197,180,162,0.4)", borderRadius: 20, padding: "20px 20px 18px", animation: "payIn 0.4s ease both", boxShadow: "0 2px 10px rgba(61,43,31,0.05)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Amount to be paid</div>
            <div style={{ color: "#3D2B1F", fontWeight: 900, fontSize: 46, letterSpacing: "-1px", lineHeight: 1 }}>₹{amount.toLocaleString("en-IN")}</div>
            <div style={{ color: "rgba(61,43,31,0.5)", fontSize: 13, marginTop: 8 }}>
              {isWalletTopup ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <img src="/scoin.png" alt="S" style={{ width: 14, height: 14, objectFit: "contain", display: "inline-block" }} />
                  ₹{walletTopupAmt} will be added to your wallet
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <img src={pkgIcon} alt="♦" style={{ width: 14, height: 14, objectFit: "contain", display: "inline-block", borderRadius: pkg?.image ? 3 : 0 }} />
                  {isCartMode
                    ? <>{pkg?.diamonds.toLocaleString()} {currLabel} total · {cartItems.reduce((s, i) => s + i.quantity, 0)} packs</>
                    : <>{pkg?.diamonds.toLocaleString()} {currLabel} {(pkg?.bonus_diamonds ?? 0) > 0 && <span style={{ color: "#4ade80" }}>+{pkg?.bonus_diamonds.toLocaleString()} bonus</span>}</>
                  }
                </span>
              )}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
              <CountdownBadge seconds={secondsLeft} />
            </div>
          </div>
        </div>

        {/* ── Cart items breakdown (cart mode only) ── */}
        {isCartMode && cartItems.length > 0 && (
          <div style={{ background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.4)", borderRadius: 20, padding: "4px 20px", animation: "payIn 0.4s ease 0.04s both", boxShadow: "0 2px 8px rgba(61,43,31,0.04)" }}>
            <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 0 4px" }}>Cart Summary</div>
            {cartItems.map(item => (
              <div key={item.pkg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(197,180,162,0.2)" }}>
                <span style={{ color: "#3D2B1F", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><img src="/diamond.png" alt="♦" style={{ width: 13, height: 13, objectFit: "contain" }} />{item.pkg.diamonds.toLocaleString()} × {item.quantity}</span>
                <span style={{ color: "#A89482", fontWeight: 700, fontSize: 13 }}>₹{(parseFloat(item.pkg.price) * item.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Order Details Card ── */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.4)", borderRadius: 20, padding: "4px 20px 4px", animation: "payIn 0.4s ease 0.06s both", boxShadow: "0 2px 8px rgba(61,43,31,0.04)" }}>
          <InfoRow label="Order ID" value={refId} mono />
          <InfoRow label="Remark" value={remark} mono action={<CopyBtn text={remark} />} />
          <InfoRow label="Payee UPI" value={upiId} mono action={<CopyBtn text={upiId} />} />
          {target && (
            <>
              {target.ign && <InfoRow label={isMlbbPkg ? "MLBB IGN" : "IGN / Username"} value={target.ign} />}
              <InfoRow label={isMlbbPkg ? "MLBB ID" : "Player ID"} value={target.userId} mono />
              {target.serverId && <InfoRow label={isMlbbPkg ? "Zone ID" : "Server ID"} value={target.serverId} mono />}
              {target.isForFriend && <InfoRow label="Recharge For" value="Friend / Relative" accent />}
            </>
          )}
        </div>

        {/* ── QR Card ── */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.4)", borderRadius: 20, overflow: "hidden", animation: "payIn 0.4s ease 0.12s both", boxShadow: "0 2px 8px rgba(61,43,31,0.04)" }}>
          <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(197,180,162,0.25)" }}>
            <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Scan & Pay</div>
            <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 11 }}>Use any UPI app to scan this QR code</div>
          </div>

          {/* QR Image */}
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 24px 12px" }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, animation: "qrPulse 3s ease-in-out infinite" }}>
              <img
                src={qrSrc}
                alt="UPI QR Code"
                style={{ width: 200, height: 200, display: "block", borderRadius: 6, objectFit: "contain" }}
                onError={() => setQrSrc(QR_FALLBACK)}
              />
            </div>
          </div>

          {/* Download QR */}
          <div style={{ padding: "0 20px 16px" }}>
            <button onClick={downloadQR} style={{ width: "100%", padding: "10px 0", borderRadius: 12, background: "rgba(61,43,31,0.04)", border: "1.5px solid rgba(197,180,162,0.45)", color: "#3D2B1F", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3v14m-7-7l7 7 7-7" stroke="#3D2B1F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="19" width="18" height="2" rx="1" fill="#3D2B1F"/></svg>
              Download QR
            </button>
          </div>

          {/* UPI App Buttons */}
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Or open directly in app</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {/* PhonePe */}
              <button
                onClick={() => openUPI(phonePeLink)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(95,55,240,0.1)", border: "1.5px solid rgba(95,55,240,0.35)", cursor: "pointer", transition: "all 0.18s" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 2 }}>
                  <img src="/phonepe.jpg" alt="PhonePe" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 12 }}>PhonePe</span>
              </button>

              {/* GPay */}
              <button
                onClick={() => openUPI(gpayLink)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(66,133,244,0.1)", border: "1.5px solid rgba(66,133,244,0.35)", cursor: "pointer", transition: "all 0.18s" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 2 }}>
                  <img src="/gpay.jpg" alt="GPay" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 12 }}>Google Pay</span>
              </button>

              {/* Paytm */}
              <button
                onClick={() => openUPI(paytmLink)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(0,186,127,0.08)", border: "1.5px solid rgba(0,186,127,0.3)", cursor: "pointer", transition: "all 0.18s" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 2 }}>
                  <img src="/paytm.jpg" alt="Paytm" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <span style={{ color: "#34d399", fontWeight: 700, fontSize: 12 }}>Paytm</span>
              </button>

              {/* Other UPI — triggers phone's native app picker */}
              <button
                onClick={() => openUPI(intentLink)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.28)", cursor: "pointer", transition: "all 0.18s" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.5" fill="#f59e0b"/><circle cx="12" cy="12" r="1.5" fill="#f59e0b"/><circle cx="19" cy="12" r="1.5" fill="#f59e0b"/></svg>
                </div>
                <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 12 }}>Other UPI</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Confirm Order ── */}
        <div style={{ background: upiOpened ? "rgba(34,197,94,0.04)" : "#FFFFFF", border: `1.5px solid ${upiOpened ? "rgba(34,197,94,0.35)" : "rgba(197,180,162,0.4)"}`, borderRadius: 20, padding: "18px 20px", animation: "payIn 0.4s ease 0.18s both", transition: "all 0.4s ease", boxShadow: "0 2px 8px rgba(61,43,31,0.04)" }}>
          {upiOpened ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 14 }}>Payment done?</div>
                  <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 11, marginTop: 1 }}>Tap below to confirm your order — no UTR needed</div>
                </div>
              </div>
              {error && (
                <div style={{ marginBottom: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "9px 13px", color: "#ef4444", fontSize: 13 }}>
                  {error}
                </div>
              )}
              <button onClick={confirmOrder} disabled={submitting} style={{ width: "100%", padding: "15px 0", borderRadius: 14, background: submitting ? "rgba(34,197,94,0.2)" : "linear-gradient(135deg,#4ade80,#22c55e)", color: submitting ? "rgba(0,0,0,0.4)" : "#000", fontWeight: 800, fontSize: 16, border: "none", cursor: submitting ? "default" : "pointer", transition: "all 0.2s", boxShadow: submitting ? "none" : "0 4px 20px rgba(34,197,94,0.25)", animation: submitting ? "none" : "confirmBounce 2s ease-in-out infinite" }}>
                {submitting ? "Confirming…" : "✓ I've Paid — Confirm Order"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", color: "rgba(61,43,31,0.45)", fontSize: 13, padding: "4px 0" }}>
              <span style={{ fontSize: 18 }}>👆</span>
              <div style={{ marginTop: 6 }}>Open a UPI app above to pay, then confirm your order here</div>
            </div>
          )}
        </div>

        {/* ── Safety Note ── */}
        <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 14, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start", animation: "payIn 0.4s ease 0.24s both" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p style={{ color: "rgba(61,43,31,0.45)", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
            Only pay to UPI ID <strong style={{ color: "rgba(61,43,31,0.7)" }}>{upiId}</strong>. Always verify before paying.
          </p>
        </div>

      </div>
    </div>
  );
}
