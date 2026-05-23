import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { setMLBBTarget } from "./MLBBTargetPage";
import { setSelectedPackage } from "./PaymentPage";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

interface GamePackage {
  id: number;
  name: string | null;
  diamonds: number;
  bonus_diamonds: number;
  price: string;
  old_price?: string | null;
  label: string | null;
  is_popular: boolean;
  category: string | null;
  status?: string;
  image?: string | null;
  game_id?: number | null;
}

interface GameInfo {
  id: number;
  name: string;
  image: string | null;
}

function getCurrencyLabel(name: string) {
  const n = name.toLowerCase();
  if (n.includes("bgmi") || n.includes("pubg")) return "UC";
  if (n.includes("genshin")) return "Crystals";
  if (n.includes("honor of kings") || n.includes("hok")) return "Tokens";
  if (n.includes("free fire") || n.includes("freefire")) return "Diamonds";
  if (n.includes("clash") || n.includes("brawl")) return "Gems";
  if (n.includes("valorant")) return "VP";
  if (n.includes("mobile legends") || n.includes("mlbb")) return "Diamonds";
  return "Credits";
}

function isMlbbGame(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("mobile legends") || n.includes("mlbb") || n.includes("bang bang");
}

function DiamondSVG({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon points="20,4 36,14 36,26 20,36 4,26 4,14" stroke="rgba(245,158,11,0.55)" strokeWidth="1.5" fill="rgba(245,158,11,0.1)" />
      <polygon points="20,4 36,14 20,22 4,14" fill="rgba(245,158,11,0.18)" />
    </svg>
  );
}

