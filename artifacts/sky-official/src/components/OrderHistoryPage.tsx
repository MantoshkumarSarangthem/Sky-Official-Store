import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

interface Order {
  id: number;
  package_id: number | null;
  diamonds: number;
  price: string;
  mlbb_id: string | null;
  status: string;
  note: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    pending:   { label: "Pending",   bg: "rgba(245,158,11,0.12)", color: "#f59e0b", dot: "#f59e0b" },
    completed: { label: "Completed", bg: "rgba(34,197,94,0.12)",  color: "#22c55e", dot: "#22c55e" },
    failed:    { label: "Failed",    bg: "rgba(239,68,68,0.12)",  color: "#ef4444", dot: "#ef4444" },
    cancelled: { label: "Cancelled", bg: "rgba(156,163,175,0.12)",color: "#9ca3af", dot: "#9ca3af" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function DiamondIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <defs>
        <linearGradient id="dg-oh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <polygon points="10,1 18,8 10,19 2,8" fill="url(#dg-oh)" />
      <polygon points="10,1 14,6 10,8 6,6" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 24px", textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 000 4h6a2 2 0 000-4M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0 }}>No orders yet</p>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 6 }}>Your diamond purchases will appear here once you place an order.</p>
      </div>
      <a href="#packages" style={{ display: "inline-block", padding: "10px 28px", borderRadius: 999, background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#000", fontWeight: 700, fontSize: 14, textDecoration: "none", marginTop: 4 }}>
        Browse Packages
      </a>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
      {[80, 120, 60].map((w, i) => (
        <div key={i} style={{ height: 12, width: w, borderRadius: 6, background: "rgba(255,255,255,0.07)", animation: "oh-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

export default function OrderHistoryPage() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setLocation("/sign-in");
      return;
    }
    fetch(`${API}/orders/my`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load orders");
        return res.json();
      })
      .then((data) => { setOrders(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [isLoaded, user]);

  const formatOrderId = (id: number) => `SKY-${String(id).padStart(5, "0")}`;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + " · " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: 64 }}>
      <style>{`
        @keyframes oh-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes oh-fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => window.history.back()}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 style={{ color: "#fff", fontWeight: 800, fontSize: 20, margin: 0, lineHeight: 1.2 }}>My Orders</h1>
            {user && (
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "3px 0 0" }}>
                {user.primaryEmailAddress?.emailAddress}
              </p>
            )}
          </div>
        </div>

        {/* Stats strip */}
        {!loading && !error && orders.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20, animation: "oh-fadeIn 0.5s ease both" }}>
            {[
              { label: "Total Orders", value: orders.length },
              { label: "Diamonds Bought", value: orders.reduce((s, o) => s + o.diamonds, 0).toLocaleString() + " ♦" },
              { label: "Total Spent", value: "₹" + orders.reduce((s, o) => s + parseFloat(o.price), 0).toFixed(0) },
            ].map((stat) => (
              <div key={stat.label} style={{ flex: 1, background: "#141414", borderRadius: 12, padding: "12px 10px", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 15 }}>{stat.value}</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "20px 24px", textAlign: "center" }}>
            <p style={{ color: "#ef4444", fontWeight: 600, margin: 0 }}>{error}</p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 6 }}>Please try refreshing the page.</p>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.map((order, i) => (
              <div
                key={order.id}
                style={{ background: "#141414", borderRadius: 16, padding: "16px 18px", border: "1px solid rgba(255,255,255,0.07)", animation: `oh-fadeIn 0.4s ease ${i * 0.06}s both` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <DiamondIcon size={18} />
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                        {order.diamonds.toLocaleString()} Diamonds
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>
                        #{formatOrderId(order.id)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Price</span>
                    <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13 }}>₹{parseFloat(order.price).toFixed(0)}</span>
                  </div>
                  {order.mlbb_id && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>MLBB ID</span>
                      <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 13 }}>{order.mlbb_id}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                      <path d="M12 6v6l4 2" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{formatDate(order.created_at)}</span>
                  </div>
                </div>

                {order.note && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>
                    {order.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
