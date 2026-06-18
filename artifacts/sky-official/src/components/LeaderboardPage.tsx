import { useState, useEffect } from "react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

interface LeaderboardEntry {
  rank: number;
  username: string;
  imageUrl: string | null;
  totalSpent: number;
}

function Avatar({ imageUrl, size, rank }: { imageUrl: string | null; size: number; rank: number }) {
  const [errored, setErrored] = useState(false);
  const initials = "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
      background: "rgba(168,148,130,0.15)", border: `2px solid ${rank === 1 ? "rgba(168,148,130,0.7)" : "rgba(197,180,162,0.45)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {imageUrl && !errored ? (
        <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setErrored(true)} />
      ) : (
        <span style={{ color: "rgba(61,43,31,0.4)", fontSize: size * 0.38, fontWeight: 700 }}>{initials}</span>
      )}
    </div>
  );
}

function PodiumPlace({ entry, height, label }: { entry: LeaderboardEntry; height: number; label: string }) {
  const rankColors: Record<number, string> = { 1: "rgba(168,148,130,0.9)", 2: "rgba(141,110,99,0.7)", 3: "rgba(120,90,75,0.6)" };
  const color = rankColors[entry.rank] || "rgba(168,148,130,0.5)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
      {/* Avatar above podium */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingBottom: 4 }}>
        <Avatar imageUrl={entry.imageUrl} size={entry.rank === 1 ? 64 : 52} rank={entry.rank} />
        <div style={{ color: "#3D2B1F", fontWeight: 800, fontSize: entry.rank === 1 ? 13 : 12, textAlign: "center", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          @{entry.username}
        </div>
        <div style={{ color: "rgba(61,43,31,0.55)", fontSize: 11, fontWeight: 600 }}>
          ₹{entry.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </div>
      </div>
      {/* Podium block */}
      <div style={{
        width: "100%", height, borderRadius: "10px 10px 0 0",
        background: `linear-gradient(180deg, ${color} 0%, rgba(168,148,130,0.2) 100%)`,
        border: `1px solid ${color}`,
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10,
        borderBottom: "none",
      }}>
        <span style={{ color: "#3D2B1F", fontWeight: 900, fontSize: entry.rank === 1 ? 22 : 18, opacity: 0.7 }}>
          {label}
        </span>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/leaderboard`)
      .then(r => r.json())
      .then(data => {
        if (data.leaderboard) setEntries(data.leaderboard);
        else setError("Failed to load.");
      })
      .catch(() => setError("Could not connect."))
      .finally(() => setLoading(false));
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [
    top3[1] ? { entry: top3[1], height: 90, label: "2" } : null,
    top3[0] ? { entry: top3[0], height: 120, label: "1" } : null,
    top3[2] ? { entry: top3[2], height: 70, label: "3" } : null,
  ].filter(Boolean) as { entry: LeaderboardEntry; height: number; label: string }[];

  return (
    <div style={{ background: "#FAF9F6", minHeight: "100vh", paddingBottom: 60 }}>
      <style>{`
        @keyframes lbIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .lb-row { display:flex;align-items:center;gap:12px;padding:12px 16px;background:#FFFFFF;border-bottom:1px solid rgba(197,180,162,0.2);transition:background 0.15s; }
        .lb-row:hover { background:rgba(168,148,130,0.05); }
        .lb-row:last-child { border-bottom:none; }
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
          <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Leaderboard</div>
          <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 10 }}>Top spenders on Sky Official</div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "72px 0 0" }}>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12 }}>
            <div style={{ width: 24, height: 24, border: "2.5px solid rgba(168,148,130,0.25)", borderTopColor: "#A89482", borderRadius: "50%", animation: "lbIn 0.7s linear infinite" }} />
            <span style={{ color: "rgba(61,43,31,0.4)", fontSize: 14 }}>Loading leaderboard…</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(61,43,31,0.4)", fontSize: 14 }}>{error}</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "rgba(61,43,31,0.35)", fontSize: 14 }}>
            No data yet. Be the first on the leaderboard!
          </div>
        )}

        {!loading && entries.length > 0 && (
          <>
            {/* Podium */}
            <div style={{ padding: "28px 16px 0", animation: "lbIn 0.4s ease both" }}>
              <div style={{ textAlign: "center", color: "rgba(61,43,31,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
                Hall of Fame
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                {podiumOrder.map(({ entry, height, label }) => (
                  <PodiumPlace key={entry.rank} entry={entry} height={height} label={label} />
                ))}
              </div>
            </div>

            {/* Divider */}
            {rest.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 16px 8px" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(197,180,162,0.35)" }} />
                <span style={{ color: "rgba(61,43,31,0.35)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Ranks 4 – {entries.length}</span>
                <div style={{ flex: 1, height: 1, background: "rgba(197,180,162,0.35)" }} />
              </div>
            )}

            {/* Ranked list 4–20 */}
            {rest.length > 0 && (
              <div style={{ margin: "0 16px", background: "#FFFFFF", borderRadius: 16, border: "1px solid rgba(197,180,162,0.35)", overflow: "hidden", boxShadow: "0 2px 8px rgba(61,43,31,0.04)", animation: "lbIn 0.4s ease 0.08s both" }}>
                {rest.map((entry) => (
                  <div key={entry.rank} className="lb-row">
                    <span style={{ color: "rgba(61,43,31,0.35)", fontWeight: 800, fontSize: 13, width: 24, flexShrink: 0, textAlign: "center" }}>
                      {entry.rank}
                    </span>
                    <Avatar imageUrl={entry.imageUrl} size={36} rank={entry.rank} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        @{entry.username}
                      </div>
                    </div>
                    <div style={{ color: "rgba(61,43,31,0.6)", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      ₹{entry.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
