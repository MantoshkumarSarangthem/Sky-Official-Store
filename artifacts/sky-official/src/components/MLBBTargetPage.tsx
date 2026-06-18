import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useCart } from "../context/CartContext";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

export interface MLBBTarget {
  userId: string;
  serverId: string;
  ign: string;
  isForFriend: boolean;
  gameName?: string;
  currencyLabel?: string;
}

let _mlbbTarget: MLBBTarget | null = null;
export function setMLBBTarget(t: MLBBTarget | null) { _mlbbTarget = t; }
export function getMLBBTarget() { return _mlbbTarget; }

let _afterTargetPath = "/pay";
export function setAfterTargetPath(p: string) { _afterTargetPath = p; }

let _targetGameName = "";
export function setTargetGameName(name: string) { _targetGameName = name; }

function Field({
  label, hint, value, onChange, placeholder, inputMode,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <label style={{ color: "rgba(61,43,31,0.55)", fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>{label}</label>
        {hint && <span style={{ color: "rgba(61,43,31,0.35)", fontSize: 10 }}>{hint}</span>}
      </div>
      <input
        inputMode={inputMode}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "#FFFFFF",
          border: `1.5px solid ${focused ? "rgba(168,148,130,0.8)" : "rgba(197,180,162,0.45)"}`,
          borderRadius: 12,
          padding: "13px 14px",
          color: "#3D2B1F",
          fontSize: 15,
          outline: "none",
          width: "100%",
          fontFamily: "inherit",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

export default function MLBBTargetPage() {
  const [, setLocation] = useLocation();
  const { getToken, isSignedIn } = useAuth();
  const { items } = useCart();

  const gameNameFromCart = items.length > 0 ? (items[0].pkg.gameName ?? "") : "";
  const rawGameName = (gameNameFromCart || _targetGameName || "MLBB").toLowerCase();
  const isMlbb = rawGameName.includes("mlbb") || rawGameName.includes("mobile legend") || rawGameName === "";
  const displayGameName = gameNameFromCart || _targetGameName || "MLBB";

  const [userId, setUserId] = useState("");
  const [serverId, setServerId] = useState("");
  const [ign, setIgn] = useState("");
  const [error, setError] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !isMlbb) return;
    setLoading(true);
    const load = async () => {
      try {
        const token = await getToken();
        const r = await fetch(`${API}/verify/mlbb`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        const data = await r.json();
        if (data.ok && data.account) {
          setUserId(data.account.mlbb_user_id);
          setServerId(data.account.mlbb_server_id);
          setIgn(data.account.mlbb_ign);
          setAutoFilled(true);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [isSignedIn, isMlbb]);

  function handleContinue() {
    if (!userId.trim()) { setError("Please enter your User ID."); return; }
    if (isMlbb && !serverId.trim()) { setError("Please enter your Server ID."); return; }
    if (isMlbb && !ign.trim()) { setError("Please enter your in-game name."); return; }
    setError("");
    setMLBBTarget({
      userId: userId.trim(),
      serverId: serverId.trim(),
      ign: ign.trim(),
      isForFriend: false,
      gameName: displayGameName,
    });
    setLocation(_afterTargetPath);
  }

  return (
    <div style={{ background: "#FAF9F6", minHeight: "100vh", paddingBottom: 60 }}>
      <style>{`
        @keyframes idIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .id-continue-btn {
          width: 100%;
          padding: 15px 0;
          border-radius: 14px;
          background: linear-gradient(135deg, #A89482 0%, #8D6E63 100%);
          color: #FAF9F6;
          font-weight: 800;
          font-size: 16px;
          border: none;
          cursor: pointer;
          box-shadow: 0 5px 18px rgba(141,110,99,0.38), 0 2px 5px rgba(0,0,0,0.1);
          transition: transform 0.1s ease, box-shadow 0.1s ease;
          letter-spacing: 0.01em;
        }
        .id-continue-btn:hover {
          box-shadow: 0 7px 22px rgba(141,110,99,0.45);
          transform: translateY(-1px);
        }
        .id-continue-btn:active {
          transform: translateY(1px) scale(0.99);
          box-shadow: 0 2px 8px rgba(141,110,99,0.3);
        }
      `}</style>

      {/* Header */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(230,222,211,0.97)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(197,180,162,0.35)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button
          onClick={() => window.history.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Account Details</div>
          <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 10 }}>Where should we deliver your order?</div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "76px 16px 0", display: "flex", flexDirection: "column", gap: 16, animation: "idIn 0.35s ease both" }}>

        {/* Title */}
        <div style={{ paddingBottom: 4 }}>
          <div style={{ color: "#3D2B1F", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Enter your {displayGameName} details</div>
          <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 13, lineHeight: 1.5 }}>
            We'll deliver your order to this account. Make sure the details are correct.
          </div>
        </div>

        {/* Auto-fill banner */}
        {autoFilled && (
          <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.28)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="1.8"/></svg>
            <span style={{ color: "rgba(61,43,31,0.6)", fontSize: 12 }}>Pre-filled from your verified account — edit below if needed</span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <div style={{ width: 18, height: 18, border: "2px solid rgba(168,148,130,0.3)", borderTopColor: "#A89482", borderRadius: "50%", animation: "idIn 0.8s linear infinite", flexShrink: 0 }} />
            <span style={{ color: "rgba(61,43,31,0.4)", fontSize: 12 }}>Checking your verified account…</span>
          </div>
        )}

        {/* Form */}
        <div style={{ background: "#FFFFFF", borderRadius: 18, border: "1px solid rgba(197,180,162,0.35)", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(61,43,31,0.04)" }}>
          {isMlbb ? (
            <>
              <Field label="User ID" value={userId} onChange={setUserId} placeholder="e.g. 123456789" inputMode="numeric" />
              <Field label="Server ID" hint="(number in brackets next to your ID)" value={serverId} onChange={setServerId} placeholder="e.g. 7211" inputMode="numeric" />
              <Field label="In-Game Name (IGN)" hint="(your username in MLBB)" value={ign} onChange={setIgn} placeholder="e.g. DragonSlayer" />
            </>
          ) : (
            <Field label="Player ID" value={userId} onChange={setUserId} placeholder="Enter your player ID" />
          )}

          {/* MLBB hint */}
          {isMlbb && (
            <div style={{ background: "rgba(168,148,130,0.06)", border: "1px solid rgba(197,180,162,0.35)", borderRadius: 10, padding: "10px 13px", fontSize: 12, color: "rgba(61,43,31,0.5)", lineHeight: 1.5 }}>
              Find your User ID &amp; Server ID in MLBB → Profile → tap your avatar.
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 10, padding: "10px 14px", color: "#ef4444", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Continue button */}
        <button className="id-continue-btn" onClick={handleContinue}>
          Continue to Payment →
        </button>

      </div>
    </div>
  );
}
