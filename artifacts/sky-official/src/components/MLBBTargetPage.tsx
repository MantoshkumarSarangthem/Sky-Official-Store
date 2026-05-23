import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";

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

// Where to go after target is set (default: /pay)
let _afterTargetPath = "/pay";
export function setAfterTargetPath(p: string) { _afterTargetPath = p; }

type Mode = "choose" | "myself" | "friend";

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "#1a1a1a", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12,
          padding: "13px 14px", color: "#fff", fontSize: 15, outline: "none", width: "100%",
          fontFamily: "inherit", transition: "border-color 0.2s",
        }}
        onFocus={e => (e.target.style.borderColor = "rgba(245,158,11,0.65)")}
        onBlur={e => (e.target.style.borderColor = "rgba(245,158,11,0.25)")}
      />
    </div>
  );
}

export default function MLBBTargetPage() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [verifiedAccount, setVerifiedAccount] = useState<{ userId: string; serverId: string; ign: string } | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [friendId, setFriendId] = useState("");
  const [friendServer, setFriendServer] = useState("");
  const [friendIgn, setFriendIgn] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "myself") fetchVerified();
  }, [mode]);

  async function fetchVerified() {
    setLoadingAccount(true);
    try {
      const token = await getToken();
      const r = await fetch(`${API}/verify/mlbb`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await r.json();
      if (data.ok && data.account) {
        setVerifiedAccount({
          userId: data.account.mlbb_user_id,
          serverId: data.account.mlbb_server_id,
          ign: data.account.mlbb_ign,
        });
      } else {
        setVerifiedAccount(null);
      }
    } catch { setVerifiedAccount(null); }
    setLoadingAccount(false);
  }

  function continueMyself() {
    if (!verifiedAccount) return;
    setMLBBTarget({ ...verifiedAccount, isForFriend: false });
    setLocation(_afterTargetPath);
  }

  function continueFriend() {
    if (!friendId.trim() || !friendServer.trim() || !friendIgn.trim()) {
      setError("Please fill in all three fields.");
      return;
    }
    setError("");
    setMLBBTarget({ userId: friendId.trim(), serverId: friendServer.trim(), ign: friendIgn.trim(), isForFriend: true });
    setLocation(_afterTargetPath);
  }

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: 60 }}>
      <style>{`
        @keyframes tgtIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(245,158,11,0.12)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button
          onClick={() => mode === "choose" ? setLocation("/packages") : setMode("choose")}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Recharge Details</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>Who is this recharge for?</div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "76px 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Choose mode ── */}
        {mode === "choose" && (
          <>
            <div style={{ textAlign: "center", padding: "12px 0 8px", animation: "tgtIn 0.4s ease both" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(245,158,11,0.1)", border: "2px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" fill="#f59e0b"/></svg>
              </div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Who is this for?</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Choose below to continue with your recharge</div>
            </div>

            <button
              onClick={() => setMode("myself")}
              style={{ width: "100%", background: "#111", border: "1.5px solid rgba(245,158,11,0.3)", borderRadius: 18, padding: "20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", textAlign: "left", transition: "all 0.2s", animation: "tgtIn 0.4s ease 0.05s both" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.7)"; (e.currentTarget as HTMLElement).style.background = "#161000"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.3)"; (e.currentTarget as HTMLElement).style.background = "#111"; }}
            >
              <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" fill="#f59e0b"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 3 }}>For Myself</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Recharge your own MLBB account using your verified ID</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            <button
              onClick={() => setMode("friend")}
              style={{ width: "100%", background: "#111", border: "1.5px solid rgba(56,189,248,0.25)", borderRadius: 18, padding: "20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", textAlign: "left", transition: "all 0.2s", animation: "tgtIn 0.4s ease 0.1s both" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,189,248,0.6)"; (e.currentTarget as HTMLElement).style.background = "#00101a"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,189,248,0.25)"; (e.currentTarget as HTMLElement).style.background = "#111"; }}
            >
              <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 3 }}>For a Friend / Relative</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Enter your friend's MLBB User ID, Server ID, and IGN</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}

        {/* ── For myself ── */}
        {mode === "myself" && (
          <div style={{ animation: "tgtIn 0.35s ease both" }}>
            {loadingAccount ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                <div style={{ width: 32, height: 32, border: "2px solid rgba(245,158,11,0.3)", borderTopColor: "#f59e0b", borderRadius: "50%", margin: "0 auto 14px", animation: "np-ring 0.8s linear infinite" }} />
                Loading your account…
              </div>
            ) : verifiedAccount ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "linear-gradient(135deg,#0d1a00,#0a1200)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 18, padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="1.8"/></svg>
                    </div>
                    <div>
                      <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 13 }}>Verified Account</div>
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Diamonds will be sent here</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "IGN", value: verifiedAccount.ign },
                      { label: "User ID", value: verifiedAccount.userId },
                      { label: "Server ID", value: verifiedAccount.serverId },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{label}</span>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={continueMyself}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 14, background: "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}
                >
                  Continue to Payment →
                </button>
                <button
                  onClick={() => setLocation("/verify")}
                  style={{ width: "100%", padding: "12px 0", borderRadius: 14, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}
                >
                  Change verified account
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "16px 18px", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                  You haven't verified your MLBB account yet. Verify it first for faster recharges, or recharge for a friend's account below.
                </div>
                <button
                  onClick={() => setLocation("/verify")}
                  style={{ width: "100%", padding: "15px 0", borderRadius: 14, background: "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer" }}
                >
                  Verify My MLBB Account
                </button>
                <button
                  onClick={() => setMode("friend")}
                  style={{ width: "100%", padding: "12px 0", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer" }}
                >
                  Enter ID manually instead
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── For a friend ── */}
        {mode === "friend" && (
          <div style={{ animation: "tgtIn 0.35s ease both", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 18, padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 13 }}>Friend's MLBB Details</div>
              <InputField label="MLBB User ID" value={friendId} onChange={setFriendId} placeholder="e.g. 123456789" type="number" />
              <InputField label="Server ID" value={friendServer} onChange={setFriendServer} placeholder="e.g. 1234" type="number" />
              <InputField label="In-Game Name (IGN)" value={friendIgn} onChange={setFriendIgn} placeholder="e.g. DragonSlayer" />
              <div style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 10, padding: "10px 13px", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                ℹ️ Find the User ID and Server ID in MLBB → Profile → tap your avatar.
              </div>
            </div>
            {error && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", color: "#ef4444", fontSize: 13 }}>
                {error}
              </div>
            )}
            <button
              onClick={continueFriend}
              style={{ width: "100%", padding: "15px 0", borderRadius: 14, background: "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}
            >
              Continue to Payment →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
