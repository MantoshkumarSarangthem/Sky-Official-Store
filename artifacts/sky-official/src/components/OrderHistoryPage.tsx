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
  pack_image?: string | null;
  pack_name?: string | null;
  game_name?: string | null;
}

function getCurrencyLabel(gameName?: string | null) {
  const n = gameName?.toLowerCase() || "";
  if (n.includes("pubg") || n.includes("bgmi") || n.includes("battleground")) return "UC";
  if (n.includes("free fire") || n.includes("freefire")) return "Diamonds";
  if (n.includes("clash") || n.includes("royale")) return "Gems";
  if (n.includes("valorant")) return "VP";
  if (n.includes("cod") || n.includes("call of duty")) return "CP";
  if (n.includes("genshin")) return "Crystals";
  if (n.includes("honkai")) return "Crystals";
  if (n.includes("fortnite")) return "V-Bucks";
  return "Diamonds";
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


function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 24px", textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(168,148,130,0.1)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 000 4h6a2 2 0 000-4M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#A89482" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 16, margin: 0 }}>No orders yet</p>
        <p style={{ color: "rgba(61,43,31,0.5)", fontSize: 13, marginTop: 6 }}>Your diamond purchases will appear here once you place an order.</p>
      </div>
      <a href="#packages" style={{ display: "inline-block", padding: "12px 32px", borderRadius: 999, background: "#8D6E63", color: "#FFFFFF", fontWeight: 700, fontSize: 14, textDecoration: "none", marginTop: 4, boxShadow: "0 3px 10px rgba(141,110,99,0.35)" }}>
        Browse Packages
      </a>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(197,180,162,0.35)", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 2px 8px rgba(61,43,31,0.04)" }}>
      {[80, 120, 60].map((w, i) => (
        <div key={i} style={{ height: 12, width: w, borderRadius: 6, background: "rgba(197,180,162,0.25)", animation: "oh-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
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

  const showStats = !loading && !error && orders.length > 0;

  return (
    <div style={{ height: "100dvh", background: "#FAF9F6", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes oh-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes oh-fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Fixed top section: header + stats */}
      <div style={{ flexShrink: 0, maxWidth: 520, margin: "0 auto", width: "100%", padding: "72px 16px 12px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: showStats ? 16 : 0 }}>
          <button
            onClick={() => window.history.back()}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 style={{ color: "#3D2B1F", fontWeight: 800, fontSize: 20, margin: 0, lineHeight: 1.2 }}>My Orders</h1>
            {user && (
              <p style={{ color: "rgba(61,43,31,0.45)", fontSize: 12, margin: "3px 0 0" }}>
                {user.primaryEmailAddress?.emailAddress}
              </p>
            )}
          </div>
        </div>

        {showStats && (
          <div style={{ display: "flex", gap: 10, animation: "oh-fadeIn 0.5s ease both" }}>
            {[
              { label: "Total Orders", value: orders.length },
              { label: "Products Purchased", value: orders.reduce((s, o) => s + o.diamonds, 0).toLocaleString() },
              { label: "Total Spent", value: "₹" + orders.reduce((s, o) => s + parseFloat(o.price), 0).toFixed(0) },
            ].map((stat) => (
              <div key={stat.label} style={{ flex: 1, background: "#FFFFFF", borderRadius: 12, padding: "12px 10px", border: "1px solid rgba(197,180,162,0.35)", textAlign: "center", boxShadow: "0 2px 6px rgba(61,43,31,0.04)" }}>
                <div style={{ color: "#6D4C41", fontWeight: 800, fontSize: 15 }}>{stat.value}</div>
                <div style={{ color: "rgba(61,43,31,0.65)", fontSize: 10, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "8px 16px 48px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "20px 24px", textAlign: "center" }}>
              <p style={{ color: "#ef4444", fontWeight: 600, margin: 0 }}>{error}</p>
              <p style={{ color: "rgba(61,43,31,0.4)", fontSize: 13, marginTop: 6 }}>Please try refreshing the page.</p>
            </div>
          ) : orders.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {orders.map((order, i) => (
                <div
                  key={order.id}
                  style={{ background: "#FFFFFF", borderRadius: 16, padding: "16px 18px", border: "1px solid rgba(197,180,162,0.35)", animation: `oh-fadeIn 0.4s ease ${i * 0.06}s both`, boxShadow: "0 2px 8px rgba(61,43,31,0.04)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: order.pack_image ? "transparent" : "rgba(168,148,130,0.1)", border: order.pack_image ? "none" : "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        {order.pack_image
                          ? <img src={order.pack_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#A89482" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="3" y1="6" x2="21" y2="6" stroke="#A89482" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        }
                      </div>
                      <div>
                        <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                          {order.pack_name || `${order.diamonds.toLocaleString()} ${getCurrencyLabel(order.game_name)}`}
                        </div>
                        <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 11, marginTop: 2 }}>
                          #{formatOrderId(order.id)}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", paddingTop: 10, borderTop: "1px solid rgba(197,180,162,0.25)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ color: "rgba(61,43,31,0.4)", fontSize: 11 }}>Price</span>
                      <span style={{ color: "#A89482", fontWeight: 700, fontSize: 13 }}>₹{parseFloat(order.price).toFixed(0)}</span>
                    </div>
                    {order.mlbb_id && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ color: "rgba(61,43,31,0.4)", fontSize: 11 }}>MLBB ID</span>
                        <span style={{ color: "rgba(61,43,31,0.7)", fontWeight: 600, fontSize: 13 }}>{order.mlbb_id}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(61,43,31,0.25)" strokeWidth="2" />
                        <path d="M12 6v6l4 2" stroke="rgba(61,43,31,0.25)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span style={{ color: "rgba(61,43,31,0.4)", fontSize: 11 }}>{formatDate(order.created_at)}</span>
                    </div>
                  </div>

                  {order.note && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(61,43,31,0.04)", borderRadius: 8, fontSize: 12, color: "rgba(61,43,31,0.5)", fontStyle: "italic" }}>
                      {order.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
