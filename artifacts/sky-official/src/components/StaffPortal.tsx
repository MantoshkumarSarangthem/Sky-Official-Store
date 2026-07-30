import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { usePWAInstall } from "../hooks/usePWAInstall";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

// ── Biometric (WebAuthn) helpers ──────────────────────────────────────────
// Only the WebAuthn credential ID (non-sensitive) and a server-issued device
// token are stored in localStorage. No PINs or session tokens are stored.
const STAFF_BIO_CRED = "staff_bio_cred_id";
const STAFF_BIO_DEVICE_TOKEN = "staff_bio_device_token";

async function staffBioAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

// Register biometric credential. Requires active session cookie.
async function staffBioRegister(apiBase: string): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge, rp: { name: "Sky Official Staff", id: window.location.hostname },
      user: { id: userId, name: "staff", displayName: "Staff" },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    }
  }) as PublicKeyCredential | null;
  if (!cred) return false;
  const dtRes = await fetch(`${apiBase}/staff/bio-device-register`, { method: "POST" });
  if (!dtRes.ok) return false;
  const { deviceToken } = await dtRes.json();
  localStorage.setItem(STAFF_BIO_CRED, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
  localStorage.setItem(STAFF_BIO_DEVICE_TOKEN, deviceToken);
  return true;
}

// Authenticate with biometrics. Backend verifies device token and sets session cookie.
async function staffBioAuthenticate(apiBase: string): Promise<any> {
  const b64 = localStorage.getItem(STAFF_BIO_CRED);
  const deviceToken = localStorage.getItem(STAFF_BIO_DEVICE_TOKEN);
  if (!b64 || !deviceToken) return null;
  const credId = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credId, type: "public-key" }],
      userVerification: "required", timeout: 60000,
    }
  });
  if (!assertion) return null;
  const res = await fetch(`${apiBase}/staff/bio-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceToken }),
  });
  if (!res.ok) return null;
  const { staff } = await res.json();
  return staff ?? null;
}

interface StaffOrder {
  id: number;
  display_id: string | null;
  diamonds: number;
  price: string;
  mlbb_id: string | null;
  mlbb_ign: string | null;
  mlbb_server_id: string | null;
  status: string;
  note: string | null;
  created_at: string;
  game_name: string | null;
  currency_label: string | null;
  pack_name: string | null;
}

function resolveCurrencyLabel(order: StaffOrder): string {
  if (order.currency_label) return order.currency_label;
  const n = (order.game_name ?? "").toLowerCase();
  if (n.includes("bgmi")) return "UC";
  if (n.includes("pubg")) return "UC";
  if (n.includes("genshin")) return "Crystals";
  if (n.includes("honor of kings") || n.includes("hok")) return "Tokens";
  if (n.includes("free fire") || n.includes("freefire")) return "Diamonds";
  if (n.includes("clash") || n.includes("brawl")) return "Gems";
  if (n.includes("valorant")) return "VP";
  return "Diamonds";
}

function resolveOrderDisplay(order: StaffOrder): string {
  const label = resolveCurrencyLabel(order);
  if (order.diamonds > 0) return `${order.diamonds.toLocaleString()} ${label}`;
  return order.pack_name || label;
}

function resolveGameIdLabel(order: StaffOrder): string {
  const n = (order.game_name ?? "").toLowerCase();
  if (n.includes("mobile legends") || n.includes("mlbb") || n.includes("bang bang")) return "MLBB ID";
  if (n.includes("bgmi")) return "BGMI ID";
  if (n.includes("pubg")) return "PUBG ID";
  if (n.includes("honor of kings") || n.includes("hok")) return "HOK ID";
  if (n.includes("genshin")) return "Genshin ID";
  if (n.includes("clash of clans") || n.includes("coc")) return "COC ID";
  if (n.includes("clash royale")) return "CR ID";
  if (n.includes("brawl stars")) return "Brawl ID";
  if (n.includes("free fire") || n.includes("freefire")) return "FF ID";
  if (n.includes("valorant")) return "Valorant ID";
  return "Player ID";
}

interface StaffInfo {
  id: number;
  name: string;
  status: string;
  qr_image: string | null;
  shift_hours: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{label}</span>
      <span style={{ color: accent ? "#f59e0b" : "#fff", fontWeight: accent ? 800 : 600, fontSize: 13, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{value}</span>
        <button
          onClick={copy}
          style={{ background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${copied ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.12)"}`, borderRadius: 6, width: 26, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, transition: "all 0.2s", flexShrink: 0 }}
          title="Copy to clipboard"
        >
          {copied ? "✅" : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/></svg>}
        </button>
      </div>
    </div>
  );
}

