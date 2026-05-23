import { useUser, useSignIn } from "@clerk/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

interface ProfileStats {
  total_orders: number;
  total_diamonds: number;
  total_spent: number;
  wallet_balance: number;
}

interface WalletTx {
  id: number;
  amount: string;
  type: string;
  status: string;
  upi_ref: string | null;
  description: string | null;
  created_at: string;
}

function DiamondIcon({ size = 18, color = "#f59e0b" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <defs>
        <linearGradient id="dp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>
      <polygon points="18,2 34,14 18,34 2,14" fill="url(#dp)" />
      <polygon points="18,2 26,10 18,14 10,10" fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { signIn } = useSignIn();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupMsg, setTopupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"name"|"password"|"photo">("name");
  const [newName, setNewName] = useState("");
  const [curPassword, setCurPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [fpStep, setFpStep] = useState(0);
  const [fpCode, setFpCode] = useState("");
  const [fpNewPw, setFpNewPw] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropImgEl, setCropImgEl] = useState<HTMLImageElement | null>(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropScale, setCropScale] = useState(1);
  const cropDragRef = useRef<{ startX: number; startY: number; startOx: number; startOy: number } | null>(null);
  const CROP_SIZE = 220;

  const handleCropMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    cropDragRef.current = { startX: e.clientX, startY: e.clientY, startOx: cropOffset.x, startOy: cropOffset.y };
  }, [cropOffset]);

  const handleCropMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cropDragRef.current) return;
    setCropOffset({ x: cropDragRef.current.startOx + e.clientX - cropDragRef.current.startX, y: cropDragRef.current.startOy + e.clientY - cropDragRef.current.startY });
  }, []);

  const handleCropTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    cropDragRef.current = { startX: t.clientX, startY: t.clientY, startOx: cropOffset.x, startOy: cropOffset.y };
  }, [cropOffset]);

  const handleCropTouchMove = useCallback((e: React.TouchEvent) => {
    if (!cropDragRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    setCropOffset({ x: cropDragRef.current.startOx + t.clientX - cropDragRef.current.startX, y: cropDragRef.current.startOy + t.clientY - cropDragRef.current.startY });
  }, []);

  const handleCropEnd = useCallback(() => { cropDragRef.current = null; }, []);

  const openCropForFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight);
      setCropImgEl(img);
      setCropScale(Math.max(scale, 0.5));
      setCropOffset({ x: 0, y: 0 });
      setCropSrc(url);
    };
    img.src = url;
  }, [CROP_SIZE]);

  const confirmCrop = useCallback(async () => {
    if (!cropImgEl || !user) return;
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = CROP_SIZE;
      canvas.height = CROP_SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      const imgW = cropImgEl.naturalWidth * cropScale;
      const imgH = cropImgEl.naturalHeight * cropScale;
      ctx.drawImage(cropImgEl, CROP_SIZE / 2 - imgW / 2 + cropOffset.x, CROP_SIZE / 2 - imgH / 2 + cropOffset.y, imgW, imgH);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("Crop failed");
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      await user.setProfileImage({ file });
      setSettingsMsg({ ok: true, text: "Profile photo updated!" });
      setCropSrc(null);
      setCropImgEl(null);
    } catch (err: any) {
      setSettingsMsg({ ok: false, text: err?.errors?.[0]?.message || "Failed to update photo." });
    } finally {
      setSettingsSaving(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }, [cropImgEl, cropScale, cropOffset, user, CROP_SIZE]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    Promise.all([
      fetch(`${API}/profile`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/wallet/balance`, { credentials: "include" }).then(r => r.json()),
    ]).then(([prof, wallet]) => {
      setStats(prof);
      setTransactions(wallet.transactions ?? []);
    }).finally(() => setLoading(false));
  }, [isLoaded, user]);

  useEffect(() => {
    if (isLoaded && !user) setLocation("/sign-in");
  }, [isLoaded, user]);


  if (!isLoaded || !user) return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Loading…</div>
    </div>
  );

  const displayName = user.firstName || user.username || user.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Player";


  const statusColor: Record<string, string> = {
    pending: "#f59e0b",
    approved: "#22c55e",
    rejected: "#ef4444",
    completed: "#22c55e",
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: 48 }}>
      <style>{`
        @keyframes profIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Header bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(10,10,10,0.93)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button onClick={() => setLocation("/")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, flex: 1 }}>My Profile</span>
        <button
          onClick={() => { setShowSettings(true); setNewName(displayName); setSettingsMsg(null); setSettingsTab("name"); }}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#111316", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", boxShadow: "0 -20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Account Settings</span>
              <button onClick={() => setShowSettings(false)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              {(["name","password","photo"] as const).map(tab => (
                <button key={tab} onClick={() => { setSettingsTab(tab); setSettingsMsg(null); }}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: settingsTab === tab ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
                    color: settingsTab === tab ? "#f59e0b" : "rgba(255,255,255,0.4)",
                    outline: settingsTab === tab ? "1px solid rgba(245,158,11,0.4)" : "none",
                  }}>
                  {tab === "name" ? "Display Name" : tab === "password" ? "Password" : "Photo"}
                </button>
              ))}
            </div>

            {settingsMsg && (
              <div style={{ marginBottom: 14, background: settingsMsg.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${settingsMsg.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 10, padding: "10px 14px", color: settingsMsg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>
                {settingsMsg.text}
              </div>
            )}

            {settingsTab === "name" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 4 }}>Change your display name shown across the app.</div>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="New display name"
                  style={{ background: "#0d0d11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "12px 14px", outline: "none", fontFamily: "inherit" }}
                />
                <button
                  disabled={settingsSaving}
                  onClick={async () => {
                    if (!newName.trim()) return;
                    setSettingsSaving(true); setSettingsMsg(null);
                    try {
                      await user.update({ firstName: newName.trim() });
                      await user.reload();
                      setSettingsMsg({ ok: true, text: "Display name updated!" });
                    } catch (e: any) {
                      setSettingsMsg({ ok: false, text: e?.errors?.[0]?.message || "Failed to update name." });
                    } finally { setSettingsSaving(false); }
                  }}
                  style={{ padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                >
                  {settingsSaving ? "Saving…" : "Save Name"}
                </button>
              </div>
            )}

            {settingsTab === "password" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 4 }}>Update your password. Only available if you signed up with email.</div>
                <input
                  type="password"
                  value={curPassword}
                  onChange={e => setCurPassword(e.target.value)}
                  placeholder="Current password"
                  autoComplete="current-password"
                  style={{ background: "#0d0d11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "12px 14px", outline: "none", fontFamily: "inherit" }}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min. 8 characters)"
                  autoComplete="new-password"
                  style={{ background: "#0d0d11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "12px 14px", outline: "none", fontFamily: "inherit" }}
                />
                <button
                  disabled={settingsSaving}
                  onClick={async () => {
                    if (!curPassword || !newPassword) { setSettingsMsg({ ok: false, text: "Both fields are required." }); return; }
                    if (newPassword.length < 8) { setSettingsMsg({ ok: false, text: "New password must be at least 8 characters." }); return; }
                    setSettingsSaving(true); setSettingsMsg(null);
                    try {
                      await user.updatePassword({ currentPassword: curPassword, newPassword, signOutOfOtherSessions: true });
                      setSettingsMsg({ ok: true, text: "Password updated successfully!" });
                      setCurPassword(""); setNewPassword("");
                    } catch (e: any) {
                      setSettingsMsg({ ok: false, text: e?.errors?.[0]?.message || "Failed to update password." });
                    } finally { setSettingsSaving(false); }
                  }}
                  style={{ padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                >
                  {settingsSaving ? "Saving…" : "Update Password"}
                </button>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, marginTop: 4 }}>
                  {fpStep === 0 ? (
                    <button
                      disabled={fpLoading}
                      onClick={async () => {
                        const email = user.primaryEmailAddress?.emailAddress;
                        if (!email) { setSettingsMsg({ ok: false, text: "No email address found on your account." }); return; }
                        if (!signIn) { setSettingsMsg({ ok: false, text: "Password reset unavailable right now. Sign out and use 'Forgot password?' on the sign-in page instead." }); return; }
                        setFpLoading(true);
                        try {
                          await signIn.create({ strategy: "reset_password_email_code", identifier: email });
                          setFpStep(1); setSettingsMsg(null);
                        } catch (e: any) {
                          setSettingsMsg({ ok: false, text: e?.errors?.[0]?.message || "Could not send reset code." });
                        } finally { setFpLoading(false); }
                      }}
                      style={{ background: "none", border: "none", color: "#38bdf8", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "4px 0", opacity: fpLoading ? 0.5 : 1, textDecoration: "underline" }}
                    >
                      {fpLoading ? "Sending code…" : "Forgot password? Send reset code"}
                    </button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 12, color: "#38bdf8", lineHeight: 1.55 }}>Reset code sent to <strong>{user.primaryEmailAddress?.emailAddress}</strong>. Check your email.</div>
                      <input value={fpCode} onChange={e => setFpCode(e.target.value)} placeholder="Enter reset code" style={{ background: "#0d0d11", border: "1px solid rgba(56,189,248,0.35)", borderRadius: 10, color: "#fff", fontSize: 14, padding: "11px 14px", outline: "none", fontFamily: "inherit" }} />
                      <input type="password" value={fpNewPw} onChange={e => setFpNewPw(e.target.value)} placeholder="New password (min. 8 chars)" style={{ background: "#0d0d11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 14, padding: "11px 14px", outline: "none", fontFamily: "inherit" }} />
                      <button
                        disabled={fpLoading || !fpCode || fpNewPw.length < 8}
                        onClick={async () => {
                          if (!signIn || !fpCode || fpNewPw.length < 8) { setSettingsMsg({ ok: false, text: "Enter the code and a password of at least 8 characters." }); return; }
                          setFpLoading(true);
                          try {
                            await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code: fpCode });
                            await (signIn as any).resetPassword({ password: fpNewPw });
                            setSettingsMsg({ ok: true, text: "Password reset! You can now sign in with your new password." });
                            setFpStep(0); setFpCode(""); setFpNewPw("");
                          } catch (e: any) {
                            setSettingsMsg({ ok: false, text: e?.errors?.[0]?.message || "Invalid code or error. Try again." });
                          } finally { setFpLoading(false); }
                        }}
                        style={{ padding: "12px 0", borderRadius: 12, background: (!fpCode || fpNewPw.length < 8) ? "rgba(56,189,248,0.2)" : "linear-gradient(135deg,#38bdf8,#0ea5e9)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                      >
                        {fpLoading ? "Resetting…" : "Reset Password"}
                      </button>
                      <button onClick={() => { setFpStep(0); setFpCode(""); setFpNewPw(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "2px 0" }}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {settingsTab === "photo" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 4, alignSelf: "flex-start" }}>Upload a new profile photo.</div>
                <div style={{ width: 80, height: 80, borderRadius: "50%", border: "3px solid #f59e0b", overflow: "hidden" }}>
                  <img src={user.imageUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  openCropForFile(file);
                  if (photoInputRef.current) photoInputRef.current.value = "";
                }} />
                <button
                  disabled={settingsSaving}
                  onClick={() => photoInputRef.current?.click()}
                  style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                >
                  {settingsSaving ? "Uploading…" : "Choose Photo"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "72px 16px 0" }}>

        {/* Avatar + name */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 24, paddingBottom: 28, animation: "profIn 0.5s ease both" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: "3px solid #f59e0b", boxShadow: "0 0 20px rgba(245,158,11,0.45)", overflow: "hidden", marginBottom: 12 }}>
            <img src={user.imageUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em" }}>{displayName}</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 3 }}>{user.emailAddresses?.[0]?.emailAddress}</div>
        </div>

        {/* Stats strip */}
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px 0" }}>Loading…</div>
        ) : stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20, animation: "profIn 0.5s ease 0.1s both" }}>
            {[
              { label: "Orders", value: stats.total_orders },
              { label: "Diamonds", value: stats.total_diamonds.toLocaleString() },
              { label: "Spent", value: `₹${stats.total_spent.toFixed(0)}` },
            ].map(s => (
              <div key={s.label} style={{ background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 10px", textAlign: "center" }}>
                <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 20 }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Wallet card */}
        <div style={{ background: "linear-gradient(135deg,#1a1200,#111)", borderRadius: 18, border: "1px solid rgba(245,158,11,0.25)", padding: "20px 18px", marginBottom: 16, animation: "profIn 0.5s ease 0.18s both", boxShadow: "0 0 30px rgba(245,158,11,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Sky Wallet (S Coins)</div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 28, marginTop: 2 }}>
                S {loading ? "—" : (stats?.wallet_balance ?? 0).toFixed(0)}
              </div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>1 S coin = ₹1</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src="/scoin.png" alt="S Coin" style={{ width: 40, height: 40, objectFit: "contain" }} />
            </div>
          </div>
          <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🏷️</span>
            <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>0.5% discount on recharges above ₹1000 paid via wallet</span>
          </div>
          <button
            onClick={() => { setShowTopup(v => !v); setTopupMsg(null); }}
            style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            {showTopup ? "Cancel" : "+ Add Funds"}
          </button>

          {showTopup && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>
                Pick an amount — you'll see the payment QR on the next screen.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {[100, 300, 500, 1000, 1500].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(String(amt))}
                    style={{
                      padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                      background: topupAmount === String(amt) ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.06)",
                      border: topupAmount === String(amt) ? "1.5px solid rgba(245,158,11,0.65)" : "1px solid rgba(255,255,255,0.1)",
                      color: topupAmount === String(amt) ? "#f59e0b" : "rgba(255,255,255,0.6)",
                      cursor: "pointer", touchAction: "manipulation",
                    }}
                  >₹{amt}</button>
                ))}
              </div>
              <input
                type="number"
                placeholder="Or enter custom amount"
                value={topupAmount}
                onChange={e => setTopupAmount(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }}
              />
              {topupMsg && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: topupMsg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: topupMsg.ok ? "#22c55e" : "#ef4444", fontSize: 13, marginBottom: 10 }}>
                  {topupMsg.text}
                </div>
              )}
              <button
                onClick={() => {
                  const amt = parseFloat(topupAmount);
                  if (!amt || amt <= 0) { setTopupMsg({ ok: false, text: "Enter a valid amount." }); return; }
                  setTopupMsg(null);
                  sessionStorage.setItem("walletTopupAmount", String(amt));
                  setLocation("/pay");
                }}
                style={{ width: "100%", padding: "11px 0", borderRadius: 10, background: "#f59e0b", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
              >Pay Now</button>
            </div>
          )}
        </div>

        {/* Wallet transaction history */}
        {transactions.length > 0 && (
          <div style={{ background: "#111", borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", padding: "16px 14px", marginBottom: 16, animation: "profIn 0.5s ease 0.24s both" }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Wallet Transactions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {transactions.map(tx => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{tx.description ?? (tx.type === "credit" ? "Top-up" : "Debit")}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{new Date(tx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                    {tx.upi_ref && tx.upi_ref.startsWith("TUP-") && (
                      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontFamily: "monospace" }}>ID: {tx.upi_ref}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <div style={{ color: tx.type === "credit" ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 14 }}>
                      {tx.type === "credit" ? "+" : "-"}S {parseFloat(tx.amount).toFixed(0)}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: statusColor[tx.status] ?? "#aaa", background: (statusColor[tx.status] ?? "#aaa") + "18", padding: "1px 7px", borderRadius: 999 }}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "profIn 0.5s ease 0.3s both" }}>
          <button onClick={() => setLocation("/orders")} style={{ background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Order History</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={() => setLocation("/packages")} style={{ background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <img src="/scoin.png" alt="S Coin" style={{ width: 30, height: 30, objectFit: "contain" }} />
              </div>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Browse Packages</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {/* Crop modal */}
      {cropSrc && cropImgEl && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.93)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 24 }}
          onMouseMove={handleCropMouseMove}
          onMouseUp={handleCropEnd}
          onMouseLeave={handleCropEnd}
        >
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Position your photo</div>
          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, marginTop: -14 }}>Drag to reposition · Pinch or use +/− to zoom</div>

          {/* Circular crop viewport */}
          <div
            style={{ width: CROP_SIZE, height: CROP_SIZE, borderRadius: "50%", overflow: "hidden", border: "3px solid #f59e0b", boxShadow: "0 0 0 4px rgba(245,158,11,0.18), 0 8px 32px rgba(0,0,0,0.7)", position: "relative", cursor: "grab", userSelect: "none", touchAction: "none", flexShrink: 0 }}
            onMouseDown={handleCropMouseDown}
            onTouchStart={handleCropTouchStart}
            onTouchMove={handleCropTouchMove}
            onTouchEnd={handleCropEnd}
          >
            <img
              src={cropSrc}
              alt="crop preview"
              style={{
                position: "absolute",
                width: cropImgEl.naturalWidth * cropScale,
                height: cropImgEl.naturalHeight * cropScale,
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px))`,
                pointerEvents: "none",
                userSelect: "none",
                maxWidth: "none",
              }}
              draggable={false}
            />
          </div>

          {/* Zoom controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setCropScale(s => Math.max(0.15, s - 0.1))}
              style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
            >−</button>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, minWidth: 48, textAlign: "center" }}>{Math.round(cropScale * 100)}%</span>
            <button
              onClick={() => setCropScale(s => Math.min(5, s + 0.1))}
              style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
            >+</button>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 300 }}>
            <button
              onClick={() => { setCropSrc(null); setCropImgEl(null); }}
              style={{ flex: 1, padding: "13px 0", borderRadius: 12, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              disabled={settingsSaving}
              onClick={confirmCrop}
              style={{ flex: 2, padding: "13px 0", borderRadius: 12, background: settingsSaving ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: settingsSaving ? "not-allowed" : "pointer" }}
            >
              {settingsSaving ? "Uploading…" : "Crop & Set Photo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