export default function GameProductsPage() {
  const [location, setLocation] = useLocation();
  const gameId = location.split("/").filter(Boolean).pop();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [packages, setPackages] = useState<GamePackage[]>([]);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState("");
  const [serverId, setServerId] = useState("");
  const [idError, setIdError] = useState("");

  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    setGame(null);
    setPackages([]);
    setUserId("");
    setServerId("");
    setIdError("");
    Promise.all([
      fetch(`${API}/games/${gameId}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/packages?game_id=${gameId}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([gameData, pkgs]) => {
      setGame(gameData);
      const active = Array.isArray(pkgs)
        ? pkgs.filter((p: GamePackage) => p.status !== "out_of_stock" && p.status !== "coming_soon")
        : [];
      setPackages(active);
    }).finally(() => setLoading(false));
  }, [gameId]);

  const currencyLabel = game ? getCurrencyLabel(game.name) : "Currency";
  const isMLBB = game ? isMlbbGame(game.name) : false;

  const handleBuyNow = useCallback((pkg: GamePackage) => {
    if (!userId.trim()) {
      setIdError(isMLBB ? "Please enter your User ID first." : "Please enter your Player ID first.");
      return;
    }
    setIdError("");
    setMLBBTarget({
      userId: userId.trim(),
      serverId: isMLBB ? serverId.trim() : "",
      ign: "",
      isForFriend: false,
      gameName: game?.name || "",
      currencyLabel,
    });
    setSelectedPackage({
      id: pkg.id,
      diamonds: pkg.diamonds,
      bonus_diamonds: pkg.bonus_diamonds,
      price: pkg.price,
      old_price: pkg.old_price ?? null,
      name: pkg.name,
      category: pkg.category,
      image: pkg.image ?? null,
      gameName: game?.name || "",
      currencyLabel,
    });
    setLocation("/pay");
  }, [userId, serverId, isMLBB, game, currencyLabel, setLocation]);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: 64 }}>
      <style>{`
        @keyframes gpFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes gpPulse { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
        @keyframes gpCardIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
      `}</style>

      {/* Sticky Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,10,0.93)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: "1px solid rgba(245,158,11,0.13)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => setLocation("/")}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 12px", color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </button>
        {game && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
            {game.image && (
              <img src={game.image} alt={game.name} style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(245,158,11,0.3)" }} />
            )}
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.name}</span>
          </div>
        )}
      </div>

      {/* Game Banner */}
      {game?.image && (
        <div style={{ height: 110, overflow: "hidden", position: "relative" }}>
          <img src={game.image} alt={game.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.55)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,10,10,0) 25%, #0a0a0a 100%)" }} />
          <div style={{ position: "absolute", bottom: 12, left: 16 }}>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>{game.name}</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>Instant {currencyLabel} top-up · Best rates</div>
          </div>
        </div>
      )}

      <div style={{ padding: "16px 14px 0", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── ID Input Card ── */}
        <div style={{ background: "linear-gradient(135deg,#111,#0f0d00)", border: "1.5px solid rgba(245,158,11,0.22)", borderRadius: 18, padding: "16px", animation: "gpFadeIn 0.3s ease" }}>
          <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            {isMLBB ? "Enter Your MLBB Account" : `Enter Your ${game?.name ?? "Game"} ID`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
                {isMLBB ? "User ID" : "Player ID"}
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={userId}
                onChange={e => { setUserId(e.target.value); setIdError(""); }}
                placeholder={isMLBB ? "e.g. 123456789" : "e.g. 987654321"}
                style={{ width: "100%", background: "#1a1a1a", border: `1.5px solid ${idError ? "rgba(239,68,68,0.55)" : userId ? "rgba(245,158,11,0.55)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 15, outline: "none", fontFamily: "'Courier New', monospace", transition: "border-color 0.2s", boxSizing: "border-box" }}
                onFocus={e => !idError && (e.target.style.borderColor = "rgba(245,158,11,0.65)")}
                onBlur={e => { if (!idError && !userId) e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
            </div>
            {isMLBB && (
              <div>
                <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Zone ID (Server)</div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={serverId}
                  onChange={e => setServerId(e.target.value)}
                  placeholder="e.g. 2345"
                  style={{ width: "100%", background: "#1a1a1a", border: `1.5px solid ${serverId ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 15, outline: "none", fontFamily: "'Courier New', monospace", transition: "border-color 0.2s", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(245,158,11,0.65)")}
                  onBlur={e => { if (!serverId) e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                />
              </div>
            )}
          </div>
          {idError && (
            <div style={{ marginTop: 8, color: "#ef4444", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/><path d="M12 8v5M12 16.5v.5" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"/></svg>
              {idError}
            </div>
          )}
          {userId && !idError && (
            <div style={{ marginTop: 8, color: "rgba(34,197,94,0.8)", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ID entered — select a package below to purchase
            </div>
          )}
        </div>

        {/* ── Packages Grid ── */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ height: 170, borderRadius: 16, background: "rgba(255,255,255,0.04)", animation: "gpPulse 1.5s infinite" }} />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 14, lineHeight: 1 }}>🎮</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Coming Soon</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Packages for {game?.name ?? "this game"} are being set up.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.09em", textTransform: "uppercase" }}>
              {packages.length} pack{packages.length !== 1 ? "s" : ""} available
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {packages.map((pkg, idx) => {
                const total = pkg.diamonds + (pkg.bonus_diamonds || 0);
                const hasOldPrice = pkg.old_price && parseFloat(pkg.old_price) > parseFloat(pkg.price);
                const isPopular = pkg.is_popular || pkg.label === "MOST POPULAR";
                return (
                  <div
                    key={pkg.id}
                    style={{
                      background: "linear-gradient(145deg,#111,#0d0d0d)",
                      border: isPopular ? "1.5px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                      padding: "14px 12px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 9,
                      animation: `gpCardIn 0.3s ease ${idx * 0.04}s both`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Badge */}
                    {isPopular && (
                      <div style={{ position: "absolute", top: 0, right: 0, background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#000", fontSize: 8, fontWeight: 800, padding: "3px 9px", borderRadius: "0 16px 0 8px", letterSpacing: "0.06em" }}>POPULAR</div>
                    )}
                    {pkg.label && pkg.label !== "MOST POPULAR" && (
                      <div style={{ position: "absolute", top: 0, right: 0, background: pkg.label.toLowerCase().includes("2x") || pkg.label.toLowerCase().includes("first") ? "linear-gradient(135deg,#ef4444,#dc2626)" : "rgba(99,102,241,0.85)", color: "#fff", fontSize: 8, fontWeight: 800, padding: "3px 9px", borderRadius: "0 16px 0 8px", letterSpacing: "0.04em" }}>{pkg.label}</div>
                    )}

                    {/* Icon */}
                    <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: pkg.image ? "transparent" : "rgba(245,158,11,0.07)", border: pkg.image ? "none" : "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pkg.image ? (
                        <img src={pkg.image} alt={pkg.name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <DiamondSVG size={28} />
                      )}
                    </div>

                    {/* Name + currency */}
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 3 }}>
                        {pkg.name || `${total.toLocaleString()} ${currencyLabel}`}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 11 }}>
                        {total.toLocaleString()} {currencyLabel}
                        {pkg.bonus_diamonds > 0 && <span style={{ color: "#4ade80" }}> +{pkg.bonus_diamonds.toLocaleString()}</span>}
                      </div>
                    </div>

                    {/* Price */}
                    <div>
                      {hasOldPrice && (
                        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textDecoration: "line-through" }}>₹{parseFloat(pkg.old_price!).toFixed(0)}</div>
                      )}
                      <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 17, lineHeight: 1 }}>₹{parseFloat(pkg.price).toFixed(0)}</div>
                    </div>

                    {/* Buy Now */}
                    <button
                      onClick={() => handleBuyNow(pkg)}
                      style={{
                        width: "100%",
                        padding: "9px 0",
                        borderRadius: 10,
                        background: userId.trim() ? "linear-gradient(135deg,#fcd34d,#f59e0b)" : "rgba(245,158,11,0.1)",
                        color: userId.trim() ? "#000" : "rgba(245,158,11,0.6)",
                        border: userId.trim() ? "none" : "1px solid rgba(245,158,11,0.22)",
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      {userId.trim() ? "Buy Now →" : "Enter ID first"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
