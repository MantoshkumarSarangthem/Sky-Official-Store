import { useState } from "react";
import { useLocation } from "wouter";
import { useCart } from "../context/CartContext";

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

export default function MLBBTargetPage() {
  const [, setLocation] = useLocation();
  const { items } = useCart();

  const gameNameFromCart = items.length > 0 ? (items[0].pkg.gameName ?? "") : "";
  const rawGameName = (gameNameFromCart || _targetGameName || "MLBB").toLowerCase();
  const isMlbb = rawGameName.includes("mlbb") || rawGameName.includes("mobile legend") || rawGameName === "";
  const displayGameName = gameNameFromCart || _targetGameName || "MLBB";

  const [userId, setUserId] = useState("");
  const [serverId, setServerId] = useState("");
  const [ign, setIgn] = useState("");
  const [error, setError] = useState("");

  const [uFocus, setUFocus] = useState(false);
  const [sFocus, setSFocus] = useState(false);
  const [iFocus, setIFocus] = useState(false);

  function handleContinue() {
    if (!userId.trim()) { setError("Please enter your User ID."); return; }
    if (isMlbb && !serverId.trim()) { setError("Please enter your Server ID."); return; }
    if (isMlbb && !ign.trim()) { setError("Please enter your in-game name."); return; }
    setError("");
    setMLBBTarget({ userId: userId.trim(), serverId: serverId.trim(), ign: ign.trim(), isForFriend: false, gameName: displayGameName });
    setLocation(_afterTargetPath);
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
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
  });

  const labelStyle: React.CSSProperties = {
    color: "rgba(61,43,31,0.55)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    marginBottom: 5,
    display: "block",
  };

  return (
    <div style={{ background: "#FAF9F6", minHeight: "100vh", paddingBottom: 60 }}>
      <style>{`
        @keyframes idIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .id-btn { width:100%;padding:15px 0;border-radius:14px;background:linear-gradient(135deg,#A89482 0%,#8D6E63 100%);color:#FAF9F6;font-weight:800;font-size:16px;border:none;cursor:pointer;box-shadow:0 5px 18px rgba(141,110,99,0.38);transition:transform 0.1s,box-shadow 0.1s; }
        .id-btn:hover { transform:translateY(-1px);box-shadow:0 7px 22px rgba(141,110,99,0.45); }
        .id-btn:active { transform:translateY(1px) scale(0.99);box-shadow:0 2px 8px rgba(141,110,99,0.3); }
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
          <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 10 }}>Enter your {displayGameName} account ID</div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 16px 0", animation: "idIn 0.3s ease both" }}>

        <div style={{ color: "#3D2B1F", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Enter your account details</div>
        <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 13, marginBottom: 24 }}>
          Make sure these are correct — we'll deliver your order to this account.
        </div>

        <div style={{ background: "#FFFFFF", borderRadius: 18, border: "1px solid rgba(197,180,162,0.35)", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(61,43,31,0.04)", marginBottom: 16 }}>
          {isMlbb ? (
            <>
              <div>
                <label style={labelStyle}>User ID</label>
                <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="e.g. 123456789" inputMode="numeric" style={inputStyle(uFocus)} onFocus={() => setUFocus(true)} onBlur={() => setUFocus(false)} />
              </div>
              <div>
                <label style={labelStyle}>Server ID</label>
                <input value={serverId} onChange={e => setServerId(e.target.value)} placeholder="e.g. 7211" inputMode="numeric" style={inputStyle(sFocus)} onFocus={() => setSFocus(true)} onBlur={() => setSFocus(false)} />
              </div>
              <div>
                <label style={labelStyle}>In-Game Name (IGN)</label>
                <input value={ign} onChange={e => setIgn(e.target.value)} placeholder="e.g. DragonSlayer" style={inputStyle(iFocus)} onFocus={() => setIFocus(true)} onBlur={() => setIFocus(false)} />
              </div>
            </>
          ) : (
            <div>
              <label style={labelStyle}>Player ID</label>
              <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="Enter your player ID" style={inputStyle(uFocus)} onFocus={() => setUFocus(true)} onBlur={() => setUFocus(false)} />
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 10, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button className="id-btn" onClick={handleContinue}>
          Continue to Payment →
        </button>

      </div>
    </div>
  );
}
