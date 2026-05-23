import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

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
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>♦ {order.diamonds.toLocaleString()}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
            ₹{parseFloat(order.price).toLocaleString("en-IN")}
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
          onClick={e => { e.stopPropagation(); onUpdate(order.id, "processing"); }}
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
  const [token, setToken] = useState(() => localStorage.getItem("staff_token") || "");
  const [staff, setStaff] = useState<StaffInfo | null>(() => {
    try { return JSON.parse(localStorage.getItem("staff_info") || "null"); } catch { return null; }
  });
  const [loginName, setLoginName] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);

  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API}/staff/orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { logout(); return; }
      if (res.ok) setOrders(await res.json());
    } catch {} finally { setLoadingOrders(false); }
  }, [token]);

  useEffect(() => { if (token) fetchOrders(); }, [token, fetchOrders]);

  useEffect(() => {
    if (!token) return;
    const t = setInterval(fetchOrders, 30000);
    return () => clearInterval(t);
  }, [token, fetchOrders]);

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
        setToken(data.token); setStaff(data.staff);
        localStorage.setItem("staff_token", data.token);
        localStorage.setItem("staff_info", JSON.stringify(data.staff));
      } else {
        setLoginError(data.error ?? "Login failed.");
      }
    } catch { setLoginError("Network error. Try again."); }
    finally { setLoginLoading(false); }
  }

  function logout() {
    localStorage.removeItem("staff_token"); localStorage.removeItem("staff_info");
    setToken(""); setStaff(null); setOrders([]);
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

  if (!token || !staff) {
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{STYLE}</style>
        <div style={{ width: "100%", maxWidth: 380, animation: "staffFadeIn 0.4s ease both" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", margin: "0 auto 16px", border: "3px solid #f59e0b", boxShadow: "0 0 24px rgba(245,158,11,0.4)" }}>
              <img src="/logo.webp" alt="Sky Official" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>Staff Portal</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 4 }}>Sky Official — Internal Use Only</div>
          </div>
          <div style={{ background: "#111", borderRadius: 20, border: "1px solid rgba(245,158,11,0.2)", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
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
            {loginError && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 13 }}>{loginError}</div>
            )}
            <button onClick={login} disabled={loginLoading}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: loginLoading ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#fcd34d,#f59e0b)", color: "#000", fontWeight: 800, fontSize: 15, border: "none", cursor: loginLoading ? "default" : "pointer" }}>
              {loginLoading ? "Signing in…" : "Sign In"}
            </button>
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
              <InfoRow label="♦ Diamonds" value={`${selectedOrder.diamonds.toLocaleString()} diamonds`} accent />
              <InfoRow label="Price" value={`₹${parseFloat(selectedOrder.price).toLocaleString("en-IN")}`} />
              {selectedOrder.mlbb_id && <InfoRow label="MLBB ID" value={selectedOrder.mlbb_id} />}
              {selectedOrder.mlbb_ign && <InfoRow label="IGN" value={selectedOrder.mlbb_ign} />}
              {selectedOrder.mlbb_server_id && <InfoRow label="Server ID" value={selectedOrder.mlbb_server_id} />}
              <InfoRow label="Placed" value={new Date(selectedOrder.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
              {selectedOrder.note && <InfoRow label="Note" value={selectedOrder.note} />}
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
