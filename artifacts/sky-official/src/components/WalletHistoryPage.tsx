import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

interface WalletTx {
  id: number;
  amount: string;
  type: string;
  status: string;
  upi_ref: string | null;
  description: string | null;
  created_at: string;
}

export default function WalletHistoryPage() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);

  const statusColor: Record<string, string> = {
    pending: "#f59e0b",
    approved: "#22c55e",
    rejected: "#ef4444",
    completed: "#22c55e",
  };

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch(`${API}/wallet/balance`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setTransactions(data.transactions ?? []))
      .finally(() => setLoading(false));
  }, [isLoaded, user]);

  useEffect(() => {
    if (isLoaded && !user) setLocation("/sign-in");
  }, [isLoaded, user]);

  if (!isLoaded || !user) return (
    <div style={{ background: "#FAF9F6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(61,43,31,0.35)", fontSize: 14 }}>Loading…</div>
    </div>
  );

  return (
    <div style={{ background: "#FAF9F6", minHeight: "100vh", paddingBottom: 48 }}>
      <style>{`@keyframes txIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(230,222,211,0.97)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(197,180,162,0.35)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button onClick={() => setLocation("/profile")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 16 }}>Wallet History</span>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "72px 16px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", paddingTop: 60, color: "rgba(61,43,31,0.35)", fontSize: 14 }}>Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div style={{ background: "#FFFFFF", borderRadius: 18, border: "1px solid rgba(197,180,162,0.35)", padding: "40px 16px", textAlign: "center", boxShadow: "0 1px 4px rgba(61,43,31,0.04)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💳</div>
            <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No transactions yet</div>
            <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 14 }}>Your wallet activity will appear here.</div>
          </div>
        ) : (
          <div style={{ background: "#FFFFFF", borderRadius: 18, border: "1px solid rgba(197,180,162,0.35)", padding: "16px 14px", boxShadow: "0 1px 4px rgba(61,43,31,0.04)", animation: "txIn 0.4s ease both" }}>
            <div style={{ color: "rgba(61,43,31,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>All Transactions</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {transactions.map((tx, idx) => (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: idx < transactions.length - 1 ? "1px solid rgba(197,180,162,0.18)" : "none" }}>
                  <div>
                    <div style={{ color: "#3D2B1F", fontSize: 13, fontWeight: 600 }}>{tx.description ?? (tx.type === "credit" ? "Top-up" : "Debit")}</div>
                    <div style={{ color: "rgba(61,43,31,0.35)", fontSize: 11, marginTop: 2 }}>{new Date(tx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                    {tx.upi_ref && tx.upi_ref.startsWith("TUP-") && (
                      <div style={{ color: "rgba(61,43,31,0.25)", fontSize: 10, fontFamily: "monospace", marginTop: 1 }}>ID: {tx.upi_ref}</div>
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
      </div>
    </div>
  );
}
