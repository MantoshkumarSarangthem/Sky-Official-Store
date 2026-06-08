import { useState } from "react";
import { useLocation } from "wouter";
import { getFavoritePackages, removeFavoritePackage, FavoritePack } from "./GameProductsPage";

function HeartFilledIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#ef4444">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function DiamondSVG({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon points="20,4 36,14 36,26 20,36 4,26 4,14" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5" fill="rgba(139,92,246,0.1)" />
      <polygon points="20,4 36,14 20,22 4,14" fill="rgba(139,92,246,0.18)" />
    </svg>
  );
}

export default function FavoritesPage() {
  const [, setLocation] = useLocation();
  const [favs, setFavs] = useState<FavoritePack[]>(() => getFavoritePackages());

  const handlePackClick = (pack: FavoritePack) => {
    sessionStorage.setItem("pendingSelectPkgId", String(pack.id));
    setLocation(`/game/${pack.game_id}`);
  };

  const handleRemove = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    removeFavoritePackage(id);
    setFavs(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80, paddingTop: 72, background: "transparent" }}>
      <style>{`
        @keyframes favCardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ padding: "16px 14px 0" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setLocation("/")}
            style={{ background: "rgba(61,43,31,0.07)", border: "1px solid rgba(197,180,162,0.5)", borderRadius: 999, padding: "7px 13px 7px 10px", color: "rgba(61,43,31,0.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back
          </button>
          <div>
            <h1 style={{ color: "#3D2B1F", fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>My Favorites</h1>
            <p style={{ color: "rgba(61,43,31,0.45)", fontSize: 11, margin: "2px 0 0" }}>
              {favs.length} saved pack{favs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {favs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 14, textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(239,68,68,0.06)", border: "1.5px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="rgba(239,68,68,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ color: "#3D2B1F", fontSize: 17, fontWeight: 700, marginBottom: 7 }}>No favorites yet</div>
              <div style={{ color: "rgba(61,43,31,0.5)", fontSize: 13, maxWidth: 230 }}>
                Tap the ♡ on any pack to save it here for quick access.
              </div>
            </div>
            <button
              onClick={() => setLocation("/")}
              style={{ marginTop: 8, padding: "11px 28px", borderRadius: 999, background: "#8D6E63", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(141,110,99,0.35)" }}
            >
              Browse Packs
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {favs.map((pack, idx) => {
              const total = pack.diamonds + (pack.bonus_diamonds || 0);
              return (
                <div
                  key={pack.id}
                  onClick={() => handlePackClick(pack)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(197,180,162,0.35)",
                    borderRadius: 16,
                    padding: "10px 10px 8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    animation: `favCardIn 0.3s ease ${idx * 0.05}s both`,
                    boxShadow: "0 1px 4px rgba(61,43,31,0.06)",
                    WebkitTapHighlightColor: "transparent",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(61,43,31,0.1)"; }}
                  onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(61,43,31,0.06)"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: pack.image ? "transparent" : "rgba(139,92,246,0.08)", border: pack.image ? "none" : "1px solid rgba(139,92,246,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pack.image ? <img src={pack.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <DiamondSVG size={24} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div style={{ color: "#8b5cf6", fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>
                        ₹{parseFloat(pack.price).toFixed(0)}
                      </div>
                      <button
                        onClick={e => handleRemove(e, pack.id)}
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                        title="Remove from favourites"
                      >
                        <HeartFilledIcon />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 12, lineHeight: 1.3, marginBottom: 2 }}>
                      {pack.name || `${pack.diamonds.toLocaleString()} ${pack.currency_label}`}
                    </div>
                    <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 10 }}>
                      {total.toLocaleString()} {pack.currency_label}
                      {pack.bonus_diamonds > 0 && <span style={{ color: "#4ade80" }}> +{pack.bonus_diamonds.toLocaleString()} bonus</span>}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(61,43,31,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                      {pack.game_name}
                    </span>
                    <span style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700 }}>Buy →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
