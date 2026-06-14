import { useState, useEffect, useCallback } from "react";
import { getCached, cachedFetch, setCached } from "../lib/apiCache";
import { useLocation } from "wouter";
import { setMLBBTarget } from "./MLBBTargetPage";
import { setSelectedPackage } from "./PaymentPage";
import { useCart } from "../context/CartContext";
import { useAuth } from "@clerk/react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

const FAV_KEY = "skyFavoritePkgs";
const FAV_FULL_KEY = "skyFavoritePkgsFull";

function loadFavs(): number[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
}
function saveFavs(ids: number[]) { localStorage.setItem(FAV_KEY, JSON.stringify(ids)); }
export function getFavoritePkgIds(): number[] { return loadFavs(); }

export interface FavoritePack {
  id: number;
  game_id: number;
  game_name: string;
  name: string | null;
  diamonds: number;
  bonus_diamonds: number;
  price: string;
  old_price?: string | null;
  image?: string | null;
  category: string | null;
  currency_label: string;
}
function loadFavsFull(): FavoritePack[] {
  try { return JSON.parse(localStorage.getItem(FAV_FULL_KEY) || "[]"); } catch { return []; }
}
function saveFavsFull(packs: FavoritePack[]) { localStorage.setItem(FAV_FULL_KEY, JSON.stringify(packs)); }
export function getFavoritePackages(): FavoritePack[] { return loadFavsFull(); }
export function removeFavoritePackage(id: number) {
  saveFavs(loadFavs().filter(x => x !== id));
  saveFavsFull(loadFavsFull().filter(p => p.id !== id));
}

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

function isStarlightGame(name: string): boolean {
  return name.toLowerCase().includes("starlight");
}

const WA_SUPPORT = "919362003788";