function OrderCard({ order, index, onOpen, onUpdate, updatingId, done }: {
  order: StaffOrder; index: number; onOpen: () => void;
  onUpdate: (id: number, status: string) => void; updatingId: number | null; done?: boolean;
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: done ? "#0d0d0d" : "#111", borderRadius: 16,
        border: `1px solid ${done ? "rgba(255,255,255,0.06)" : order.status === "processing" ? "rgba(59,130,246,0.35)" : "rgba(245,158,11,0.2)"}`,
        padding: "14px 16px", cursor: "pointer",
        animation: `staffFadeIn 0.35s ease ${index * 0.06}s both`,
        opacity: done ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 12, fontFamily: "monospace" }}>
          {order.display_id || `#${order.id}`}
        </div>
        <div style={{ background: (STATUS_COLOR[order.status] ?? "#aaa") + "20", color: STATUS_COLOR[order.status] ?? "#aaa", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
          {order.status}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{resolveOrderDisplay(order)}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
            ₹{parseFloat(order.price).toLocaleString("en-IN")}
          </div>
          <div style={{ color: order.note === "Paid via wallet" ? "#a78bfa" : "#34d399", fontSize: 10, marginTop: 2, fontWeight: 600 }}>
            {order.note === "Paid via wallet" ? "💳 Wallet" : "📱 UPI"}
          </div>
        </div>
        {order.mlbb_ign && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.mlbb_ign}</div>
            {order.mlbb_id && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>ID: {order.mlbb_id}</div>}
          </div>
        )}
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 6h8M7 3l3 3-3 3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!done && order.status === "pending" && (
        <button
          onClick={e => { e.stopPropagation(); onUpdate(order.id, "processing"); onOpen(); }}
          disabled={updatingId === order.id}
          style={{ marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 9, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#3b82f6", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          {updatingId === order.id ? "…" : "▶ Start Processing"}
        </button>
      )}
      {!done && order.status === "processing" && (
        <button
          onClick={e => { e.stopPropagation(); onUpdate(order.id, "completed"); }}
          disabled={updatingId === order.id}
          style={{ marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 9, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          {updatingId === order.id ? "…" : "✓ Mark Completed"}
        </button>
      )}
    </div>
  );
}

export default function StaffPortal() {
  const [, setLocation] = useLocation();
  const { canInstall: pwaCanInstall, installed: pwaInstalled, install: pwaInstall } = usePWAInstall("/staff-manifest.json");
  const [authed, setAuthed] = useState(false);
  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [loginName, setLoginName] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [bioAvail, setBioAvail] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(() => !!localStorage.getItem(STAFF_BIO_CRED));
  const [bioLoading, setBioLoading] = useState(false);
  const [bioMsg, setBioMsg] = useState("");
  const [showPinForm, setShowPinForm] = useState(() => !localStorage.getItem(STAFF_BIO_CRED));
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);

  // Auth handled via HttpOnly session cookie — no token in JS
  const authHeader = { "Content-Type": "application/json" };

  // Restore session from HttpOnly cookie on mount
  useEffect(() => {
    fetch(`${API}/staff/me`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setStaff(data); setAuthed(true); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    staffBioAvailable().then(avail => {
      setBioAvail(avail);
    });
  }, []);

  const loginWithBio = async () => {
    setBioLoading(true); setLoginError(""); setBioMsg("");
    try {
      const staffData = await staffBioAuthenticate(API);
      if (staffData) {
        setStaff(staffData as StaffInfo);
        setAuthed(true);
      } else setBioMsg("Biometric verification failed. Use PIN instead.");
    } catch (e: any) {
      setBioMsg(e?.name === "NotAllowedError" ? "Biometric cancelled." : "Biometric login failed.");
    } finally { setBioLoading(false); }
  };

  const enableBio = async () => {
    setBioLoading(true); setBioMsg("");
    try {
      const ok = await staffBioRegister(API);
      if (ok) { setBioEnabled(true); setBioMsg("✓ Biometric login enabled for this device!"); }
      else setBioMsg("Could not save biometric credential.");
    } catch (e: any) {
      setBioMsg(e?.name === "NotAllowedError" ? "Biometric setup cancelled." : "Biometric setup failed.");
    } finally { setBioLoading(false); }
  };

  const disableBio = () => {
    localStorage.removeItem(STAFF_BIO_CRED);
    localStorage.removeItem(STAFF_BIO_DEVICE_TOKEN);
    setBioEnabled(false); setBioMsg("Biometric login removed.");
  };

  useEffect(() => {
    if (!authed && bioAvail && bioEnabled) loginWithBio();
  }, [bioAvail]);

  const fetchOrders = useCallback(async () => {
    if (!authed) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API}/staff/orders`);
      if (res.status === 401) { logout(); return; }
      if (res.ok) setOrders(await res.json());
    } catch {} finally { setLoadingOrders(false); }
  }, [authed]);

  useEffect(() => { if (authed) fetchOrders(); }, [authed, fetchOrders]);

  useEffect(() => {
    if (!authed) return;
    const t = setInterval(fetchOrders, 30000);
    return () => clearInterval(t);
  }, [authed, fetchOrders]);

  async function login() {
    if (!loginName.trim() || !loginPin.trim()) { setLoginError("Enter your name and PIN."); return; }
    setLoginLoading(true); setLoginError("");
    try {
      const res = await fetch(`${API}/staff/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: loginName.trim(), pin: loginPin.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        // Session cookie set by backend — no token stored in JS
        setStaff(data.staff);
        setAuthed(true);
      } else {
        setLoginError(data.error ?? "Login failed.");
      }
    } catch { setLoginError("Network error. Try again."); }
    finally { setLoginLoading(false); }
  }

  async function logout() {
    try { await fetch(`${API}/staff/logout`, { method: "POST" }); } catch {}
    setAuthed(false); setStaff(null); setOrders([]);
  }

  async function updateStatus(orderId: number, status: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API}/staff/orders/${orderId}/status`, {
        method: "PUT", headers: authHeader, body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
        if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, status } : null);
      }
    } catch {} finally { setUpdatingId(null); }
  }

  const STYLE = `
    @keyframes staffFadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  `;

  if (!authed || !staff) {
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{STYLE}</style>
        <button onClick={() => setLocation("/admin?tab=staff")} style={{ position: "fixed", top: 12, left: 12, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, animation: "staffFadeIn 0.4s ease both" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>🔐</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>Staff Access</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>Verify your identity to continue</div>
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            {bioEnabled && !showPinForm && (
              <button
                onClick={loginWithBio}
                disabled={bioLoading}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "linear-gradient(135deg,#1e1b4b,#312e81)", border: "1.5px solid rgba(129,140,248,0.5)", color: "#a5b4fc", fontWeight: 800, fontSize: 15, cursor: bioLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
              >
                {bioLoading ? <><span style={{ fontSize: 18 }}>🔒</span> <span style={{ opacity: 0.8 }}>Verifying identity…</span></> : <><span style={{ fontSize: 18 }}>🔑</span> Login with Biometrics</>}
              </button>
            )}
            {bioEnabled && !showPinForm && (
              <button onClick={() => setShowPinForm(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: 12, padding: "4px 0", textAlign: "center" }}>
                Use PIN instead
              </button>
            )}
            {(!bioEnabled || showPinForm) && (
              <>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Your Name</div>
                  <input value={loginName} onChange={e => setLoginName(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} placeholder="Enter your staff name"
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>PIN</div>
                  <input type="password" value={loginPin} onChange={e => setLoginPin(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} placeholder="Enter your PIN"
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <button onClick={login} disabled={loginLoading}
                  style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: loginLoading ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 800, fontSize: 15, border: "none", cursor: loginLoading ? "default" : "pointer" }}>
                  {loginLoading ? "Signing in…" : "Sign In"}
                </button>
              </>
            )}
            {(loginError || bioMsg) && (
              <p style={{ textAlign: "center", fontSize: 12, color: loginError ? "#f87171" : "#fbbf24", margin: 0 }}>{loginError || bioMsg}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedOrder) {
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: 48 }}>
        <style>{STYLE}</style>
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
          <button onClick={() => setSelectedOrder(null)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Order Details</span>
        </div>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "72px 16px 0" }}>
          <div style={{ background: "#111", borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", padding: "20px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 13, fontFamily: "monospace" }}>{selectedOrder.display_id || `#${selectedOrder.id}`}</div>
              <div style={{ background: (STATUS_COLOR[selectedOrder.status] ?? "#aaa") + "20", color: STATUS_COLOR[selectedOrder.status] ?? "#aaa", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>{selectedOrder.status}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <InfoRow label={`♦ ${resolveCurrencyLabel(selectedOrder)}`} value={resolveOrderDisplay(selectedOrder)} accent />
              <InfoRow label="Price" value={`₹${parseFloat(selectedOrder.price).toLocaleString("en-IN")}`} />
              <InfoRow label="Payment" value={selectedOrder.note === "Paid via wallet" ? "Paid via Wallet" : "Paid via UPI"} />
              {selectedOrder.mlbb_id && <CopyRow label={resolveGameIdLabel(selectedOrder)} value={selectedOrder.mlbb_id} />}
              {selectedOrder.mlbb_ign && <InfoRow label="IGN" value={selectedOrder.mlbb_ign} />}
              {selectedOrder.mlbb_server_id && <CopyRow label="Server ID" value={selectedOrder.mlbb_server_id} />}
              <InfoRow label="Placed" value={new Date(selectedOrder.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
              {selectedOrder.note && selectedOrder.note !== "Paid via wallet" && <InfoRow label="Note" value={selectedOrder.note} />}
            </div>
          </div>

          {staff.qr_image && (
            <div style={{ background: "linear-gradient(135deg,#1a1200,#111)", borderRadius: 18, border: "1px solid rgba(245,158,11,0.25)", padding: "20px 18px", marginBottom: 14, textAlign: "center" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Your Payment QR</div>
              <img src={staff.qr_image} alt="Payment QR" style={{ maxWidth: 200, maxHeight: 200, objectFit: "contain", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }} />
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 10 }}>Customer scans this to pay</div>
            </div>
          )}

          {(selectedOrder.status === "pending" || selectedOrder.status === "processing") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selectedOrder.status === "pending" && (
                <button onClick={() => updateStatus(selectedOrder.id, "processing")} disabled={updatingId === selectedOrder.id}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 13, background: "linear-gradient(135deg,#3b82f6,#2563eb)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: updatingId === selectedOrder.id ? 0.6 : 1 }}>
                  {updatingId === selectedOrder.id ? "Updating…" : "▶ Start Processing"}
                </button>
              )}
              {selectedOrder.status === "processing" && (
                <button onClick={() => updateStatus(selectedOrder.id, "completed")} disabled={updatingId === selectedOrder.id}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 13, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer", opacity: updatingId === selectedOrder.id ? 0.6 : 1 }}>
                  {updatingId === selectedOrder.id ? "Updating…" : "✓ Mark as Completed"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "processing");
  const doneOrders = orders.filter(o => o.status === "completed" || o.status === "cancelled");

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: 48 }}>
      <style>{STYLE}</style>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setLocation("/admin?tab=staff")} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", border: "2px solid #f59e0b" }}>
            <img src="/logo.webp" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{staff.name}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>Staff Portal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={fetchOrders} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>↻ Refresh</button>
          {bioAvail && !bioEnabled && (
            <button
              onClick={() => enableBio()}
              disabled={bioLoading}
              title="Enable biometric login for this device"
              style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", fontSize: 11, cursor: bioLoading ? "default" : "pointer", fontWeight: 600 }}
            >
              {bioLoading ? "…" : "🔑"}
            </button>
          )}
          {bioAvail && bioEnabled && (
            <button
              onClick={disableBio}
              title="Biometric login is ON — tap to remove"
              style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
            >
              🔑
            </button>
          )}
          {pwaCanInstall && (
            <button
              onClick={pwaInstall}
              title="Install Sky Staff as an app on this device"
              style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.28)", color: "#a5b4fc", fontSize: 11, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4"/><path d="M8 12l4 4 4-4"/><rect x="3" y="18" width="18" height="3" rx="1"/></svg>
              Install
            </button>
          )}
          {pwaInstalled && (
            <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", fontSize: 11, fontWeight: 600 }}>✓ Installed</span>
          )}
          <button onClick={logout} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "72px 16px 0" }}>
        {staff.qr_image && (
          <div style={{ background: "linear-gradient(135deg,#1a1200,#111)", borderRadius: 18, border: "1px solid rgba(245,158,11,0.25)", padding: "16px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, animation: "staffFadeIn 0.4s ease both" }}>
            <img src={staff.qr_image} alt="QR" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
            <div>
              <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: 13 }}>Your Payment QR</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 3, lineHeight: 1.5 }}>Share with customers to receive payments</div>
              {staff.shift_hours && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 4 }}>⏰ {staff.shift_hours}</div>}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, animation: "staffFadeIn 0.4s ease 0.05s both" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Active Orders</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{pendingOrders.length} active</div>
        </div>

        {loadingOrders && orders.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading orders…</div>
        )}

        {!loadingOrders && pendingOrders.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.25)", fontSize: 14, animation: "staffFadeIn 0.4s ease 0.1s both" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
            <div style={{ fontWeight: 600 }}>No active orders</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Orders assigned to you will appear here</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pendingOrders.map((order, i) => (
            <OrderCard key={order.id} order={order} index={i} onOpen={() => setSelectedOrder(order)} onUpdate={updateStatus} updatingId={updatingId} />
          ))}
        </div>

        {doneOrders.length > 0 && (
          <>
            <div style={{ color: "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 28, marginBottom: 10 }}>Completed</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {doneOrders.slice(0, 5).map((order, i) => (
                <OrderCard key={order.id} order={order} index={i} onOpen={() => setSelectedOrder(order)} onUpdate={updateStatus} updatingId={updatingId} done />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