function DiamondSVG({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon points="20,4 36,14 36,26 20,36 4,26 4,14" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5" fill="rgba(139,92,246,0.1)" />
      <polygon points="20,4 36,14 20,22 4,14" fill="rgba(139,92,246,0.18)" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#ef4444">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="rgba(61,43,31,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function GameProductsPage() {
  const [location, setLocation] = useLocation();
  const gameId = location.split("/").filter(Boolean).pop();
  const gameCacheKey = gameId ? `${API}/games/${gameId}` : null;
  const pkgCacheKey = gameId ? `${API}/packages?game_id=${gameId}` : null;
  const [game, setGame] = useState<GameInfo | null>(() => gameCacheKey ? getCached<GameInfo>(gameCacheKey) ?? null : null);
  const [packages, setPackages] = useState<GamePackage[]>(() => {
    if (!pkgCacheKey) return [];
    const cached = getCached<GamePackage[]>(pkgCacheKey);
    if (!cached) return [];
    return cached.filter((p: GamePackage) => p.status !== "out_of_stock" && p.status !== "coming_soon");
  });
  const [loading, setLoading] = useState(() => !gameCacheKey || !getCached(gameCacheKey));

  const [userId, setUserId] = useState("");
  const [serverId, setServerId] = useState("");
  const [idError, setIdError] = useState("");

  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "wallet">("upi");
  const [favorites, setFavorites] = useState<number[]>(loadFavs);
  const [walletBuying, setWalletBuying] = useState(false);
  const [walletResult, setWalletResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showWalletConfirm, setShowWalletConfirm] = useState(false);
  const [cartAdded, setCartAdded] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  const { addToCart } = useCart();
  const { getToken, isSignedIn } = useAuth();

  const selectedPkg = packages.find(p => p.id === selectedPkgId) ?? null;

  useEffect(() => { setQuantity(1); setWalletResult(null); }, [selectedPkgId]);

  useEffect(() => {
    if (!gameId || !gameCacheKey || !pkgCacheKey) return;
    const alreadyCached = !!getCached(gameCacheKey);
    if (!alreadyCached) {
      setLoading(true);
      setGame(null);
      setPackages([]);
    }
    setUserId("");
    setServerId("");
    setIdError("");
    setSelectedPkgId(null);
    Promise.all([
      cachedFetch<GameInfo | null>(gameCacheKey).catch(() => null),
      cachedFetch<GamePackage[]>(pkgCacheKey).catch(() => []),
    ]).then(([gameData, pkgs]) => {
      setGame(gameData);
      const active = Array.isArray(pkgs)
        ? pkgs.filter((p: GamePackage) => p.status !== "out_of_stock" && p.status !== "coming_soon")
        : [];
      setPackages(active);
      const pendingId = sessionStorage.getItem("pendingSelectPkgId");
      if (pendingId) {
        sessionStorage.removeItem("pendingSelectPkgId");
        const pkgId = Number(pendingId);
        if (active.find((p: GamePackage) => p.id === pkgId)) setSelectedPkgId(pkgId);
      }
    }).finally(() => setLoading(false));
  }, [gameId, gameCacheKey, pkgCacheKey]);

  const currencyLabel = game ? getCurrencyLabel(game.name) : "Currency";
  const isMLBB = game ? isMlbbGame(game.name) : false;
  const isStarlight = game ? isStarlightGame(game.name) : false;

  const toggleFav = useCallback((pkg: GamePackage) => {
    const id = pkg.id;
    setFavorites(prev => {
      const isFav = prev.includes(id);
      const next = isFav ? prev.filter(x => x !== id) : [...prev, id];
      saveFavs(next);
      const fullFavs = loadFavsFull();
      if (isFav) {
        saveFavsFull(fullFavs.filter(p => p.id !== id));
      } else {
        saveFavsFull([...fullFavs.filter(p => p.id !== id), {
          id: pkg.id,
          game_id: pkg.game_id ?? 0,
          game_name: game?.name ?? "",
          name: pkg.name,
          diamonds: pkg.diamonds,
          bonus_diamonds: pkg.bonus_diamonds,
          price: pkg.price,
          old_price: pkg.old_price,
          image: pkg.image,
          category: pkg.category,
          currency_label: currencyLabel,
        }]);
      }
      return next;
    });
  }, [game, currencyLabel]);

  const handleStarlightBuy = useCallback(() => {
    if (!selectedPkg) return;
    if (!userId.trim()) { setIdError("Please enter your User ID first."); return; }
    setIdError("");
    const total = selectedPkg.diamonds + (selectedPkg.bonus_diamonds || 0);
    const pkgName = selectedPkg.name || `${total.toLocaleString()} ${currencyLabel}`;
    const msg = encodeURIComponent(
      `Hello! I'd like to order:\n*${pkgName}*\nPrice: ₹${parseFloat(selectedPkg.price).toFixed(0)}\nUser ID: ${userId.trim()}\nGame: ${game?.name ?? "Starlight"}`
    );
    window.open(`https://wa.me/${WA_SUPPORT}?text=${msg}`, "_blank", "noopener,noreferrer");
  }, [selectedPkg, userId, game, currencyLabel]);

  const handleBuy = useCallback(async () => {
    if (!selectedPkg) return;
    if (!userId.trim()) {
      setIdError(isMLBB ? "Please enter your User ID first." : "Please enter your Player ID first.");
      return;
    }
    setIdError("");

    if (paymentMethod === "wallet") {
      if (!isSignedIn) { setIdError("Please sign in to use wallet."); return; }
      setWalletBuying(true);
      setWalletResult(null);
      try {
        const token = await getToken();
        let firstOrderId: number | null = null;
        let firstDisplayId = "";
        for (let i = 0; i < quantity; i++) {
          const res = await fetch(`/api/orders/wallet-pay`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ packageId: selectedPkg.id, mlbbUserId: userId.trim(), mlbbServerId: isMLBB ? serverId.trim() : "", mlbbIgn: "", isForFriend: false }),
          });
          const data = await res.json();
          if (!res.ok) {
            setWalletResult({ ok: false, msg: data.error || "Wallet payment failed. Please try again." });
            setWalletBuying(false);
            return;
          }
          if (i === 0) { firstOrderId = data.id; firstDisplayId = data.displayId || ""; }
        }
        const totalDiamonds = (selectedPkg.diamonds + (selectedPkg.bonus_diamonds || 0)) * quantity;
        sessionStorage.setItem("walletConfirm", JSON.stringify({
          orderId: firstOrderId,
          displayId: firstDisplayId,
          diamonds: totalDiamonds,
          price: String(parseFloat(selectedPkg.price) * quantity),
          userId: userId.trim(),
          currencyLabel,
          gameName: game?.name || "",
        }));
        setSelectedPkgId(null);
        setLocation("/pay");
      } catch {
        setWalletResult({ ok: false, msg: "Network error. Please try again." });
      } finally {
        setWalletBuying(false);
      }
      return;
    }

    setMLBBTarget({
      userId: userId.trim(),
      serverId: isMLBB ? serverId.trim() : "",
      ign: "",
      isForFriend: false,
      gameName: game?.name || "",
      currencyLabel,
    });
    setSelectedPackage({
      id: selectedPkg.id,
      diamonds: selectedPkg.diamonds,
      bonus_diamonds: selectedPkg.bonus_diamonds,
      price: selectedPkg.price,
      old_price: selectedPkg.old_price ?? null,
      name: selectedPkg.name,
      category: selectedPkg.category,
      image: selectedPkg.image ?? null,
      gameName: game?.name || "",
      currencyLabel,
      gameId: gameId ? Number(gameId) : undefined,
    });
    sessionStorage.setItem("preferredPaymentMethod", paymentMethod);
    if (quantity > 1) sessionStorage.setItem("orderQuantity", String(quantity));
    else sessionStorage.removeItem("orderQuantity");
    setLocation("/pay");
  }, [selectedPkg, userId, serverId, isMLBB, game, currencyLabel, paymentMethod, setLocation, isSignedIn, getToken, quantity]);

  return (
    <div style={{ background: "transparent", minHeight: "100vh", paddingBottom: 80 }}>
      <style>{`
        @keyframes gpFadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes gpPulse   { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
        @keyframes gpBankSkel{ 0%,100%{opacity:0.35} 50%{opacity:0.65} }
        @keyframes gpCardIn  { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes gpCoIn    { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── Game Banner — starts at top-0, sits behind the global navbar ── */}
      <div style={{ height: 210, overflow: "hidden", position: "relative", background: "#1a1228" }}>
        {loading ? (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(139,92,246,0.06),rgba(0,0,0,0))", animation: "gpBankSkel 1.6s ease-in-out infinite" }} />
        ) : game?.image ? (
          <>
            <img src={game.image} alt={game.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.42)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(26,18,40,0.05) 30%, #FAF9F6 100%)" }} />
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(139,92,246,0.07),rgba(0,0,0,0))" }} />
        )}
        {/* Back button positioned below the global navbar (~68px from top) */}
        <button
          onClick={() => setLocation("/")}
          style={{ position: "absolute", top: 84, left: 14, zIndex: 10, background: "rgba(4,4,8,0.72)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderRadius: 999, padding: "7px 14px 7px 10px", color: "rgba(255,255,255,0.8)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,0,0,0.5)", WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </button>
        {game && (
          <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
            <div style={{ color: "#1a1a1a", fontSize: 18, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.name}</div>
            <div style={{ color: "rgba(0,0,0,0.5)", fontSize: 11, marginTop: 3 }}>Instant {currencyLabel} top-up · Best rates</div>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 14px 0", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Step 1: Enter ID ── */}
        <div style={{ background: "#FFFFFF", border: "1.5px solid rgba(197,180,162,0.4)", borderRadius: 18, padding: "16px", animation: "gpFadeIn 0.3s ease", boxShadow: "0 1px 4px rgba(61,43,31,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#fff", flexShrink: 0 }}>1</div>
            <span style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {isMLBB ? "Enter Your MLBB Account" : `Enter Your ${game?.name ?? "Game"} ID`}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
                {isMLBB ? "User ID" : "Player ID"}
              </div>
              <input
                type="number" inputMode="numeric" value={userId}
                onChange={e => { setUserId(e.target.value); setIdError(""); }}
                placeholder={isMLBB ? "e.g. 123456789" : "e.g. 987654321"}
                style={{ width: "100%", background: "#FAF9F6", border: `1.5px solid ${idError ? "rgba(239,68,68,0.55)" : userId ? "rgba(139,92,246,0.55)" : "rgba(197,180,162,0.4)"}`, borderRadius: 12, padding: "12px 14px", color: "#3D2B1F", fontSize: 15, outline: "none", fontFamily: "'Courier New', monospace", transition: "border-color 0.2s", boxSizing: "border-box" }}
                onFocus={e => !idError && (e.target.style.borderColor = "rgba(139,92,246,0.65)")}
                onBlur={e => { if (!idError && !userId) e.target.style.borderColor = "rgba(197,180,162,0.4)"; }}
              />
            </div>
            {isMLBB && (
              <div>
                <div style={{ color: "rgba(61,43,31,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Zone ID (Server)</div>
                <input
                  type="number" inputMode="numeric" value={serverId}
                  onChange={e => setServerId(e.target.value)}
                  placeholder="e.g. 2345"
                  style={{ width: "100%", background: "#FAF9F6", border: `1.5px solid ${serverId ? "rgba(139,92,246,0.45)" : "rgba(197,180,162,0.4)"}`, borderRadius: 12, padding: "12px 14px", color: "#3D2B1F", fontSize: 15, outline: "none", fontFamily: "'Courier New', monospace", transition: "border-color 0.2s", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.65)")}
                  onBlur={e => { if (!serverId) e.target.style.borderColor = "rgba(197,180,162,0.4)"; }}
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
              ID entered — select a pack below
            </div>
          )}
        </div>

        {/* ── Step 2: Select Pack ── */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ borderRadius: 16, background: "rgba(197,180,162,0.15)", border: "1px solid rgba(197,180,162,0.25)", minHeight: 140, animation: `gpPulse 1.6s ease-in-out ${i * 0.09}s infinite` }} />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 14, lineHeight: 1 }}>🎮</div>
            <div style={{ color: "rgba(61,43,31,0.65)", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Coming Soon</div>
            <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 13 }}>Packages for {game?.name ?? "this game"} are being set up.</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#fff", flexShrink: 0 }}>2</div>
              <span style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Select Pack</span>
              <span style={{ color: "rgba(61,43,31,0.35)", fontSize: 10, marginLeft: "auto" }}>{packages.length} available</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {packages.map((pkg, idx) => {
                const total = pkg.diamonds + (pkg.bonus_diamonds || 0);
                const hasOldPrice = pkg.old_price && parseFloat(pkg.old_price) > parseFloat(pkg.price);
                const isSelected = selectedPkgId === pkg.id;
                const isFav = favorites.includes(pkg.id);
                const showBadge = pkg.is_popular || (pkg.label && pkg.label !== "");
                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPkgId(pkg.id)}
                    style={{
                      background: isSelected ? "rgba(139,92,246,0.07)" : "#FFFFFF",
                      border: isSelected ? "2px solid #8b5cf6" : "1px solid rgba(197,180,162,0.35)",
                      borderRadius: 16,
                      padding: "5px 7px 4px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      animation: `gpCardIn 0.3s ease ${idx * 0.04}s both`,
                      position: "relative",
                      overflow: "hidden",
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 0 0 2px rgba(139,92,246,0.15), 0 4px 16px rgba(139,92,246,0.1)" : "0 1px 3px rgba(61,43,31,0.06)",
                      transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {showBadge && (
                      <div style={{ position: "absolute", top: 0, left: 0, background: pkg.is_popular ? "linear-gradient(135deg,#8b5cf6,#7c3aed)" : "rgba(139,92,246,0.75)", color: "#fff", fontSize: 8, fontWeight: 800, padding: "3px 8px", borderRadius: "16px 0 8px 0", letterSpacing: "0.04em", zIndex: 1 }}>
                        {pkg.is_popular ? "POPULAR" : pkg.label}
                      </div>
                    )}

                    {/* Top: icon + price + heart */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: pkg.image ? "transparent" : "rgba(139,92,246,0.1)", border: pkg.image ? "none" : "1px solid rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {pkg.image ? <img src={pkg.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <DiamondSVG size={22} />}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <div style={{ textAlign: "right" }}>
                          {hasOldPrice && <div style={{ color: "rgba(61,43,31,0.3)", fontSize: 10, textDecoration: "line-through", lineHeight: 1 }}>₹{parseFloat(pkg.old_price!).toFixed(0)}</div>}
                          <div style={{ color: isSelected ? "#a78bfa" : "#8b5cf6", fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>₹{parseFloat(pkg.price).toFixed(0)}</div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); toggleFav(pkg); }}
                          style={{ background: isFav ? "rgba(239,68,68,0.1)" : "rgba(61,43,31,0.04)", border: isFav ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(197,180,162,0.35)", borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent", transition: "all 0.15s" }}
                          title={isFav ? "Remove from favourites" : "Add to favourites"}
                        >
                          <HeartIcon filled={isFav} />
                        </button>
                      </div>
                    </div>

                    {/* Name + currency */}
                    <div>
                      <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 12, lineHeight: 1.3, marginBottom: 2 }}>
                        {pkg.name || `${total.toLocaleString()} ${currencyLabel}`}
                      </div>
                      <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 10 }}>
                        {pkg.diamonds.toLocaleString()} {currencyLabel}
                        {pkg.bonus_diamonds > 0 && <span style={{ color: "#4ade80" }}> +{pkg.bonus_diamonds.toLocaleString()} bonus</span>}
                      </div>
                    </div>

                    {/* Add to Cart button */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        addToCart({ id: pkg.id, diamonds: pkg.diamonds, bonus_diamonds: pkg.bonus_diamonds, price: pkg.price, old_price: pkg.old_price ?? null, name: pkg.name, category: pkg.category, image: pkg.image ?? null, gameName: game?.name || "", currencyLabel });
                        setCartAdded(pkg.id);
                        setTimeout(() => setCartAdded(null), 1800);
                      }}
                      style={{ background: cartAdded === pkg.id ? "rgba(34,197,94,0.15)" : "rgba(139,92,246,0.1)", border: `1px solid ${cartAdded === pkg.id ? "rgba(34,197,94,0.4)" : "rgba(139,92,246,0.3)"}`, borderRadius: 8, padding: "4px 8px", color: cartAdded === pkg.id ? "#4ade80" : "#a78bfa", fontSize: 10, fontWeight: 700, cursor: "pointer", width: "100%", transition: "all 0.2s", WebkitTapHighlightColor: "transparent" }}
                    >
                      {cartAdded === pkg.id ? "✓ Added!" : "🛒 Add to Cart"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Secure Checkout ── */}
        {selectedPkg && (
          <div style={{ background: "#FFFFFF", border: "1.5px solid rgba(197,180,162,0.4)", borderRadius: 18, padding: "16px", animation: "gpCoIn 0.28s ease both", boxShadow: "0 1px 4px rgba(61,43,31,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#fff", flexShrink: 0 }}>3</div>
              <span style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Secure Checkout</span>
            </div>

            {/* Pack Snapshot */}
            <div style={{ background: "rgba(139,92,246,0.05)", borderRadius: 12, border: "1px solid rgba(139,92,246,0.15)", padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Pack Snapshot</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", background: selectedPkg.image ? "transparent" : "rgba(139,92,246,0.08)", border: selectedPkg.image ? "none" : "1px solid rgba(139,92,246,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {selectedPkg.image ? <img src={selectedPkg.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <DiamondSVG size={22} />}
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ color: "#3D2B1F", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedPkg.name || `${(selectedPkg.diamonds + selectedPkg.bonus_diamonds).toLocaleString()} ${currencyLabel}`}
                    </div>
                    <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 11 }}>
                      {(selectedPkg.diamonds + selectedPkg.bonus_diamonds).toLocaleString()} {currencyLabel}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {selectedPkg.old_price && parseFloat(selectedPkg.old_price) > parseFloat(selectedPkg.price) && (
                    <div style={{ color: "rgba(61,43,31,0.3)", fontSize: 10, textDecoration: "line-through" }}>₹{parseFloat(selectedPkg.old_price).toFixed(0)}</div>
                  )}
                  <div style={{ color: "#8b5cf6", fontWeight: 800, fontSize: 16 }}>₹{parseFloat(selectedPkg.price).toFixed(0)}</div>
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            {!isStarlight && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Quantity</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.35)", color: "#3D2B1F", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>−</button>
                  <span style={{ color: "#3D2B1F", fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: "center" }}>{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(10, q + 1))} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.35)", color: "#3D2B1F", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>+</button>
                  {quantity > 1 && (
                    <span style={{ color: "rgba(61,43,31,0.4)", fontSize: 11, marginLeft: 4 }}>= ₹{(parseFloat(selectedPkg!.price) * quantity).toFixed(0)} total</span>
                  )}
                </div>
              </div>
            )}

            {/* Payment Method */}
            {!isStarlight && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Payment Method</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["upi", "wallet"] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: paymentMethod === method ? "rgba(139,92,246,0.1)" : "rgba(61,43,31,0.03)", border: paymentMethod === method ? "2px solid rgba(139,92,246,0.55)" : "1px solid rgba(197,180,162,0.35)", color: paymentMethod === method ? "#8b5cf6" : "rgba(61,43,31,0.5)", fontWeight: 700, fontSize: 12, cursor: "pointer", transition: "all 0.15s", WebkitTapHighlightColor: "transparent" }}
                    >
                      {method === "upi" ? "💳 UPI" : "💰 Wallet"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet Result */}
            {walletResult && (
              <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: walletResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${walletResult.ok ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`, color: walletResult.ok ? "#4ade80" : "#f87171", fontSize: 12, fontWeight: 600 }}>
                {walletResult.ok ? "✅ " : "❌ "}{walletResult.msg}
              </div>
            )}

            {/* Wallet Confirmation Dialog */}
            {showWalletConfirm && selectedPkg && (
              <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                <div style={{ background: "#FFFFFF", borderRadius: 18, padding: "24px 22px 20px", maxWidth: 320, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
                  <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>💳</div>
                  <div style={{ color: "#3D2B1F", fontWeight: 800, fontSize: 16, textAlign: "center", marginBottom: 8 }}>Confirm Payment</div>
                  <div style={{ color: "rgba(61,43,31,0.65)", fontSize: 14, lineHeight: 1.65, marginBottom: 22, textAlign: "center" }}>
                    <span style={{ fontWeight: 800, color: "#7c3aed", fontSize: 18 }}>₹{(parseFloat(selectedPkg.price) * quantity).toFixed(0)}</span><br />
                    will be deducted from your wallet balance. Continue?
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowWalletConfirm(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "1px solid rgba(139,92,246,0.3)", background: "none", color: "#7c3aed", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>No</button>
                    <button onClick={() => { setShowWalletConfirm(false); handleBuy(); }} style={{ flex: 1, padding: "11px 0", borderRadius: 11, background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Yes</button>
                  </div>
                </div>
              </div>
            )}

            {/* Buy Button */}
            <button
              onClick={() => {
                if (paymentMethod === "wallet" && !isStarlight && selectedPkg && userId.trim()) {
                  setShowWalletConfirm(true);
                  return;
                }
                isStarlight ? handleStarlightBuy() : handleBuy();
              }}
              disabled={!userId.trim() || walletBuying}
              style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: (userId.trim() && !walletBuying) ? "linear-gradient(135deg,#8b5cf6,#7c3aed)" : "rgba(139,92,246,0.12)", color: (userId.trim() && !walletBuying) ? "#fff" : "rgba(139,92,246,0.45)", border: (userId.trim() && !walletBuying) ? "none" : "1px solid rgba(139,92,246,0.18)", fontWeight: 800, fontSize: 15, cursor: (userId.trim() && !walletBuying) ? "pointer" : "not-allowed", transition: "all 0.2s", boxShadow: (userId.trim() && !walletBuying) ? "0 4px 20px rgba(139,92,246,0.3)" : "none", WebkitTapHighlightColor: "transparent" }}
            >
              {walletBuying ? "Processing…" : userId.trim()
                ? (isStarlight ? "Order via WhatsApp →" : paymentMethod === "wallet" ? "Pay with Wallet →" : "Buy Now →")
                : "Enter your ID first (Step 1)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
