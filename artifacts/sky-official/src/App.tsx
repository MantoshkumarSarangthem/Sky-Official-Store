import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { getCached, cachedFetch, invalidateCache } from "./lib/apiCache";
import AdminPanel from "./components/AdminPanel";
import PackagesSection from "./components/PackagesSection";
import OrderHistoryPage from "./components/OrderHistoryPage";
import ProfilePage from "./components/ProfilePage";
import WalletHistoryPage from "./components/WalletHistoryPage";
import MLBBVerifyPage from "./components/MLBBVerifyPage";
import MLBBTargetPage, { setAfterTargetPath, setTargetGameName } from "./components/MLBBTargetPage";
import LeaderboardPage from "./components/LeaderboardPage";
import CartPage from "./components/CartPage";
import PaymentPage, { setSelectedPackage } from "./components/PaymentPage";
import type { SelectedPackage } from "./components/PaymentPage";
import SupportPage from "./components/SupportPage";
import StaffPortal from "./components/StaffPortal";
import GameProductsPage from "./components/GameProductsPage";
import FavoritesPage from "./components/FavoritesPage";
import RankBoostPage from "./components/RankBoostPage";
import { CartProvider, useCart } from "./context/CartContext";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useUser,
  useClerk,
  useAuth,
} from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";


const NAV_SUBTITLES = [
  "Instant Delivery",
  "Affordable Prices",
  "P2P Chat Support",
  "Secure Transaction",
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

const WARM_URLS = [
  `${API}/packages`,
  `${API}/games`,
  `${API}/settings/category_availability`,
  `${API}/settings/category_popular`,
  `${API}/settings/pack_images`,
  `${API}/settings/pass_images`,
  `${API}/settings/starlight_images`,
  `${API}/settings/promo_banners`,
  `${API}/settings/qr`,
  `${API}/settings/latest_event`,
  `${API}/settings/maintenance`,
  `${API}/stats`,
];

function warmCache() {
  WARM_URLS.forEach(url => cachedFetch(url).catch(() => {}));
}

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  cssLayerName: "clerk",
  options: {
    logoPlacement: "none" as const,
  },
  variables: {
    colorPrimary: "#A89482",
    colorForeground: "#3D2B1F",
    colorMutedForeground: "#7a6558",
    colorDanger: "#ef4444",
    colorBackground: "#FAF9F6",
    colorInput: "#FFFFFF",
    colorInputForeground: "#3D2B1F",
    colorNeutral: "#C5B4A2",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.65rem",
    fontSize: "0.9rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full !shadow-none !bg-transparent",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none !p-0",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none !pt-4",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    header: "hidden",
    socialButtonsBlockButtonArrow: "hidden",
    socialButtonsBlockButton: "!bg-white !border-2 !border-[#C5B4A2]/50 hover:!border-[#A89482] hover:!bg-[#FAF9F6] !transition-all !rounded-lg !h-11 !shadow-none",
    socialButtonsBlockButtonText: "!text-[#3D2B1F] !font-medium !text-sm",
    formFieldLabel: "!text-[#7a6558] !font-medium !text-xs !uppercase !tracking-wide",
    footerActionLink: "!text-[#A89482] !font-semibold hover:!text-[#8a7468]",
    footerActionText: "!text-[#7a6558] !text-sm",
    dividerText: "!text-[#7a6558] !text-xs",
    identityPreviewEditButton: "!text-[#A89482]",
    formFieldSuccessText: "!text-green-600",
    alertText: "!text-red-500 !text-sm",
    socialButtonsBlockButtonIconBox: "!mr-2",
    formButtonPrimary: "!bg-[#A89482] hover:!bg-[#8a7468] !text-white !font-bold !transition-colors !rounded-lg !h-11 !shadow-none",
    formFieldInput: "!bg-white !border-[#C5B4A2] !text-[#3D2B1F] focus:!border-[#A89482] !rounded-lg !h-11 !text-sm",
    footerAction: "!border-t !border-[#C5B4A2]/30 !mt-5",
    dividerLine: "!bg-[#C5B4A2]/30",
    alert: "!border !border-red-300 !bg-red-50 !rounded-lg",
    otpCodeFieldInput: "!bg-white !border-[#C5B4A2] !text-[#3D2B1F]",
    formFieldRow: "gap-3",
    main: "gap-5",
    socialButtons: "gap-2.5",
    formHeader: "hidden",
    footerPages: "!hidden",
    internal__clerk_components_inner: "gap-5",
    formField__username: "!hidden",
  },
};

// ── Animated Diamonds ──────────────────────────────────────────────────────
function AnimatedDiamonds({ size = 80 }: { size?: number }) {
  const s = size * 0.34;
  const lg = size * 0.415;
  const diamonds = [
    { w: s,  h: s,  bg: "linear-gradient(135deg,#f59e0b,#d97706)", shadow: "0 0 10px 3px rgba(245,158,11,0.45)", delay: "0s" },
    { w: lg, h: lg, bg: "linear-gradient(135deg,#fcd34d,#f59e0b)", shadow: "0 0 20px 7px rgba(245,158,11,0.65)", delay: "0.28s" },
    { w: s,  h: s,  bg: "linear-gradient(135deg,#f59e0b,#d97706)", shadow: "0 0 10px 3px rgba(245,158,11,0.45)", delay: "0.56s" },
  ];
  return (
    <div className="flex items-center justify-center" style={{ gap: size * 0.09 }}>
      {diamonds.map((d, i) => (
        <div key={i} style={{ width: d.w, height: d.h, background: d.bg, transform: "rotate(45deg)", borderRadius: 4, boxShadow: d.shadow, flexShrink: 0, animation: "diamondSeq 1.8s ease-in-out infinite", animationDelay: d.delay }} />
      ))}
    </div>
  );
}

// ── Loading Screen ─────────────────────────────────────────────────────────
function LoadingScreen({ isOffline, onRetry }: { isOffline: boolean; onRetry: () => void }) {
  const [showSlow, setShowSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowSlow(true), 7000);
    return () => clearTimeout(t);
  }, []);

  const retryBtn = (
    <button
      onClick={onRetry}
      style={{
        background: "transparent",
        border: "1.5px solid rgba(61,43,31,0.2)",
        borderRadius: 20,
        padding: "7px 22px",
        color: "rgba(61,43,31,0.5)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        letterSpacing: "0.01em",
      }}
    >
      Retry
    </button>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#FAF9F6", zIndex: 9999 }}>
      <div style={{ position: "relative", width: 84, height: 84 }}>
        {/* Comet arc — SVG rotates continuously, dasharray pulses in sync */}
        <svg width="84" height="84" viewBox="0 0 84 84"
          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", animation: "skyComet 1.4s linear infinite" }}>
          <circle cx="42" cy="42" r="38"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="5"
            strokeLinecap="round"
            style={{ animation: "skyCometDash 1.4s ease-in-out infinite" }}
          />
        </svg>
        {/* Bird */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="/logo-phoenix.png" alt="Sky Official" style={{ width: 50, height: 50, objectFit: "contain" }} />
        </div>
      </div>

      {/* Offline: icon + message + retry button */}
      <div style={{
        position: "absolute", bottom: 48, left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        opacity: isOffline ? 1 : 0,
        transition: "opacity 0.5s ease",
        pointerEvents: isOffline ? "auto" : "none",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, letterSpacing: "0.01em" }}>
          Check your internet connection
        </span>
        {retryBtn}
      </div>

      {/* Slow fetch (not offline): message + retry after 7 s */}
      <div style={{
        position: "absolute", bottom: 48, left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        opacity: (!isOffline && showSlow) ? 1 : 0,
        transition: "opacity 0.5s ease",
        pointerEvents: (!isOffline && showSlow) ? "auto" : "none",
      }}>
        <span style={{ color: "rgba(61,43,31,0.45)", fontSize: 13, fontWeight: 500, letterSpacing: "0.01em" }}>
          This is taking longer than expected
        </span>
        {retryBtn}
      </div>
      <style>{`
        @keyframes skyComet {
          from { transform: rotate(-90deg); }
          to   { transform: rotate(270deg); }
        }
        @keyframes skyCometDash {
          0%   { stroke-dasharray: 1, 238; stroke-dashoffset: 0; }
          10%  { stroke-dasharray: 1, 238; stroke-dashoffset: 0; }
          55%  { stroke-dasharray: 180, 238; stroke-dashoffset: -65; }
          85%  { stroke-dasharray: 1, 238; stroke-dashoffset: -237; }
          100% { stroke-dasharray: 1, 238; stroke-dashoffset: -238; }
        }
        @keyframes shimmerLR {
          0%   { background-position: 150% 0; }
          100% { background-position: -150% 0; }
        }
        @keyframes scrollTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes slideTickerName {
          0%, 20% { transform: translateX(0); }
          80%, 100% { transform: translateX(calc(-100% + 56px)); }
        }
      `}</style>
    </div>
  );
}

// ── Cart Nav Icon ───────────────────────────────────────────────────────────
function CartNavIcon({ onClick }: { onClick: () => void }) {
  const { totalItems } = useCart();
  return (
    <button
      onClick={onClick}
      style={{ position: "relative", width: 34, height: 34, borderRadius: "50%", background: totalItems > 0 ? "rgba(141,110,99,0.12)" : "rgba(61,43,31,0.06)", border: totalItems > 0 ? "1px solid rgba(141,110,99,0.45)" : "1px solid rgba(197,180,162,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke={totalItems > 0 ? "#8D6E63" : "rgba(61,43,31,0.55)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      {totalItems > 0 && (
        <span style={{ position: "absolute", top: -4, right: -4, background: "#f59e0b", color: "#000", fontSize: 9, fontWeight: 900, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #0d0d0d" }}>
          {totalItems > 9 ? "9+" : totalItems}
        </span>
      )}
    </button>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { getToken, isSignedIn } = useAuth();

  const hideWallet = location === "/mlbb-target" || location.startsWith("/pay");

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setSubtitleIdx((i) => (i + 1) % NAV_SUBTITLES.length); setVisible(true); }, 400);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setWalletBalance(null); return; }
    getToken().then(token => {
      if (!token) return;
      fetch(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
        .then(r => r.json())
        .then(data => setWalletBalance(Number(data.balance ?? 0)))
        .catch(() => {});
    });
  }, [isSignedIn]);

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!isSignedIn) { setUnreadCount(0); return; }
    let cancelled = false;
    const fetchCount = () => {
      getToken().then(token => {
        if (!token || cancelled) return;
        fetch(`${API}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
          .then(r => r.json())
          .then(data => { if (!cancelled) setUnreadCount(Number(data.count ?? 0)); })
          .catch(() => {});
      });
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isSignedIn]);

  const [hasPendingPayment, setHasPendingPayment] = useState(() => checkPendingPaymentSession());
  useEffect(() => {
    const check = () => setHasPendingPayment(checkPendingPaymentSession());
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e: MouseEvent) => {
      if (!profileMenuRef.current?.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileMenu]);

  return (
  <>
    <nav
      className="fixed z-40 flex items-center justify-between px-3"
      style={{
        top: 10,
        left: 12,
        right: 12,
        height: 48,
        background: "rgba(253,251,247,0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 12,
        boxShadow: "0 0 12px 2px rgba(168,148,130,0.1), 0 4px 20px rgba(61,43,31,0.07)",
        animation: "navSlideDown 0.38s cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <style>{`
        @keyframes navSlideDown {
          from { opacity: 0; transform: translateY(-120%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glitch {
          0%,83%,100% { text-shadow: none; filter: none; }
          84% { text-shadow: -3px 0 #f43f5e, 3px 0 #38bdf8; filter: brightness(1.3); }
          85% { text-shadow: 3px 0 #f43f5e, -3px 0 #a78bfa; filter: brightness(0.8) hue-rotate(20deg); }
          86% { text-shadow: -4px 0 #38bdf8, 3px 0 #f43f5e; filter: brightness(1.5); }
          87% { text-shadow: none; filter: brightness(0.7); }
          88% { text-shadow: 3px 0 #a78bfa, -3px 0 #f43f5e; filter: brightness(1.4) hue-rotate(-15deg); }
          89% { text-shadow: -2px 0 #38bdf8, 2px 0 #f59e0b; filter: brightness(1.2); }
          90% { text-shadow: 4px 0 #f43f5e, -2px 0 #38bdf8; filter: none; }
          91%,100% { text-shadow: none; filter: none; }
        }
        .sky-glitch {
          animation: glitch 4.5s ease-in-out infinite;
          display: block;
          position: relative;
          will-change: filter;
        }
      `}</style>
      <button
        onClick={() => setLocation("/")}
        className="flex items-center gap-2"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
      >
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ background: "#FAF9F6", border: "1.5px solid #7F00FF" }}>
          <img src="/logo.webp" alt="Sky Official" className="w-full h-full object-cover" />
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ position: "relative", height: 26, minWidth: 80 }}>
            <span className="sky-glitch font-extrabold" style={{ color: "#3E2723", fontSize: 13, position: "absolute", top: -1, left: 0, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>Sky Official</span>
            <div style={{ position: "absolute", bottom: 0, left: 0, fontSize: 8, lineHeight: 1, color: "#5D4037", opacity: visible ? 1 : 0, transition: "opacity 0.35s ease", textAlign: "left", whiteSpace: "nowrap", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>{NAV_SUBTITLES[subtitleIdx]}</div>
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2">
        <CartNavIcon onClick={() => setLocation("/cart")} />
        {isSignedIn && walletBalance !== null && !hideWallet && (
          <button
            onClick={() => setLocation("/profile")}
            style={{ display: "flex", alignItems: "center", gap: 4, height: 34, background: "#7F00FF", border: "none", borderRadius: 999, padding: "0 10px 0 6px", cursor: "pointer", flexShrink: 0, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <img src="/scoin.png" alt="S" style={{ width: 16, height: 16, objectFit: "contain" }} />
            <span style={{ color: "#FFFFFF", fontSize: 11, fontWeight: 800 }}>₹{walletBalance.toFixed(0)}</span>
          </button>
        )}
        {isLoaded && (
          user ? (
            <div style={{ position: "relative", display: "flex", alignItems: "center" }} ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(v => !v)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: "50%", touchAction: "manipulation", WebkitTapHighlightColor: "transparent", position: "relative" }}
              >
                <div className="rounded-full overflow-hidden flex-shrink-0" style={{ width: 34, height: 34, boxShadow: showProfileMenu ? "0 0 0 2px rgba(141,110,99,0.4)" : "none", transition: "box-shadow 0.15s" }}>
                  <img src={user.imageUrl} alt={user.firstName ?? "User"} className="w-full h-full object-cover" />
                </div>
                {(unreadCount + (hasPendingPayment ? 1 : 0)) > 0 && (
                  <span style={{ position: "absolute", top: -2, right: -2, width: 10, height: 10, background: "#ef4444", borderRadius: "50%", border: "2px solid #FAF9F6" }} />
                )}
              </button>
              {showProfileMenu && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.5)", borderRadius: 14, boxShadow: "0 8px 30px rgba(61,43,31,0.1)", minWidth: 168, overflow: "hidden", zIndex: 999, animation: "navSlideDown 0.14s ease both" }}>
                  {([
                    { label: "Profile", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, action: () => { setLocation("/profile"); setShowProfileMenu(false); } },
                    { label: "My Orders", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { setLocation("/orders"); setShowProfileMenu(false); } },
                    { label: "My Favorites", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { setLocation("/favorites"); setShowProfileMenu(false); } },
                    { label: "Wallet", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M16 14a1 1 0 110-2 1 1 0 010 2z" fill="currentColor"/><path d="M2 11h20" stroke="currentColor" strokeWidth="1.8"/></svg>, action: () => { setLocation("/profile"); setShowProfileMenu(false); } },
                    { label: "Support", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { setLocation("/support"); setShowProfileMenu(false); } },
                    { label: "Leaderboard", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="14" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="9" y="9" width="4" height="13" rx="1" stroke="currentColor" strokeWidth="1.8"/><rect x="16" y="4" width="4" height="18" rx="1" stroke="currentColor" strokeWidth="1.8"/></svg>, action: () => { setLocation("/leaderboard"); setShowProfileMenu(false); } },
                  ] as { label: string; icon: React.ReactNode; action: () => void }[]).map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="flex items-center gap-2.5 w-full"
                      style={{ padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid rgba(197,180,162,0.25)", color: "#3D2B1F", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,180,162,0.12)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <span style={{ color: "rgba(61,43,31,0.4)", display: "flex" }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  <button
                    onClick={() => { setLocation("/notifications"); setShowProfileMenu(false); setUnreadCount(0); }}
                    className="flex items-center gap-2.5 w-full"
                    style={{ padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid rgba(197,180,162,0.25)", color: "#3D2B1F", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", position: "relative" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(197,180,162,0.12)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <span style={{ color: "rgba(61,43,31,0.4)", display: "flex" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    Notifications
                    {(unreadCount + (hasPendingPayment ? 1 : 0)) > 0 && (
                      <span style={{ marginLeft: "auto", minWidth: 18, height: 18, background: "#ef4444", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", padding: "0 4px" }}>
                        {(unreadCount + (hasPendingPayment ? 1 : 0)) > 9 ? "9+" : (unreadCount + (hasPendingPayment ? 1 : 0))}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setShowSignOutConfirm(true); setShowProfileMenu(false); }}
                    className="flex items-center gap-2.5 w-full"
                    style={{ padding: "10px 14px", background: "none", border: "none", color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <span style={{ display: "flex", color: "#ef4444" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setLocation("/sign-in")}
              className="px-4 rounded-full font-extrabold"
              style={{ background: "#7F00FF", color: "#FFFFFF", boxShadow: "0 2px 10px rgba(127,0,255,0.4)", fontSize: 12, height: 32, letterSpacing: "0.01em" }}
            >
              Sign In
            </button>
          )
        )}
      </div>
    </nav>
    {showSignOutConfirm && (
      <ConfirmDialog
        message="You are about to sign out from your current Sky Official account. Continue?"
        onConfirm={() => { signOut(() => setLocation("/")); setShowSignOutConfirm(false); }}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    )}
  </>
  );
}

// ── Page Transition System ─────────────────────────────────────────────────
type TransDir = "forward" | "backward";
interface TransCtxValue { dir: TransDir; exiting: boolean; hasNavigated: boolean; navigateTo: (to: string, dir: TransDir) => void; }
const TransCtx = createContext<TransCtxValue>({ dir: "forward", exiting: false, hasNavigated: false, navigateTo: () => {} });

function TransitionProvider({ children }: { children: React.ReactNode }) {
  const [dir, setDir] = useState<TransDir>("forward");
  const [exiting, setExiting] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [, setLocation] = useLocation();
  const navigateTo = useCallback((to: string, d: TransDir) => {
    setDir(d); setExiting(true); setHasNavigated(true);
    setTimeout(() => { setExiting(false); setLocation(to); }, 280);
  }, [setLocation]);
  return <TransCtx.Provider value={{ dir, exiting, hasNavigated, navigateTo }}>{children}</TransCtx.Provider>;
}
function usePageNav() { return useContext(TransCtx); }

function AnimatedPage({ children, skipPageAnim = false }: { children: React.ReactNode; skipPageAnim?: boolean }) {
  const { dir, exiting, hasNavigated, navigateTo } = usePageNav();
  const [location] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep current values in refs so touch handlers never go stale
  const exitingRef   = useRef(exiting);
  const locationRef  = useRef(location);
  const navigateRef  = useRef(navigateTo);
  useEffect(() => { exitingRef.current  = exiting;   }, [exiting]);
  useEffect(() => { locationRef.current = location;  }, [location]);
  useEffect(() => { navigateRef.current = navigateTo;}, [navigateTo]);


  // Before first button-nav: still render the wrapper so sections sit above
  // the fixed video (position:relative z-index:1 creates the needed stacking context)
  if (!hasNavigated || skipPageAnim) {
    return (
      <div ref={containerRef} style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    );
  }

  const anim = exiting ? "pgFadeOut 0.24s ease both" : "pgFadeIn 0.32s ease both";
  return (
    <div ref={containerRef} style={{ animation: anim, willChange: "opacity", position: "relative", zIndex: 1 }}>
      <style>{`
        @keyframes pgFadeIn  { from { opacity: 0.75; } to { opacity: 1; } }
        @keyframes pgFadeOut { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
      {children}
    </div>
  );
}

// ── Password Setup Page (shown after Google/OAuth sign-up before username) ───
function PasswordSetupPage({ onDone }: { onDone: () => void }) {
  const { user } = useUser();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = newPassword.length >= 8 && newPassword === confirmPassword;

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await user!.updatePassword({ newPassword, signOutOfOtherSessions: false });
      onDone();
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Failed to set password. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#FAF9F6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#3D2B1F", letterSpacing: "-0.01em" }}>Sky Official</div>
        <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 12, marginTop: 2, letterSpacing: "0.08em" }}>MLBB DIAMOND TOP-UP</div>
      </div>
      <div style={{ width: "100%", maxWidth: 360, background: "#FFFFFF", borderRadius: 20, padding: "28px 24px 32px", boxShadow: "0 8px 40px rgba(61,43,31,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(127,0,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#7F00FF" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#7F00FF" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#3D2B1F", marginBottom: 8 }}>Set your password</div>
          <div style={{ fontSize: 13, color: "rgba(61,43,31,0.5)", lineHeight: 1.55 }}>
            Create a password so you can sign in with email anytime, even without Google.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          <input
            type="password"
            value={newPassword}
            onChange={e => { setNewPassword(e.target.value); setError(null); }}
            placeholder="Password (min. 8 characters)"
            autoComplete="new-password"
            style={{ padding: "13px 14px", borderRadius: 12, border: `1.5px solid rgba(61,43,31,0.15)`, background: "#FAF9F6", color: "#3D2B1F", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
            placeholder="Confirm password"
            autoComplete="new-password"
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
            style={{ padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${confirmPassword && newPassword !== confirmPassword ? "#ef4444" : "rgba(61,43,31,0.15)"}`, background: "#FAF9F6", color: "#3D2B1F", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          <div style={{ minHeight: 18 }}>
            {error && <div style={{ fontSize: 11.5, color: "#ef4444" }}>{error}</div>}
            {!error && confirmPassword && newPassword !== confirmPassword && <div style={{ fontSize: 11.5, color: "#ef4444" }}>Passwords don't match.</div>}
            {!error && newPassword.length > 0 && newPassword.length < 8 && <div style={{ fontSize: 11.5, color: "rgba(61,43,31,0.4)" }}>At least 8 characters needed.</div>}
            {!error && ready && <div style={{ fontSize: 11.5, color: "#22c55e", fontWeight: 600 }}>Looks good!</div>}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={!ready || submitting}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: ready && !submitting ? "#7F00FF" : "rgba(127,0,255,0.15)", border: "none", color: ready && !submitting ? "#FFFFFF" : "rgba(127,0,255,0.4)", fontSize: 15, fontWeight: 700, cursor: ready && !submitting ? "pointer" : "not-allowed", transition: "all 0.2s" }}
        >
          {submitting ? "Setting up…" : "Set Password →"}
        </button>
        <div style={{ marginTop: 14, fontSize: 11, color: "rgba(61,43,31,0.3)", textAlign: "center" }}>
          Stored securely · used to sign in with email
        </div>
      </div>
    </div>
  );
}

function UsernameSetupPage({ onDone }: { onDone: () => void }) {
  const { getToken } = useAuth();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(v);
    setError(null);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (v.length === 0) { setStatus("idle"); return; }
    if (v.length < 3) { setStatus("invalid"); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(v)) { setStatus("invalid"); return; }
    setStatus("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/profile/username-check?username=${encodeURIComponent(v)}`);
        const data = await res.json();
        setStatus(data.available ? "available" : "taken");
      } catch { setStatus("idle"); }
    }, 500);
  };

  const submit = async () => {
    if (status !== "available" || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/profile/username`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok && data.ok) { onDone(); }
      else { setError(data.error || "Failed to set username."); setSubmitting(false); }
    } catch { setError("Network error. Try again."); setSubmitting(false); }
  };

  const borderColor = status === "available" ? "#22c55e" : (status === "taken" || status === "invalid") ? "#ef4444" : "rgba(61,43,31,0.15)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#FAF9F6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#3D2B1F", letterSpacing: "-0.01em" }}>Sky Official</div>
        <div style={{ color: "rgba(61,43,31,0.4)", fontSize: 12, marginTop: 2, letterSpacing: "0.08em" }}>MLBB DIAMOND TOP-UP</div>
      </div>

      <div style={{ width: "100%", maxWidth: 360, background: "#FFFFFF", borderRadius: 20, padding: "28px 24px 32px", boxShadow: "0 8px 40px rgba(61,43,31,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(127,0,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#7F00FF" strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#7F00FF" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#3D2B1F", marginBottom: 8 }}>Choose your username</div>
          <div style={{ fontSize: 13, color: "rgba(61,43,31,0.5)", lineHeight: 1.55 }}>
            This is your unique identity on Sky Official — used on the leaderboard and by admins to top up your wallet.
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ position: "relative" }}>
            <input
              value={username}
              onChange={handleChange}
              maxLength={20}
              placeholder="your_username"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              style={{ width: "100%", padding: "13px 40px 13px 14px", borderRadius: 12, border: `1.5px solid ${borderColor}`, background: "#FAF9F6", color: "#3D2B1F", fontSize: 15, fontWeight: 600, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
            />
            <div style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15 }}>
              {status === "checking" && <span style={{ color: "rgba(61,43,31,0.3)", fontSize: 13 }}>…</span>}
              {status === "available" && <span style={{ color: "#22c55e" }}>✓</span>}
              {(status === "taken" || status === "invalid") && <span style={{ color: "#ef4444" }}>✕</span>}
            </div>
          </div>

          <div style={{ marginTop: 7, minHeight: 18 }}>
            {status === "invalid" && username.length > 0 && username.length < 3 && (
              <div style={{ fontSize: 11.5, color: "rgba(61,43,31,0.4)" }}>At least 3 characters needed.</div>
            )}
            {status === "invalid" && username.length >= 3 && (
              <div style={{ fontSize: 11.5, color: "#ef4444" }}>Only letters (a–z), numbers, underscores. Max 20 chars.</div>
            )}
            {status === "available" && (
              <div style={{ fontSize: 11.5, color: "#22c55e", fontWeight: 600 }}>@{username} is available!</div>
            )}
            {status === "taken" && (
              <div style={{ fontSize: 11.5, color: "#ef4444" }}>Username already taken.</div>
            )}
          </div>


          {error && <div style={{ marginTop: 8, fontSize: 11.5, color: "#ef4444" }}>{error}</div>}
        </div>

        <button
          onClick={submit}
          disabled={status !== "available" || submitting}
          style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: status === "available" && !submitting ? "#7F00FF" : "rgba(127,0,255,0.15)", border: "none", color: status === "available" && !submitting ? "#FFFFFF" : "rgba(127,0,255,0.4)", fontSize: 15, fontWeight: 700, cursor: status === "available" && !submitting ? "pointer" : "not-allowed", transition: "all 0.2s" }}
        >
          {submitting ? "Setting up…" : "Continue →"}
        </button>

        <div style={{ marginTop: 14, fontSize: 11, color: "rgba(61,43,31,0.3)", textAlign: "center" }}>
          Letters, numbers &amp; underscores only · 3–20 characters
        </div>
      </div>
    </div>
  );
}

// ── Username Gate (shown after sign-in if no username set) ──────────────────
function UsernameGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [location] = useLocation();
  const [usernameStatus, setUsernameStatus] = useState<"loading" | "set" | "unset">("loading");
  const [passwordDone, setPasswordDone] = useState(false);

  const isExcluded = location.startsWith("/admin") || location.startsWith("/staff") || location.startsWith("/sign-");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setUsernameStatus("set"); return; }
    getToken().then(token => {
      if (!token) { setUsernameStatus("set"); return; }
      fetch(`${API}/profile/username`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
        .then(r => r.json())
        .then(data => setUsernameStatus(data.username ? "set" : "unset"))
        .catch(() => setUsernameStatus("set"));
    });
  }, [isLoaded, isSignedIn]);

  if (usernameStatus === "unset" && !isExcluded) {
    // OAuth users (Google etc.) have no password — show password setup first
    const isOAuthUser = user && !user.passwordEnabled;
    if (isOAuthUser && !passwordDone) {
      return <PasswordSetupPage onDone={() => setPasswordDone(true)} />;
    }
    return <UsernameSetupPage onDone={() => setUsernameStatus("set")} />;
  }
  return <>{children}</>;
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: React.ReactNode; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 18, padding: "24px 22px 20px", maxWidth: 320, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", animation: "pgFadeIn 0.18s ease both" }}>
        <div style={{ color: "rgba(61,43,31,0.7)", fontSize: 14, lineHeight: 1.65, marginBottom: 22, textAlign: "center" }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "1px solid rgba(197,180,162,0.6)", background: "none", color: "#3D2B1F", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>No</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "11px 0", borderRadius: 11, background: "#ef4444", border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Yes</button>
        </div>
      </div>
    </div>
  );
}

// ── Ambient Background ────────────────────────────────────────────────────────
function AnimatedBackground() {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100dvh",
      zIndex: 0, overflow: "hidden", pointerEvents: "none",
      background: "#FAF9F6",
    }} />
  );
}


// ── Promo Banner Slider ─────────────────────────────────────────────────────
interface PromoBannerItem { id: string; image: string; link?: string; active?: boolean; }

function isVidSrc(src: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src) || src.startsWith("data:video/");
}

let _savedBannerIdx = 0;

function PromoBannerSlider() {
  const bannerCacheKey = `${API}/settings/promo_banners`;
  const [banners, setBanners] = useState<PromoBannerItem[]>(() => getCached<PromoBannerItem[]>(bannerCacheKey) ?? []);
  const [activeIdx, setActiveIdx] = useState(_savedBannerIdx);
  const touchStartX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Stable ref so callbacks always read latest state without stale closures
  const liveRef = useRef({ banners: [] as PromoBannerItem[], activeIdx: 0 });
  const [, setLocation] = useLocation();

  useEffect(() => { liveRef.current = { banners, activeIdx }; }, [banners, activeIdx]);
  useEffect(() => { _savedBannerIdx = activeIdx; }, [activeIdx]);

  const fetchBanners = useCallback((force = false) => {
    if (force) invalidateCache(bannerCacheKey);
    cachedFetch<PromoBannerItem[]>(bannerCacheKey)
      .then(d => setBanners(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [bannerCacheKey]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    fetchBanners();
    const onAdminUpdate = () => fetchBanners(true);
    // Reset to slide 0 when the loading screen dismisses so the first banner
    // always plays from the start — the component renders under the loading
    // screen and the video would otherwise advance unseen.
    const onReady = () => {
      stopTimer();
      const { banners: bs } = liveRef.current;
      const cur = bs[0];
      if (cur && isVidSrc(cur.image)) {
        const v = videoRefs.current.get(cur.id);
        if (v) { v.currentTime = 0; v.play().catch(() => {}); }
      }
      setActiveIdx(0);
    };
    window.addEventListener("skyAdminUpdate", onAdminUpdate);
    window.addEventListener("skyContentReady", onReady);
    return () => {
      window.removeEventListener("skyAdminUpdate", onAdminUpdate);
      window.removeEventListener("skyContentReady", onReady);
    };
  }, [fetchBanners, stopTimer]);

  // Restart suspended video when user returns to the tab / unlocks screen.
  // NOTE: on Android Chrome, muted videos are NOT paused when the screen locks,
  // so v.paused is false even though the GPU froze the frame (shows black).
  // We must force a repaint + play unconditionally, not guarded by v.paused.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      fetchBanners();
      const { banners: bs, activeIdx: idx } = liveRef.current;
      const cur = bs[idx];
      if (cur && isVidSrc(cur.image)) {
        const v = videoRefs.current.get(cur.id);
        if (v) {
          // Force the browser to decode and repaint the current frame,
          // then resume playback — fixes the black-frame-after-screen-lock bug.
          v.currentTime = v.currentTime;
          v.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchBanners]);

  // Called both by onEnded (video) and setTimeout (image)
  const doAdvance = useCallback(() => {
    const { banners: bs, activeIdx: idx } = liveRef.current;
    if (bs.length < 2) return;
    // Pause & rewind the outgoing video so it's ready for its next appearance
    const cur = bs[idx];
    if (cur && isVidSrc(cur.image)) {
      const v = videoRefs.current.get(cur.id);
      if (v) { v.pause(); v.currentTime = 0; }
    }
    setActiveIdx((idx + 1) % bs.length);
  }, []);

  // Drive the slideshow whenever the active slide changes
  useEffect(() => {
    if (banners.length === 0) return;
    stopTimer();
    const banner = banners[activeIdx];
    if (!banner) return;

    if (isVidSrc(banner.image)) {
      if (banners.length === 1) return; // single video — loop attribute handles it
      // Reset & play the video; onEnded will call doAdvance
      const v = videoRefs.current.get(banner.id);
      if (v) { v.currentTime = 0; v.play().catch(() => {}); }
    } else {
      // Image slide — advance after 6 s
      if (banners.length > 1) {
        timerRef.current = setTimeout(doAdvance, 6000);
      }
    }
    return stopTimer;
  }, [activeIdx, banners, doAdvance, stopTimer]);

  if (banners.length === 0) return (
    <div style={{ background: "transparent", padding: "6px 14px 12px" }}>
      <div style={{ width: "100%", aspectRatio: "21/9", borderRadius: 18, background: "linear-gradient(135deg,#1a1200 0%,#2a1f00 50%,#1a1200 100%)" }} />
    </div>
  );
  const banner = banners[activeIdx];

  function go(newIdx: number) {
    stopTimer();
    const { banners: bs, activeIdx: idx } = liveRef.current;
    const cur = bs[idx];
    if (cur && isVidSrc(cur.image)) {
      const v = videoRefs.current.get(cur.id);
      if (v) { v.pause(); v.currentTime = 0; }
    }
    setActiveIdx(newIdx);
  }

  return (
    <div style={{ background: "transparent", padding: "6px 14px 12px" }}>
      <div
        style={{ position: "relative", width: "100%", aspectRatio: "21/9", overflow: "hidden", cursor: banner.link ? "pointer" : "default", borderRadius: 18, boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - touchStartX.current; if (Math.abs(dx) > 40) go((activeIdx + (dx < 0 ? 1 : -1) + banners.length) % banners.length); }}
        onClick={() => {
          if (!banner.link) return;
          if (banner.link.startsWith("cart:")) {
            const ids = banner.link.replace("cart:", "").split(",").map(Number).filter(Boolean);
            sessionStorage.setItem("pendingCartPackIds", JSON.stringify(ids));
            setLocation("/cart");
          } else if (banner.link.startsWith("/")) {
            setLocation(banner.link);
          } else {
            window.open(banner.link, "_blank", "noopener,noreferrer");
          }
        }}
      >
        {banners.map((b, i) => {
          const vid = isVidSrc(b.image);
          const singleVid = vid && banners.length === 1;
          const isActive = i === activeIdx;
          return vid ? (
            <video
              key={b.id}
              ref={el => { if (el) videoRefs.current.set(b.id, el); else videoRefs.current.delete(b.id); }}
              src={b.image}
              muted
              playsInline
              preload="auto"
              loop={singleVid}
              autoPlay={isActive}
              onCanPlay={isActive ? (e) => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); } : undefined}
              onEnded={singleVid ? undefined : doAdvance}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: isActive ? 1 : 0, transition: "opacity 0.4s ease", pointerEvents: "none" }}
            />
          ) : (
            <img
              key={b.id}
              src={b.image}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: i === activeIdx ? 1 : 0, transition: "opacity 0.4s ease", pointerEvents: "none" }}
            />
          );
        })}
        {banners.length > 1 && (
          <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 5 }}>
            {banners.map((_, i) => (
              <div key={i} onClick={e => { e.stopPropagation(); go(i); }} style={{ width: i === activeIdx ? 20 : 6, height: 6, borderRadius: 999, background: i === activeIdx ? "#f59e0b" : "rgba(255,255,255,0.4)", transition: "all 0.3s ease", cursor: "pointer" }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Game Select Section ─────────────────────────────────────────────────────
interface GameItem { id: number; name: string; image: string | null; region?: string | null; status?: string | null; }

const GAME_SKELETON_COUNT = 6;

function GameSelectSection() {
  const gamesCacheKey = `${API}/games`;
  const availCacheKey = `${API}/settings/category_availability`;
  const [games, setGames] = useState<GameItem[]>(() => getCached<GameItem[]>(gamesCacheKey) ?? []);
  const [gamesLoading, setGamesLoading] = useState(() => !getCached(gamesCacheKey));
  const [catAvailability, setCatAvailability] = useState<Record<string, string>>(() => getCached<Record<string, string>>(availCacheKey) ?? {});
  const { navigateTo } = usePageNav();
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  const fetchGames = useCallback((force = false) => {
    if (force) invalidateCache(gamesCacheKey, availCacheKey);
    Promise.all([
      cachedFetch<GameItem[]>(gamesCacheKey),
      cachedFetch<Record<string, string>>(availCacheKey),
    ])
      .then(([d, avail]) => {
        if (!mountedRef.current) return;
        setGames(Array.isArray(d) ? d : []);
        setCatAvailability(avail && typeof avail === "object" ? avail : {});
        setGamesLoading(false);
        window.dispatchEvent(new Event("skyContentReady"));
      })
      .catch(() => {
        if (!mountedRef.current) return;
        // Don't signal ready — retry after 3 s until it succeeds
        retryRef.current = setTimeout(() => fetchGames(), 3000);
      });
  }, [gamesCacheKey, availCacheKey]);

  useEffect(() => {
    fetchGames();
    const onUpdate = () => { invalidateCache(); warmCache(); fetchGames(true); };
    const onRetry = () => fetchGames();
    window.addEventListener("skyAdminUpdate", onUpdate);
    window.addEventListener("skyRetryFetch", onRetry);
    return () => {
      window.removeEventListener("skyAdminUpdate", onUpdate);
      window.removeEventListener("skyRetryFetch", onRetry);
    };
  }, [fetchGames]);

  if (gamesLoading) {
    return (
      <section style={{ background: "transparent", padding: "28px 16px 28px" }}>
        <style>{`@keyframes gameSkel{0%,100%{opacity:0.35}50%{opacity:0.75}}`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(245,158,11,0.25)", animation: "gameSkel 1.5s ease-in-out infinite" }} />
          <div style={{ width: 90, height: 12, borderRadius: 4, background: "rgba(255,255,255,0.07)", animation: "gameSkel 1.5s ease-in-out 0.1s infinite" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {Array.from({ length: GAME_SKELETON_COUNT }).map((_, i) => (
            <div key={i} style={{ borderRadius: 16, background: "rgba(197,180,162,0.15)", overflow: "hidden", animation: `gameSkel 1.6s ease-in-out ${i * 0.08}s infinite` }}>
              <div style={{ width: "100%", aspectRatio: "1/1", background: "rgba(197,180,162,0.12)" }} />
              <div style={{ padding: "6px 8px 10px", display: "flex", justifyContent: "center" }}>
                <div style={{ width: "65%", height: 10, borderRadius: 4, background: "rgba(197,180,162,0.2)" }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (games.length === 0) {
    return (
      <section style={{ background: "transparent", padding: "28px 16px", minHeight: "38vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 10 }}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.18 }}>
          <rect x="3" y="6" width="18" height="13" rx="3" stroke="#f59e0b" strokeWidth="1.4"/>
          <path d="M7 12h4m-2-2v4M15 12h2" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span style={{ color: "rgba(61,43,31,0.35)", fontSize: 13, fontWeight: 600 }}>No games available yet</span>
      </section>
    );
  }

  const PANEL_GLOW = { glow: "rgba(139,92,246,0.12)", border: "rgba(168,85,247,0.18)", icon: "rgba(168,85,247,0.5)" };

  return (
    <section style={{ background: "#FAF9F6", padding: "20px 16px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#7F00FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 6H3a1 1 0 00-1 1v10a1 1 0 001 1h18a1 1 0 001-1V7a1 1 0 00-1-1zM7 12H5m2 0H5m2 0v-2m0 2v2M17 10l1 1 2-2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span style={{ color: "#3D2B1F", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>Select Game</span>
      </div>
      <style>{`@keyframes nameMarquee{0%,25%{transform:translateX(0)}80%,100%{transform:translateX(-50%)}}`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {games.map((game, idx) => {
          const c = PANEL_GLOW;
          const isRankBoost = game.name.toLowerCase().includes("rank") || game.name.toLowerCase().includes("boost");
          const needsMarquee = game.name.length > 16;
          const isUnavailable = catAvailability[String(game.id)] === "out_of_stock";
          return (
            <button
              key={game.id}
              disabled={isUnavailable}
              onClick={() => {
                if (isUnavailable) return;
                if (isRankBoost) {
                  navigateTo("/rank-boost", "forward");
                } else {
                  navigateTo(`/game/${game.id}`, "forward");
                }
              }}
              style={{
                background: "#FFFFFF",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: isUnavailable ? "1px solid rgba(220,38,38,0.25)" : "1px solid rgba(197,180,162,0.4)",
                borderRadius: 16,
                cursor: isUnavailable ? "default" : "pointer",
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 3px 12px rgba(61,43,31,0.07)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
              }}
              onTouchStart={e => { if (!isUnavailable) e.currentTarget.style.transform = "scale(0.96)"; }}
              onTouchEnd={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ width: "100%", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                {game.image ? (
                  <img src={game.image} alt={game.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="3" stroke={c.icon} strokeWidth="1.5"/><path d="M7 12h4m-2-2v4M15 12h2" stroke={c.icon} strokeWidth="1.5" strokeLinecap="round"/></svg>
                )}
                {isUnavailable && (
                  <>
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(220,38,38,0.92)", borderRadius: 6, padding: "2px 6px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(220,38,38,0.35)" }}>
                      <span style={{ color: "#FFFFFF", fontSize: 7.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Unavailable</span>
                    </div>
                  </>
                )}
              </div>
              <div style={{ padding: "4px 8px 6px", height: 50, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                {/* Name — fixed-height row so all panels align uniformly */}
                <div style={{ height: 18, overflow: "hidden", width: "100%", display: "flex", alignItems: "center", justifyContent: needsMarquee ? "flex-start" : "center" }}>
                  {needsMarquee ? (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#3D2B1F", display: "inline-flex", alignItems: "center", flexShrink: 0, whiteSpace: "nowrap", animation: `nameMarquee ${Math.max(20, game.name.length * 0.9)}s ease-in-out infinite` }}>
                      <span style={{ paddingRight: "2.5em" }}>{game.name}</span>
                      <span style={{ paddingRight: "2.5em" }}>{game.name}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#3D2B1F", display: "block", width: "100%", lineHeight: "18px", whiteSpace: "nowrap", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>{game.name}</span>
                  )}
                </div>
                {/* Region — always rendered so non-region panels keep same height */}
                <div style={{ height: 12, marginTop: 4, overflow: "hidden" }}>
                  <span style={{ fontSize: 8.5, color: "rgba(168,85,247,0.75)", fontWeight: 600, display: "block", lineHeight: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{game.region || ""}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────

function HeroSection({ animate = false }: { animate?: boolean }) {
  const { navigateTo, exiting } = usePageNav();
  const featureTexts = ["Instant delivery", "Affordable prices", "P2P chat support", "Safe and secure transaction"];
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActiveFeature((i) => (i + 1) % featureTexts.length), 2200);
    return () => clearInterval(interval);
  }, []);

  const el = (enterDelay: number, exitDelay: number): React.CSSProperties => {
    if (exiting) return { animation: `fadeOutDiag 0.21s ease ${exitDelay}s both` };
    if (animate) return { animation: `fadeInDiag 0.56s cubic-bezier(0.25,0.46,0.45,0.94) ${enterDelay}s both` };
    return { opacity: 0 };
  };

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-16" style={{ background: "transparent" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 55% 38% at 50% 50%, rgba(251,191,36,0.03) 0%, transparent 70%)", zIndex: 2 }} />
      <div className="relative z-10 flex flex-col gap-2.5 px-5 pt-5 pb-9 max-w-lg mx-auto w-full">
        <div className="flex justify-center" style={el(0, 0)}>
          <span className="px-3 py-0.5 rounded-full font-bold uppercase" style={{ border: "1.5px solid rgba(168,148,130,0.55)", color: "#A89482", background: "rgba(168,148,130,0.07)", letterSpacing: "0.14em", fontSize: 8 }}>Game Top Up Store</span>
        </div>
        <div className="text-center">
          <h1 className="font-extrabold leading-tight" style={{ fontSize: "clamp(1.15rem,5.5vw,1.65rem)" }}>
            <span className="block" style={{ color: "#3D2B1F", ...el(0.13, 0.04) }}>Recharge Fast.</span>
            <span className="block" style={{ color: "#A89482", ...el(0.26, 0.08) }}>Dominate the</span>
            <span className="block" style={{ color: "#A89482", ...el(0.39, 0.11) }}>Game.</span>
          </h1>
        </div>
        <p className="text-center leading-relaxed px-2" style={{ maxWidth: 260, margin: "0 auto", fontSize: 11, color: "rgba(61,43,31,0.55)", ...el(0.52, 0.14) }}>
          Instant delivery, secure payments, and the best prices for Mobile Legends Bang Bang. Shop smart, play hard.
        </p>
        <div className="relative h-4 flex items-center justify-center overflow-hidden" style={el(0.65, 0.17)}>
          {featureTexts.map((text, i) => (
            <span key={i} className="absolute font-semibold text-center" style={{ fontSize: 9.5, color: "#A89482", opacity: activeFeature === i ? 1 : 0, transform: activeFeature === i ? "translateY(0)" : "translateY(6px)", transition: "opacity 0.41s ease, transform 0.41s ease", pointerEvents: "none", letterSpacing: "0.05em" }}>✦ {text}</span>
          ))}
        </div>
        <div className="flex justify-center mt-1" style={el(0.78, 0.20)}>
          <button onClick={() => navigateTo("/packages", "forward")} className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full font-bold" style={{ background: "#A89482", color: "#FAF9F6", boxShadow: "0 4px 16px rgba(168,148,130,0.4)", fontSize: 12, border: "none", cursor: "pointer" }}>
            View Packages <span style={{ fontSize: 13 }}>→</span>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeInDiag {
          from { opacity: 0; transform: translate(-24px, -24px); }
          to   { opacity: 1; transform: translate(0, 0); }
        }
        @keyframes fadeOutDiag {
          from { opacity: 1; transform: translate(0, 0); }
          to   { opacity: 0; transform: translate(-24px, -24px); }
        }
      `}</style>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#6366f1" /></svg>, bg: "#ede9fe", title: "Instant Delivery", sub: "Within minutes" },
    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>, bg: "#dcfce7", title: "100% Secure", sub: "Safe payments" },
    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#f59e0b" strokeWidth="2" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" /></svg>, bg: "#fef9c3", title: "Verified Seller", sub: "Trusted by gamers" },
    { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1" fill="#a855f7" /><rect x="13" y="3" width="8" height="8" rx="1" fill="#a855f7" /><rect x="3" y="13" width="8" height="8" rx="1" fill="#a855f7" /><rect x="13" y="13" width="8" height="8" rx="1" fill="#a855f7" /></svg>, bg: "#f3e8ff", title: "5 Categories", sub: "All pack types" },
  ];
  return (
    <section className="py-8 px-4" style={{ background: "#FAF9F6" }} id="packages">
      <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
        {features.map((f, i) => (
          <div key={i} className="rounded-xl p-3 flex flex-row items-start gap-2.5" style={{ background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
            <div className="rounded-lg p-2 flex-shrink-0" style={{ background: f.bg }}>{f.icon}</div>
            <div><div className="font-bold text-gray-900 leading-tight" style={{ fontSize: 14 }}>{f.title}</div><div className="text-gray-400 mt-0.5" style={{ fontSize: 12 }}>{f.sub}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Stats ──────────────────────────────────────────────────────────────────
function StatsSection() {
  type StatsData = { total_orders: number; total_diamonds: number; total_users: number };
  const statsCacheKey = `${API}/stats`;
  const [real, setReal] = useState<StatsData | null>(() => getCached<StatsData>(statsCacheKey) ?? null);

  useEffect(() => {
    cachedFetch<StatsData>(statsCacheKey)
      .then(d => { if (d) setReal(d); })
      .catch(() => {});
  }, []);

  const stats = [
    { value: real ? real.total_orders.toLocaleString() : "—", label: "Total Orders", color: "#3D2B1F", icon: null },
    { value: real ? Number(real.total_diamonds).toLocaleString() : "—", label: "Products Sold", color: "#A89482", icon: "box" },
    { value: real ? real.total_users.toLocaleString() : "—", label: "Happy Gamers", color: "#3D2B1F", icon: "★" },
  ];
  return (
    <section className="py-5 px-4" style={{ background: "#FAF9F6" }}>
      <div className="flex flex-col gap-2.5 max-w-lg mx-auto">
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl p-4 text-center" style={{ background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
            <div className="font-extrabold" style={{ fontSize: 32, color: s.color }}>{s.value}</div>
            <div className="text-gray-400 mt-0.5" style={{ fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>{s.icon === "box" ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> : s.icon ? <span style={{ color: s.color }}>{s.icon}</span> : null}{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── How It Works ───────────────────────────────────────────────────────────
function HowItWorks() {
  const { navigateTo } = usePageNav();
  const steps = [
    { num: "1", title: "Pick a Pack", desc: "Browse 5 categories and select your diamond pack." },
    { num: "2", title: "Verify & Pay", desc: "Enter your MLBB ID, verify your account, then scan our UPI QR to pay." },
    { num: "3", title: "Get Diamonds", desc: "Diamonds are credited instantly to your account." },
  ];
  return (
    <section className="py-10 px-5" style={{ background: "#FAF9F6" }}>
      <div className="max-w-lg mx-auto text-center">
        <div className="inline-block px-3.5 py-1 rounded-full font-bold uppercase tracking-widest mb-3" style={{ fontSize: 10, background: "rgba(168,148,130,0.1)", color: "#A89482", border: "1px solid rgba(197,180,162,0.5)" }}>Simple Process</div>
        <h2 className="font-extrabold text-2xl mb-1" style={{ color: "#3D2B1F" }}>How It Works</h2>
        <p className="mb-6" style={{ fontSize: 14, color: "rgba(61,43,31,0.55)" }}>Three simple steps to recharge your account</p>
        <div className="flex flex-col items-center gap-0">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col items-center w-full">
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-xl" style={{ background: "#FFFFFF", color: "#A89482", border: "1px solid rgba(197,180,162,0.5)", boxShadow: "0 2px 10px rgba(61,43,31,0.07)" }}>{s.num}</div>
                <div className="text-center"><div className="font-bold text-base" style={{ color: "#3D2B1F" }}>{s.title}</div><div className="mt-0.5 max-w-xs" style={{ fontSize: 14, color: "rgba(61,43,31,0.55)" }}>{s.desc}</div></div>
              </div>
              {i < steps.length - 1 && <div className="w-0.5 h-7 my-2" style={{ background: "rgba(197,180,162,0.4)" }} />}
            </div>
          ))}
        </div>
        <button onClick={() => navigateTo("/packages", "forward")} className="inline-flex items-center gap-1.5 px-7 py-3 rounded-full font-bold mt-7" style={{ fontSize: 15, background: "#A89482", color: "#FAF9F6", boxShadow: "0 4px 16px rgba(168,148,130,0.4)", border: "none", cursor: "pointer" }}>
          Start Now <span>→</span>
        </button>
      </div>
    </section>
  );
}

// ── Live Ticker ────────────────────────────────────────────────────────────
const _ANON_NAMES = ["Alex","Raj","Priya","Sam","Amrit","Kiran","Ravi","Ankit","Divya","Rohan","Mia","Arjun","Neha","Kabir","Zara"];
function maskName(name: string, createdAt?: string): string {
  if (!name || name.length === 0) {
    const seed = createdAt ? new Date(createdAt).getTime() % _ANON_NAMES.length : 0;
    const fallback = _ANON_NAMES[Math.abs(seed)];
    return fallback[0] + "***";
  }
  return name[0].toUpperCase() + "***";
}

interface RecentOrder { mlbb_ign: string | null; diamonds: number; created_at: string; pack_name: string | null; currency_label: string | null; user_display_name: string | null; }

function LiveTicker() {
  const [purchases, setPurchases] = useState<RecentOrder[]>([]);

  useEffect(() => {
    fetch(`${API}/orders/recent`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setPurchases(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  if (purchases.length === 0) return null;

  const doubled = [...purchases, ...purchases];
  const duration = Math.max(16, doubled.length * 2.5);

  return (
    <div className="py-2.5 overflow-hidden" style={{ background: "#fff", borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
      <div className="flex items-center gap-0">
        <div className="flex-shrink-0 px-3 py-1 flex items-center gap-1 font-bold" style={{ color: "#f59e0b", fontSize: 13 }}>⚡ Live Purchases</div>
        <div className="flex overflow-hidden">
          <div className="flex gap-6 whitespace-nowrap" style={{ animation: `scrollTicker ${duration}s linear infinite`, willChange: "transform" }}>
            {doubled.map((p, i) => {
              const label = p.currency_label || "Diamonds";
              const displayName = p.pack_name || `${Number(p.diamonds).toLocaleString()} ${label}`;
              return (
                <span key={i} className="text-gray-700 flex-shrink-0 inline-flex items-baseline" style={{ fontSize: 13 }}>
                  {(() => {
                    const rawName = p.user_display_name || (p.mlbb_ign ?? "");
                    const masked = rawName ? rawName[0].toUpperCase() + "***" : maskName("", p.created_at);
                    const shouldSlide = masked.length > 6;
                    return (
                      <span style={{ display: "inline-block", width: 56, overflow: "hidden", flexShrink: 0, verticalAlign: "baseline" }}>
                        <span className="font-bold text-amber-600" style={shouldSlide ? { display: "inline-block", whiteSpace: "nowrap", animation: "slideTickerName 3.5s ease-in-out infinite alternate" } : { display: "inline-block", whiteSpace: "nowrap" }}>{masked}</span>
                      </span>
                    );
                  })()}
                  {" bought "}<span className="font-bold">{displayName}</span>
                  <span className="ml-5 text-gray-300">|</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WhatsApp Section ───────────────────────────────────────────────────────
function WhatsAppSection() {
  const [whatsappLink, setWhatsappLink] = useState("");
  const [instagramLink, setInstagramLink] = useState("");

  useEffect(() => {
    fetch(`${API}/settings/community_links`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          if (d.whatsapp) setWhatsappLink(d.whatsapp);
          if (d.instagram) setInstagramLink(d.instagram);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="py-11 px-5 text-center" style={{ background: "#1a5c38" }}>
      <div className="max-w-sm mx-auto flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
          <svg width="27" height="27" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
        </div>
        <h2 className="text-white font-extrabold text-xl leading-tight">Join Our Growing Community</h2>
        <p className="text-green-100 leading-relaxed" style={{ fontSize: 15 }}>Get exclusive offers, faster support, and be the first to know about new packs and discounts.</p>
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white mt-1" style={{ fontSize: 15, background: "#25d366", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", textDecoration: "none" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            Join Our WhatsApp Group
          </a>
        )}
        {instagramLink && (
          <a href={instagramLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white" style={{ fontSize: 15, background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", textDecoration: "none" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            Join Our Instagram Community
          </a>
        )}
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  const [, setLocation] = useLocation();
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trustpilot, setTrustpilot] = useState<{ url: string; enabled: boolean } | null>(null);

  useEffect(() => {
    fetch(`${API}/settings/trustpilot`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setTrustpilot(d))
      .catch(() => {});
  }, []);

  const handleCopyrightTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      setLocation("/admin");
      return;
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
  };

  return (
    <footer className="py-7 px-5 text-center" style={{ background: "#000000", borderTop: "1px solid rgba(255,255,255,0.08)", position: "relative", zIndex: 1 }}>
      <div className="flex flex-col items-center gap-2.5 max-w-sm mx-auto">
        <div className="w-10 h-10 rounded-full overflow-hidden" style={{ background: "#FAF9F6", border: "1.5px solid #4ade80", boxShadow: "0 0 8px 2px rgba(74,222,128,0.35)" }}>
          <img src="/logo.webp" alt="Sky Official" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="font-bold text-sm" style={{ color: "#FFFFFF" }}>Sky Official</div>
          <p className="mt-0.5 leading-relaxed max-w-xs" style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>The most trusted top up shop for mobile game products and services.</p>
        </div>
        <div className="flex items-center gap-4 mt-1">
          {["Packages", "Contact"].map((link) => (
            <a key={link} href="#" className="hover:opacity-70 transition-opacity" style={{ textDecoration: "none", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{link}</a>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {[
            { label: "Terms & Conditions", to: "/terms" },
            { label: "Privacy Policy",     to: "/privacy" },
            { label: "Refund Policy",      to: "/refund" },
          ].map(({ label, to }) => (
            <button key={to} onClick={() => setLocation(to)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.55)", fontSize: 9.5, textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.25)" }}>
              {label}
            </button>
          ))}
        </div>
        {trustpilot?.enabled && trustpilot.url && (
          <a
            href={trustpilot.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-1"
            style={{ background: "#00b67a", borderRadius: 8, padding: "7px 14px", textDecoration: "none", fontSize: 12, fontWeight: 700, color: "#fff" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2l2.9 8.9H23l-7.4 5.4 2.8 8.7L12 19.6l-6.4 5.4 2.8-8.7L1 10.9h8.1z"/></svg>
            Review us on Trustpilot
          </a>
        )}
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Accepted Payment Methods</span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
            {["UPI", "GPay", "PhonePe", "Paytm", "BHIM"].map(method => (
              <span key={method} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "3px 8px", fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{method}</span>
            ))}
          </div>
        </div>
        <p
          className="mt-2 select-none"
          style={{ color: "rgba(255,255,255,0.3)", fontSize: 9.5, cursor: "default" }}
          onClick={handleCopyrightTap}
        >
          © 2026 Sky Official. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ── WhatsApp FAB ───────────────────────────────────────────────────────────
function WhatsAppFAB() {
  const [supportNumber, setSupportNumber] = useState("");

  useEffect(() => {
    fetch(`${API}/settings/community_links`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.support_wa) setSupportNumber(d.support_wa); })
      .catch(() => {});
  }, []);

  const waIcon = <svg width="21" height="21" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;

  if (supportNumber) {
    return (
      <a href={`https://wa.me/${supportNumber.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="fixed bottom-5 right-3.5 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg" style={{ background: "#25d366", boxShadow: "0 2px 8px rgba(37,211,102,0.22)", textDecoration: "none" }}>
        {waIcon}
      </a>
    );
  }

  return (
    <div className="fixed bottom-5 right-3.5 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg" style={{ background: "#25d366", boxShadow: "0 2px 8px rgba(37,211,102,0.22)" }}>
      {waIcon}
    </div>
  );
}

// ── Announcement Ticker Bar ────────────────────────────────────────────────
function AnnouncementBar() {
  const items = [
    "⚡ Instant delivery — credited within minutes!",
    "🔒 100% secure UPI payments — your data is safe",
    "💬 24/7 WhatsApp support — real humans, not bots",
    "🏆 Trusted by gamers across India",
    "📦 Best prices guaranteed — we beat any deal!",
    "🎮 Multiple games — top up any game, any time",
  ];
  const doubled = [...items, ...items];
  return (
    <div style={{ background: "linear-gradient(90deg,#15803d,#16a34a)", overflow: "hidden", height: 30, display: "flex", alignItems: "center", borderTop: "1px solid rgba(74,222,128,0.3)", borderBottom: "1px solid rgba(74,222,128,0.3)", boxShadow: "0 0 18px rgba(74,222,128,0.3)" }}>
      <div className="flex items-center" style={{ whiteSpace: "nowrap", animation: "scrollTicker 38s linear infinite", willChange: "transform" }}>
        {doubled.map((item, i) => (
          <span key={i} style={{ display: "inline-block", color: "#fff", fontSize: 11, fontWeight: 700, padding: "0 28px", flexShrink: 0 }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Latest News Popup (session-once, admin-configured) ───────────────────────
let newsPopupShownThisSession = false;

interface LatestEventData { enabled: boolean; image: string; targetCategory: string; }

function LatestNewsPopup() {
  const [open, setOpen] = useState(!newsPopupShownThisSession);
  const [eventData, setEventData] = useState<LatestEventData | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    newsPopupShownThisSession = true;
    fetch(`${API}/settings/latest_event`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setEventData(d); })
      .catch(() => {});
  }, []);

  if (!open || !eventData?.enabled || !eventData?.image) return null;

  const handleShopNow = () => {
    setOpen(false);
    const cat = eventData.targetCategory;
    if (cat?.startsWith("game:")) {
      setLocation(`/game/${cat.replace("game:", "")}`);
    } else {
      if (cat) sessionStorage.setItem("pendingOpenCategory", cat);
      setLocation("/packages");
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.82)", backdropFilter: "blur(7px)", padding: "0 20px" }}
      onClick={() => setOpen(false)}
    >
      <style>{`@keyframes newsPopIn{from{opacity:0;transform:scale(0.92) translateY(12px);}to{opacity:1;transform:scale(1) translateY(0);}}`}</style>
      <div
        style={{ background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.5)", borderRadius: 22, overflow: "hidden", maxWidth: 360, width: "100%", position: "relative", animation: "newsPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: "rgba(61,43,31,0.08)", border: "1px solid rgba(197,180,162,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="rgba(61,43,31,0.6)" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <div style={{ padding: "13px 16px 10px", borderBottom: "1px solid rgba(197,180,162,0.3)" }}>
          <span style={{ color: "#A89482", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em" }}>Latest Event</span>
        </div>
        <div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden", background: "#000" }}>
          <img src={eventData.image} alt="Latest Event" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 16px" }}>
          <button onClick={() => setOpen(false)} style={{ flex: 1, padding: "11px 0", background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.4)", color: "rgba(61,43,31,0.5)", fontWeight: 700, fontSize: 13, borderRadius: 12, cursor: "pointer" }}>
            Later
          </button>
          <button onClick={handleShopNow} style={{ flex: 2, padding: "11px 0", background: "#A89482", color: "#FAF9F6", fontWeight: 800, fontSize: 13, borderRadius: 12, border: "none", cursor: "pointer" }}>
            Shop Now →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Why Choose Us ──────────────────────────────────────────────────────────
function WhyChooseUs() {
  const reasons = [
    { icon: "⚡", title: "Instant Delivery",      desc: "Products credited within minutes of payment. No waiting around." },
    { icon: "🔒", title: "100% Secure",           desc: "All transactions are protected. We never store your payment details." },
    { icon: "💰", title: "Best Prices",           desc: "Guaranteed lowest prices on all products — beat any deal." },
    { icon: "🏆", title: "A professional gamer's choice", desc: "Join our growing community of satisfied gamers." },
    { icon: "💬", title: "24/7 Support",          desc: "Reach us on WhatsApp anytime. Real humans, not bots." },
    { icon: "📦", title: "All Types of Products & Services", desc: "Diamonds, UC, passes, rank boosting, and more." },
  ];
  return (
    <section className="py-10 px-5" style={{ background: "#FAF9F6" }}>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="inline-block px-3.5 py-1 rounded-full font-bold uppercase tracking-widest mb-3" style={{ fontSize: 10, background: "rgba(168,148,130,0.1)", color: "#A89482", border: "1px solid rgba(197,180,162,0.5)" }}>Why Us</div>
          <h2 className="text-gray-900 font-extrabold text-2xl">Why Choose Sky Official?</h2>
          <p className="text-gray-400 mt-1" style={{ fontSize: 14 }}>Everything you need from a game top-up store</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {reasons.map((r, i) => (
            <div key={i} className="rounded-xl p-3.5" style={{ background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
              <div className="font-bold text-gray-900 leading-tight" style={{ fontSize: 13, marginBottom: 4 }}>{r.title}</div>
              <div className="text-gray-400 leading-snug" style={{ fontSize: 11 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Promo Event Carousel ───────────────────────────────────────────────────
interface PromoEvent {
  id: string;
  title: string;
  description?: string;
  badge?: string;
  bgImage?: string;
  bgGradient?: string;
  packIds?: number[];
  active?: boolean;
  sortOrder?: number;
}

function PromoCarousel() {
  const { addToCart } = useCart();
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<PromoEvent[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [packages, setPackages] = useState<{ id: number; diamonds: number; bonus_diamonds: number; price: string; name: string | null; category: string | null }[]>([]);
  const touchStartX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    cachedFetch<typeof events>(`${API}/promo-events`)
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .catch(() => {});
    cachedFetch<typeof packages>(`${API}/packages`)
      .then(d => setPackages(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (events.length < 2) return;
    timerRef.current = setInterval(() => setActiveIdx(i => (i + 1) % events.length), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [events.length]);

  if (events.length === 0) return null;

  function handleClick(ev: PromoEvent) {
    if (!ev.packIds?.length) return;
    ev.packIds.forEach(pid => {
      const pkg = packages.find(p => p.id === pid);
      if (pkg) {
        addToCart({ id: pkg.id, diamonds: pkg.diamonds, bonus_diamonds: pkg.bonus_diamonds, price: pkg.price, name: pkg.name, category: pkg.category });
      }
    });
    setLocation("/cart");
  }

  function prev() {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveIdx(i => (i - 1 + events.length) % events.length);
    timerRef.current = setInterval(() => setActiveIdx(i => (i + 1) % events.length), 5000);
  }
  function next() {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveIdx(i => (i + 1) % events.length);
    timerRef.current = setInterval(() => setActiveIdx(i => (i + 1) % events.length), 5000);
  }

  const ev = events[activeIdx];

  return (
    <div style={{ background: "#FAF9F6" }}>
      <style>{`
        @keyframes promoBgKen { from { transform: scale(1.04); } to { transform: scale(1); } }
        @keyframes promoFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ padding: "12px 14px 4px" }}>
        <div
          key={ev.id}
          onClick={() => ev.packIds?.length && handleClick(ev)}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
          }}
          style={{
            position: "relative",
            borderRadius: 18,
            overflow: "hidden",
            minHeight: 130,
            cursor: ev.packIds?.length ? "pointer" : "default",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            background: ev.bgGradient || "linear-gradient(135deg,#1a0a2e,#2d1b4e)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          {ev.bgImage && (
            <img
              src={ev.bgImage}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "promoBgKen 6s ease both" }}
            />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.1) 100%)" }} />
          <div style={{ position: "relative", zIndex: 1, padding: "14px 16px", animation: "promoFadeUp 0.35s ease both" }}>
            {ev.badge && (
              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 999, background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.45)", color: "#fbbf24", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", marginBottom: 7, textTransform: "uppercase" }}>
                {ev.badge}
              </span>
            )}
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, lineHeight: 1.25, textShadow: "0 2px 10px rgba(0,0,0,0.6)", marginBottom: 4 }}>{ev.title}</div>
            {ev.description && (
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 1.5 }}>{ev.description}</div>
            )}
            {ev.packIds && ev.packIds.length > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, padding: "6px 13px", borderRadius: 999, background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.45)" }}>
                <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>Shop this deal →</span>
              </div>
            )}
          </div>
        </div>
        {events.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 9, marginBottom: 2 }}>
            {events.map((_, i) => (
              <button
                key={i}
                onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setActiveIdx(i); timerRef.current = setInterval(() => setActiveIdx(j => (j + 1) % events.length), 5000); }}
                style={{ width: i === activeIdx ? 20 : 6, height: 6, borderRadius: 999, background: i === activeIdx ? "#f59e0b" : "rgba(255,255,255,0.22)", transition: "all 0.25s ease", border: "none", cursor: "pointer", padding: 0 }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Site Page ─────────────────────────────────────────────────────────
// ── Daily Offer Section ───────────────────────────────────────────────────
interface DailyOfferPkg {
  id: number;
  name: string | null;
  diamonds: number;
  bonus_diamonds: number;
  price: string;
  old_price: string | null;
  image: string | null;
  game_name: string | null;
  game_id: number | null;
  has_offer?: boolean;
}

function DailyOfferCard({ pkg, onClick }: { pkg: DailyOfferPkg; onClick?: () => void }) {
  const hasOld = !!(pkg.old_price && parseFloat(pkg.old_price) > parseFloat(pkg.price));
  const isOffer = !!pkg.has_offer;
  const total = pkg.diamonds + (pkg.bonus_diamonds || 0);
  const label = pkg.name || `${total.toLocaleString()} Diamonds`;
  return (
    <div onClick={onClick} style={{
      background: "#FFFFFF",
      borderRadius: 16,
      padding: "10px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      width: "100%",
      height: "100%",
      overflow: "hidden",
      boxSizing: "border-box",
      boxShadow: "0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)",
      cursor: onClick ? "pointer" : "default",
      position: "relative",
    }}>
      {isOffer && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: "linear-gradient(135deg,#f59e0b,#ef4444)",
          color: "#fff", fontSize: 7.5, fontWeight: 900,
          padding: "3px 7px", borderRadius: "0 16px 0 10px",
          letterSpacing: "0.08em", lineHeight: 1.2,
          zIndex: 2,
        }}>OFFER</div>
      )}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: 11,
          overflow: "hidden", flexShrink: 0,
          background: pkg.image ? "transparent" : "rgba(139,92,246,0.09)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {pkg.image
            ? <img src={pkg.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <svg width={21} height={21} viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 9l10 13L22 9z" fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M2 9h20M8 9l4-7M16 9l-4-7" stroke="#8b5cf6" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
          }
        </div>
        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", paddingLeft: 5, minWidth: 0 }}>
          <div style={{ height: 14, display: "flex", alignItems: "flex-end" }}>
            {hasOld && (
              <div style={{ color: "rgba(61,43,31,0.35)", fontSize: 9, textDecoration: "line-through", lineHeight: 1.3, whiteSpace: "nowrap" }}>
                ₹{parseFloat(pkg.old_price!).toFixed(0)}
              </div>
            )}
          </div>
          <div style={{ color: isOffer ? "#ef4444" : "#7c3aed", fontWeight: 900, fontSize: 13, lineHeight: 1.1, whiteSpace: "nowrap" }}>
            ₹{parseFloat(pkg.price).toFixed(0)}
          </div>
        </div>
      </div>
      <div style={{ color: "#1a0a2e", fontWeight: 800, fontSize: 9.5, lineHeight: 1.2, letterSpacing: "0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </div>
    </div>
  );
}

let _savedDailyOfferIdx = 0;

function DailyOfferSection() {
  const [, setLocation] = useLocation();
  const cacheKey = `${API}/settings/daily_offer_packages`;
  const [pkgs, setPkgs] = useState<DailyOfferPkg[]>(() => getCached<DailyOfferPkg[]>(cacheKey) ?? []);

  const handleCardClick = (pkg: DailyOfferPkg) => {
    if (!pkg.game_id) return;
    sessionStorage.setItem("pendingSelectPkgId", String(pkg.id));
    setLocation(`/game/${pkg.game_id}`);
  };
  const [headIdx, setHeadIdx] = useState(_savedDailyOfferIdx);
  const rowRef  = useRef<HTMLDivElement>(null);
  const ref0    = useRef<HTMLDivElement>(null);
  const ref1    = useRef<HTMLDivElement>(null);
  const ref2    = useRef<HTMLDivElement>(null);
  // All slots share the same DOM dimensions (H × flex:1).
  // The non-featured slots are visually shrunk via a persistent CSS scale transform.
  // This means card content never reflows when a card moves between slots.
  const H = 80;
  const SCALE_SMALL = 84 / 97; // ≈ 0.866 — resting scale for slots 1 and 2

  useEffect(() => {
    cachedFetch<DailyOfferPkg[]>(cacheKey)
      .then(d => setPkgs(Array.isArray(d) ? d : []))
      .catch(() => {});
    const onUpdate = () => {
      invalidateCache(cacheKey);
      cachedFetch<DailyOfferPkg[]>(cacheKey).then(d => setPkgs(Array.isArray(d) ? d : [])).catch(() => {});
    };
    window.addEventListener("skyAdminUpdate", onUpdate);
    return () => window.removeEventListener("skyAdminUpdate", onUpdate);
  }, [cacheKey]);

  useEffect(() => { _savedDailyOfferIdx = headIdx; }, [headIdx]);

  useEffect(() => {
    const n = pkgs.length;
    if (n < 2) return;
    let t0: ReturnType<typeof setTimeout>;
    let t1: ReturnType<typeof setTimeout>;

    const cycle = () => {
      t0 = setTimeout(() => {
        // Measure live pixel distances immediately before animating
        let d0 = 320, d1 = 108, d2 = 94;
        if (rowRef.current) {
          const c = rowRef.current.children;
          const w0 = (c[0] as HTMLElement)?.offsetWidth ?? 99;
          const w1 = (c[1] as HTMLElement)?.offsetWidth ?? 86;
          d0 = rowRef.current.offsetWidth + 20;
          d1 = w0 + 8;
          d2 = w1 + 8;
        }

        const OPT: KeyframeAnimationOptions = {
          duration: 440,
          easing: "cubic-bezier(0.4,0,0.2,1)",
          fill: "forwards",
        };

        const s = SCALE_SMALL;

        // All three .animate() calls happen in the same JS execution tick.
        // Slots 1 and 2 start from their CSS resting scale(s), not scale(1),
        // so the animation perfectly matches the persistent CSS transform —
        // when cancel() snaps back to CSS, the new render at the same scale
        // is pixel-identical and no content reflow ever occurs.
        ref0.current?.animate(
          [{ transform: `translateX(0px) scale(1)` },
           { transform: `translateX(-${d0}px) scale(${s})` }],
          OPT,
        );
        ref1.current?.animate(
          [{ transform: `translateX(0px) scale(${s})` },
           { transform: `translateX(-${d1}px) scale(1)` }],
          OPT,
        );
        ref2.current?.animate(
          [{ transform: `translateX(0px) scale(${s})` },
           { transform: `translateX(-${d2}px) scale(${s})` }],
          OPT,
        );

        t1 = setTimeout(() => {
          // cancel() snaps transforms back to base — flushSync forces React to
          // commit the new headIdx in the SAME js tick so the browser never
          // paints the "old content at natural positions" intermediate frame.
          [ref0, ref1, ref2].forEach(r => r.current?.getAnimations().forEach(a => a.cancel()));
          flushSync(() => setHeadIdx(i => (i + 1) % n));
          cycle();
        }, 440);
      }, 4000);
    };

    cycle();
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [pkgs.length, SCALE_SMALL]);

  if (pkgs.length === 0) return null;

  const n = pkgs.length;
  const slots: (DailyOfferPkg | null)[] = [
    pkgs[headIdx % n],
    n > 1 ? pkgs[(headIdx + 1) % n] : null,
    n > 2 ? pkgs[(headIdx + 2) % n] : null,
  ];

  const placeholder = <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: 16, height: "100%", boxShadow: "0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)" }} />;
  const s = SCALE_SMALL;

  return (
    <section style={{ padding: "0 0 4px" }}>
      <style>{`
        @keyframes doFadeIn { from { opacity: 0 } to { opacity: 1 } }
        .daily-s2-enter { animation: doFadeIn 0.42s ease forwards; }
      `}</style>
      <div style={{ padding: "0 16px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#7F00FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.3L12 17l-6.2 4.2 2.4-7.3L2 9.4h7.6z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ color: "#3D2B1F", fontSize: 13, fontWeight: 700, letterSpacing: "0.01em" }}>Daily Offers</span>
        <span style={{ background: "linear-gradient(90deg,#f59e0b,#fbbf24)", color: "#3D2B1F", fontSize: 8, fontWeight: 900, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.08em" }}>HOT</span>
      </div>
      <div style={{ overflowX: "hidden", padding: "4px 16px 24px" }}>
        <div ref={rowRef} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* All three slots: identical DOM size. Scale is the ONLY visual differentiator.
              When cancel() snaps back to CSS, new slot 0 at scale(1) = animation end state → zero reflow. */}
          <div ref={ref0} style={{ flex: 1, height: H, transformOrigin: "left center", transform: "scale(1)" }}>
            {slots[0] ? <DailyOfferCard pkg={slots[0]} onClick={() => handleCardClick(slots[0]!)} /> : placeholder}
          </div>
          <div ref={ref1} style={{ flex: 1, height: H, transformOrigin: "right center", transform: `scale(${s})` }}>
            {slots[1] ? <DailyOfferCard pkg={slots[1]} onClick={() => handleCardClick(slots[1]!)} /> : placeholder}
          </div>
          <div ref={ref2} key={`s2-${headIdx}`} className="daily-s2-enter" style={{ flex: 1, height: H, transformOrigin: "right center", transform: `scale(${s})` }}>
            {slots[2] ? <DailyOfferCard pkg={slots[2]} onClick={() => handleCardClick(slots[2]!)} /> : placeholder}
          </div>
        </div>
      </div>
    </section>
  );
}

function MainSite() {
  return (
    <div style={{ overflowX: "hidden", paddingTop: "88px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ flex: 1 }}>
        <AnimatedPage>
          <div style={{ minHeight: "220px" }}>
            <PromoBannerSlider />
          </div>
          <div style={{ height: 8 }} />
          <DailyOfferSection />
          <div style={{ height: 8 }} />
          <div style={{ minHeight: "500px" }}>
            <GameSelectSection />
          </div>
          <AnnouncementBar />
          <PromoCarousel />
          <WhyChooseUs />
          <WhatsAppSection />
        </AnimatedPage>
      </div>
      <Footer />
      <WhatsAppFAB />
      <LatestNewsPopup />
    </div>
  );
}

// ── Admin Page ──────────────────────────────────────────────────────────────
function AdminPage() {
  const [, setLocation] = useLocation();
  return <AdminPanel fullPage onClose={() => setLocation("/")} />;
}

// ── Packages Page ──────────────────────────────────────────────────────────
function PackagesPage() {
  const { navigateTo, exiting } = usePageNav();
  const [, setLocation] = useLocation();
  const { getToken, isSignedIn } = useAuth();
  const [mlbbVerified, setMlbbVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setMlbbVerified(false);
      return;
    }
    getToken().then(token => {
      fetch(`${API}/verify/mlbb`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      })
        .then(r => r.json())
        .then(data => setMlbbVerified(!!(data.ok && data.account)))
        .catch(() => setMlbbVerified(false));
    });
  }, [isSignedIn]);

  const { addToCart } = useCart();

  function handleBuy(pkg: SelectedPackage) {
    setSelectedPackage(pkg);
    setTargetGameName(pkg.gameName ?? "MLBB");
    setAfterTargetPath("/pay");
    setLocation("/mlbb-target");
  }

  function handleAddToCart(pkg: SelectedPackage) {
    addToCart({
      id: pkg.id,
      diamonds: pkg.diamonds,
      bonus_diamonds: pkg.bonus_diamonds,
      price: pkg.price,
      name: pkg.name,
      category: pkg.category,
    });
  }

  return (
    <AnimatedPage skipPageAnim>
      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, overflowX: "hidden" }}>
        <style>{`
          @keyframes pkgSlideLeft {
            from { opacity: 0; transform: translateX(-28px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
        <div style={{ paddingTop: 72 }} />
        <PackagesSection onPackageSelect={(_id) => {}} onBack={() => navigateTo("/", "backward")} onBuy={handleBuy} onAddToCart={handleAddToCart} isExiting={exiting} />
      </div>
    </AnimatedPage>
  );
}

// ── Auth Page Shell ─────────────────────────────────────────────────────────
function AuthPageShell({ children, title, subtitle, isSignUp = false }: { children: React.ReactNode; title: string; subtitle: string; isSignUp?: boolean }) {
  const [, setLocation] = useLocation();

  const diag = (delay: number): React.CSSProperties => ({
    animation: `authFadeIn 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#07080a" }}>
      <style>{`
        @keyframes authFadeIn {
          from { opacity: 0; transform: translate(-18px, -18px); }
          to   { opacity: 1; transform: translate(0, 0); }
        }
        /* Hide Clerk's "Secured by Clerk" branding footer */
        [class*="powered-by-clerk"], .cl-footer__pages,
        .cl-internal-powered-by-clerk { display: none !important; }

        /* Force Clerk social buttons to have visible outline */
        .cl-socialButtonsBlockButton {
          background: #13151c !important;
          border: 2px solid rgba(255,255,255,0.38) !important;
          border-radius: 10px !important;
          height: 44px !important;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease !important;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05) !important;
        }
        .cl-socialButtonsBlockButton:hover {
          border-color: rgba(245,158,11,0.7) !important;
          background: #1b1d26 !important;
          box-shadow: 0 0 0 1px rgba(245,158,11,0.15), 0 0 12px rgba(245,158,11,0.1) !important;
        }
        .cl-socialButtonsBlockButtonText {
          color: #f3f4f6 !important;
          font-weight: 500 !important;
          font-size: 0.875rem !important;
        }
        .cl-socialButtonsBlockButtonIconBox img,
        .cl-socialButtonsBlockButtonIconBox svg {
          width: 18px !important;
          height: 18px !important;
        }
      `}</style>

      {/* Subtle background grain / gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "linear-gradient(135deg, rgba(245,158,11,0.05) 0%, transparent 50%, rgba(245,158,11,0.03) 100%)",
      }} />
      <div className="fixed top-0 left-0 w-96 h-96 pointer-events-none" style={{
        background: "radial-gradient(ellipse at top left, rgba(245,158,11,0.08) 0%, transparent 70%)",
      }} />

      {/* Back link */}
      <div className="relative z-10 px-6 pt-6" style={diag(0)}>
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#6b7280" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to store
        </button>
      </div>

      {/* Centered content */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-8">
        <div className="w-full max-w-[380px] mx-auto">

          {/* Logo + wordmark */}
          <div className="flex items-center gap-3 mb-8" style={diag(0.07)}>
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ border: "1.5px solid rgba(245,158,11,0.5)" }}>
              <img src="/logo.webp" alt="Sky Official" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight">Sky Official</div>
              <div className="text-xs" style={{ color: "#f59e0b", letterSpacing: "0.12em", fontSize: 9, fontWeight: 600, textTransform: "uppercase" }}>Recharge / Top‑Up Store</div>
            </div>
          </div>

          {/* Title */}
          <div style={diag(0.14)}>
            {isSignUp && (
              <div className="inline-flex items-center gap-1.5 mb-3" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "4px 12px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>New Account</span>
              </div>
            )}
            <h1 className="font-bold text-white leading-tight" style={{ fontSize: "clamp(1.5rem,6vw,1.85rem)", letterSpacing: "-0.02em" }}>{title}</h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7280" }}>{subtitle}</p>
          </div>

          {/* Divider */}
          <div className="mt-7 mb-6" style={{ height: 1, background: isSignUp ? "linear-gradient(90deg, rgba(34,197,94,0.25) 0%, rgba(255,255,255,0.05) 100%)" : "linear-gradient(90deg, rgba(245,158,11,0.25) 0%, rgba(255,255,255,0.05) 100%)", ...diag(0.21) }} />

          {/* Clerk form */}
          <div style={diag(0.28)}>
            {children}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Sign In Page ───────────────────────────────────────────────────────────
function SignInPage() {
  return (
    <AuthPageShell
      title="Welcome back"
      subtitle="Log in to your Sky Official account."
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={basePath || "/"}
        appearance={clerkAppearance}
      />
    </AuthPageShell>
  );
}

// ── Sign Up Page ───────────────────────────────────────────────────────────
function SignUpPage() {
  return (
    <AuthPageShell
      title="Create your account"
      subtitle="New to Sky Official? Sign up to start topping up."
      isSignUp
    >
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={basePath || "/"}
        appearance={clerkAppearance}
      />
    </AuthPageShell>
  );
}

// ── Policy Page Shell ────────────────────────────────────────────────────────
function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <div style={{ background: "#FAF9F6", minHeight: "100vh", paddingBottom: 48 }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(230,222,211,0.97)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid rgba(197,180,162,0.35)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button onClick={() => setLocation("/")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(61,43,31,0.05)", border: "1px solid rgba(197,180,162,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15 }}>{title}</div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "72px 20px 0" }}>
        <div style={{ color: "rgba(61,43,31,0.75)", fontSize: 14, lineHeight: 1.8 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function TermsPage() {
  return (
    <PolicyPage title="Terms & Conditions">
      <h2 style={{ color: "#A89482", fontWeight: 800, fontSize: 18, margin: "0 0 12px" }}>Terms & Conditions</h2>
      <p style={{ color: "rgba(61,43,31,0.4)", fontSize: 12, marginBottom: 20 }}>Last updated: June 2026</p>

      <p>By using Sky Official, you agree to the following terms. Please read them carefully before making any purchase.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>1. Services</h3>
      <p>Sky Official provides in-game top-up and currency services for multiple titles including but not limited to Mobile Legends: Bang Bang, Free Fire, PUBG Mobile, and other supported games. We are an independent reseller and are not affiliated with or endorsed by any game developer or publisher.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>2. Eligibility</h3>
      <p>You must provide a valid Player ID (and Server ID where applicable) for us to deliver your purchased currency. You are responsible for entering the correct account details. We are not liable for deliveries made to incorrectly provided accounts.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>3. Payment</h3>
      <p>All payments are made via UPI. Payment is due before in-game currency delivery. Once payment is confirmed, the order will be processed. We do not store any payment card information.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>4. Delivery</h3>
      <p>In-game currency is typically delivered within minutes of payment confirmation. During peak hours or technical issues, delivery may take up to 24 hours. We will keep you informed via WhatsApp if there are any delays.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>5. Account Security</h3>
      <p>We will never ask for your game account password or login credentials. Never share your credentials with anyone. We only require your Player ID (and Server ID where applicable) to process your order.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>6. Prohibited Activities</h3>
      <p>You may not use our services for fraudulent transactions, chargebacks, or any activity that violates the terms of service of the respective game.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>7. Changes</h3>
      <p>We reserve the right to modify these terms at any time. Continued use of our service constitutes acceptance of any changes.</p>

      <p style={{ marginTop: 24, color: "rgba(61,43,31,0.4)", fontSize: 12 }}>For questions, contact us on WhatsApp.</p>
    </PolicyPage>
  );
}

function PrivacyPage() {
  return (
    <PolicyPage title="Privacy Policy">
      <h2 style={{ color: "#A89482", fontWeight: 800, fontSize: 18, margin: "0 0 12px" }}>Privacy Policy</h2>
      <p style={{ color: "rgba(61,43,31,0.4)", fontSize: 12, marginBottom: 20 }}>Last updated: June 2026</p>

      <p>Your privacy is important to us. This policy explains how Sky Official collects and uses your information.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Information We Collect</h3>
      <p>We collect the following information when you use our service:</p>
      <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>Your Player ID and Server ID (where applicable) for the game you are topping up</li>
        <li>Your email address (via Clerk authentication, for order confirmations)</li>
        <li>Order history and transaction references</li>
      </ul>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>How We Use Your Information</h3>
      <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>To process and deliver your in-game currency orders</li>
        <li>To send order confirmation and status notifications</li>
        <li>To provide customer support via WhatsApp</li>
        <li>To maintain order history for your reference</li>
      </ul>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Data Security</h3>
      <p>We take data security seriously. We do not store payment card information. We do not sell or share your personal data with third parties. Authentication is handled by Clerk, a secure identity platform.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Cookies</h3>
      <p>We use minimal cookies for authentication and session management. No tracking or advertising cookies are used.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Contact</h3>
      <p>If you have questions about your data or this policy, contact us on WhatsApp.</p>
    </PolicyPage>
  );
}

function RefundPage() {
  return (
    <PolicyPage title="Refund Policy">
      <h2 style={{ color: "#A89482", fontWeight: 800, fontSize: 18, margin: "0 0 12px" }}>Refund Policy</h2>
      <p style={{ color: "rgba(61,43,31,0.4)", fontSize: 12, marginBottom: 20 }}>Last updated: June 2026</p>

      <p>We want you to be completely satisfied with your purchase. Please read our refund policy carefully.</p>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Eligible for Refund</h3>
      <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <li><strong style={{ color: "#3D2B1F" }}>Wrong account delivery:</strong> If in-game currency was delivered to the wrong account due to our error, we will issue a full refund or re-deliver.</li>
        <li><strong style={{ color: "#3D2B1F" }}>Duplicate payment:</strong> If you were charged twice for the same order, we will refund the extra charge.</li>
        <li><strong style={{ color: "#3D2B1F" }}>Non-delivery:</strong> If payment was received but in-game currency was not delivered within 24 hours, a full refund will be issued.</li>
      </ul>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Not Eligible for Refund</h3>
      <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>Orders where the correct Player ID (and Server ID where applicable) were provided and in-game currency was successfully delivered</li>
        <li>Orders cancelled after in-game currency has been delivered</li>
        <li>Wrong account details provided by the customer</li>
      </ul>

      <h3 style={{ color: "#3D2B1F", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>How to Request a Refund</h3>
      <p>Contact us on WhatsApp with your Order ID and a description of the issue. Refund requests are reviewed within 24 hours. Approved refunds are processed within 2–3 business days to your original UPI account.</p>

      <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "14px 16px", marginTop: 24 }}>
        <p style={{ color: "#16a34a", fontWeight: 700, margin: "0 0 6px", fontSize: 14 }}>Our Commitment</p>
        <p style={{ color: "rgba(61,43,31,0.6)", margin: 0, fontSize: 13 }}>We stand behind every transaction. If something goes wrong on our end, we will make it right. Customer satisfaction is our top priority.</p>
      </div>
    </PolicyPage>
  );
}

// ── Pending payment session helper ──────────────────────────────────────────
const PAY_SESSION_KEY = "sky_pay_session";
function checkPendingPaymentSession(): boolean {
  try {
    const raw = sessionStorage.getItem(PAY_SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s.startedAt || !s.pkg) return false;
    const elapsed = (Date.now() - s.startedAt) / 1000;
    return elapsed < 300;
  } catch { return false; }
}
function getPendingPaymentSecondsLeft(): number {
  try {
    const raw = sessionStorage.getItem(PAY_SESSION_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw);
    if (!s.startedAt) return 0;
    const elapsed = (Date.now() - s.startedAt) / 1000;
    return Math.max(0, Math.floor(300 - elapsed));
  } catch { return 0; }
}

// ── Notifications Page ──────────────────────────────────────────────────────
function NotificationsPage() {
  const { getToken, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pendingPayment, setPendingPayment] = useState(() => checkPendingPaymentSession());
  const [pendingSeenThisVisit, setPendingSeenThisVisit] = useState(false);
  const [pendingSecondsLeft, setPendingSecondsLeft] = useState(() => getPendingPaymentSecondsLeft());
  useEffect(() => {
    const interval = setInterval(() => {
      const secs = getPendingPaymentSecondsLeft();
      setPendingSecondsLeft(secs);
      if (secs <= 0) setPendingPayment(false);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const EXPANDABLE = ["wallet_credited", "order_completed", "wallet_deducted", "admin_note", "system"];

  const fetchNotifications = async () => {
    if (!isSignedIn) return;
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  const markAllRead = async () => {
    const token = await getToken();
    if (!token) return;
    await fetch(`${API}/notifications/read-all`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id: number) => {
    const token = await getToken();
    if (!token) return;
    await fetch(`${API}/notifications/${id}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleCardClick = (n: any) => {
    if (!n.read) markRead(n.id);
    if (n.body) {
      setExpandedId(prev => prev === n.id ? null : n.id);
    }
  };

  useEffect(() => { fetchNotifications(); }, [isSignedIn]);

  const unread = notifications.filter(n => !n.read).length;

  const relativeTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const stripEmoji = (str: string) =>
    str.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}]/gu, "").replace(/\s+/g, " ").trim();

  const getExpandContent = (n: any) => {
    return n.body ? stripEmoji(n.body) : null;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAF9F6", paddingTop: 72, paddingBottom: 40 }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setLocation(-1 as any)} style={{ background: "none", border: "none", color: "#1a1a1a", cursor: "pointer", padding: 4, display: "flex" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 style={{ color: "#1a1a1a", fontSize: 18, fontWeight: 800, margin: 0, flex: 1 }}>Notifications</h1>
          {unread > 0 && (
            <button onClick={markAllRead} style={{ background: "none", border: "1px solid rgba(127,0,255,0.3)", borderRadius: 8, color: "#7F00FF", fontSize: 12, fontWeight: 700, padding: "5px 12px", cursor: "pointer" }}>
              Mark all read
            </button>
          )}
        </div>

        {pendingPayment && (
          <div
            onClick={() => { setPendingSeenThisVisit(true); setLocation("/pay"); }}
            style={{ background: "#fff", border: "1px solid rgba(245,158,11,0.45)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", boxShadow: "0 2px 12px rgba(245,158,11,0.08)" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: "#1a1a1a", fontSize: 14, fontWeight: 700, flex: 1 }}>Unsubmitted Payment</span>
                  {!pendingSeenThisVisit && <span style={{ width: 8, height: 8, background: "#ef4444", borderRadius: "50%", flexShrink: 0 }} />}
                </div>
                <div style={{ background: "rgba(245,158,11,0.05)", borderRadius: 8, padding: "10px 12px", margin: "4px 0 10px", borderLeft: "3px solid rgba(245,158,11,0.35)" }}>
                  <p style={{ color: "#999", fontSize: 12, fontWeight: 600, margin: "0 0 6px", fontStyle: "italic" }}>Dear User,</p>
                  <p style={{ color: "#6b6b6b", fontSize: 13, margin: 0, lineHeight: 1.6 }}>You left a payment in progress. Your order hasn't been placed yet. Please resume before the session expires.</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: pendingSecondsLeft <= 60 ? "#ef4444" : "#f59e0b", fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>
                    {pendingSecondsLeft <= 0 ? "Expired" : `${String(Math.floor(pendingSecondsLeft / 60)).padStart(2, "0")}:${String(pendingSecondsLeft % 60).padStart(2, "0")} remaining`}
                  </span>
                  <span style={{ background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 700, padding: "4px 12px" }}>
                    Resume →
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(0,0,0,0.3)", fontSize: 14 }}>Loading…</div>
        ) : notifications.length === 0 && !pendingPayment ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "rgba(0,0,0,0.4)", fontSize: 14 }}>No notifications yet.</p>
            <p style={{ color: "rgba(0,0,0,0.3)", fontSize: 12, marginTop: 6 }}>You'll be notified about order updates, wallet credits, and more.</p>
          </div>
        ) : notifications.length === 0 ? null : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notifications.map(n => {
              const isExpandable = !!n.body;
              const isExpanded = expandedId === n.id;
              const expandContent = getExpandContent(n);

              return (
                <div
                  key={n.id}
                  onClick={() => handleCardClick(n)}
                  style={{
                    background: "#fff",
                    border: `1px solid ${n.read ? "#e8e6e0" : "rgba(127,0,255,0.2)"}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                    cursor: isExpandable || !n.read ? "pointer" : "default",
                    transition: "border-color 0.2s",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isExpanded ? 6 : 4 }}>
                      <span style={{ color: "#1a1a1a", fontSize: 14, fontWeight: 800, flex: 1, lineHeight: 1.4 }}>{stripEmoji(n.title)}</span>
                      {!n.read && <span style={{ width: 8, height: 8, background: "#ef4444", borderRadius: "50%", flexShrink: 0 }} />}
                    </div>

                    {isExpandable && isExpanded && (
                      <div style={{ background: "#FAF9F6", borderRadius: 8, padding: "12px 14px", marginBottom: 8, borderLeft: "3px solid rgba(127,0,255,0.3)" }}>
                        <p style={{ color: "#999", fontSize: 12, fontWeight: 600, margin: "0 0 8px", fontStyle: "italic" }}>Dear User,</p>
                        <p style={{ color: "#4a4a4a", fontSize: 13, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.body}</p>
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#aaa", fontSize: 11 }}>{relativeTime(n.created_at)}</span>
                      {isExpandable && (
                        <span style={{ color: "rgba(127,0,255,0.5)", fontSize: 10, fontWeight: 600, letterSpacing: "0.01em" }}>
                          {isExpanded ? "▲ hide" : "▼ details"}
                        </span>
                      )}
                    </div>
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

// ── Maintenance Page ─────────────────────────────────────────────────────────
function MaintenancePage({ endTime, message }: { endTime: string | null; message: string }) {
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number } | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endTime) return;
    const target = new Date(endTime).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setExpired(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  useEffect(() => {
    if (expired) {
      const id = setTimeout(() => window.location.reload(), 1500);
      return () => clearTimeout(id);
    }
  }, [expired]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: "linear-gradient(160deg,#0a0a12 0%,#12091e 50%,#0a0a12 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "32px 24px", boxSizing: "border-box", position: "fixed", inset: 0, zIndex: 9999,
    }}>
      {/* Animated gears icon */}
      <div style={{ position: "relative", width: 90, height: 90, marginBottom: 28 }}>
        <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
          <g style={{ transformOrigin: "45px 45px", animation: "maint-spin 8s linear infinite" }}>
            <path d="M45 27a18 18 0 1 1 0 36 18 18 0 0 1 0-36z" fill="rgba(139,92,246,0.12)" stroke="#7c3aed" strokeWidth="2"/>
            {[0,45,90,135,180,225,270,315].map(deg => (
              <rect key={deg} x="42" y="8" width="6" height="11" rx="3" fill="#7c3aed"
                style={{ transformOrigin: "45px 45px", transform: `rotate(${deg}deg)` }} />
            ))}
          </g>
          <circle cx="45" cy="45" r="7" fill="#a78bfa"/>
        </svg>
        <style>{`
          @keyframes maint-spin { to { transform: rotate(360deg); } }
          @keyframes maint-pulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
        `}</style>
      </div>

      {/* Title */}
      <div style={{ color: "#e9d5ff", fontWeight: 900, fontSize: 22, letterSpacing: "-0.01em", textAlign: "center", marginBottom: 8 }}>
        Under Maintenance
      </div>
      <div style={{ color: "rgba(233,213,255,0.55)", fontSize: 14, textAlign: "center", maxWidth: 280, lineHeight: 1.5, marginBottom: 32 }}>
        {expired ? "Maintenance complete! Reloading…" : message}
      </div>

      {/* Countdown */}
      {endTime && !expired && timeLeft && (
        <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
          {[
            { label: "HRS",  val: timeLeft.h },
            { label: "MIN",  val: timeLeft.m },
            { label: "SEC",  val: timeLeft.s },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 14,
                background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#c4b5fd", fontWeight: 900, fontSize: 26, fontVariantNumeric: "tabular-nums",
              }}>
                {pad(val)}
              </div>
              <div style={{ color: "rgba(196,181,253,0.45)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em" }}>{label}</div>
            </div>
          ))}
        </div>
      )}
      {endTime && !expired && !timeLeft && (
        <div style={{ marginBottom: 32, color: "rgba(196,181,253,0.45)", fontSize: 13 }}>Calculating…</div>
      )}
      {(!endTime || expired) && !expired && (
        <div style={{ marginBottom: 32, color: "rgba(196,181,253,0.45)", fontSize: 13 }}>Duration not specified — check back soon.</div>
      )}

      {/* Sky Official branding */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <img src="/sky-official-logo.png" alt="Sky Official" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <span style={{ color: "rgba(233,213,255,0.3)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>SKY OFFICIAL</span>
      </div>
    </div>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<{ enabled: boolean; end_time: string | null; message: string } | null>(null);

  useEffect(() => {
    const check = () => {
      fetch(`${API}/settings/maintenance`)
        .then(r => r.json())
        .then(d => setStatus(d))
        .catch(() => setStatus({ enabled: false, end_time: null, message: "" }));
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  // While loading, render children (avoids flash)
  if (status === null) return <>{children}</>;

  // Admins and staff have admin_token in sessionStorage — always let them through
  const hasAdminToken = !!sessionStorage.getItem("admin_token");
  if (!status.enabled || hasAdminToken) return <>{children}</>;

  return <MaintenancePage endTime={status.end_time} message={status.message} />;
}

// ── Persistent Navbar (outside page transitions so it never moves) ───────────
function PersistentNavbar() {
  const [location] = useLocation();
  if (location.startsWith("/sign-in") || location.startsWith("/sign-up") || location.startsWith("/admin") || location.startsWith("/staff") || location.startsWith("/profile") || location.startsWith("/support") || location === "/pay" || location === "/terms" || location === "/privacy" || location === "/refund" || location === "/leaderboard" || location === "/wallet-history") return null;
  return <Navbar />;
}

// ── Router ─────────────────────────────────────────────────────────────────
function AppRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      localization={{
        socialButtonsBlockButton: "Continue with {{provider}}",
        signIn: {
          start: {
            title: "Sign in to Sky Official",
            subtitle: "Welcome back! Please sign in to continue.",
          },
        },
        signUp: {
          start: {
            title: "Join Sky Official",
            subtitle: "Create your account to get started.",
          },
        },
      }}
    >
      <TransitionProvider>
        <PersistentNavbar />
        <AnimatedBackground />
        <MaintenanceGate>
        <UsernameGate>
        <div style={{ position: "relative" }}>
        <Switch>
          <Route path="/" component={MainSite} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/mlbb-target" component={MLBBTargetPage} />
          <Route path="/cart" component={CartPage} />
          <Route path="/pay" component={PaymentPage} />
          <Route path="/verify" component={MLBBVerifyPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/orders" component={OrderHistoryPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/refund" component={RefundPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/staff" component={StaffPortal} />
          <Route path="/game/:gameId" component={GameProductsPage} />
          <Route path="/favorites" component={FavoritesPage} />
          <Route path="/rank-boost" component={() => <RankBoostPage />} />
          <Route path="/wallet-history" component={WalletHistoryPage} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route component={MainSite} />
        </Switch>
        </div>
        </UsernameGate>
        </MaintenanceGate>
      </TransitionProvider>
    </ClerkProvider>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const minPassedRef = useRef(false);
  const contentReadyRef = useRef(false);

  const tryDismiss = useCallback(() => {
    if (minPassedRef.current && contentReadyRef.current) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // Minimum visible time so it doesn't flash on cache hits
    const t = setTimeout(() => {
      minPassedRef.current = true;
      tryDismiss();
    }, 800);
    // Dismiss when games signal they're loaded
    const onReady = () => {
      contentReadyRef.current = true;
      tryDismiss();
    };
    // Track internet connectivity for the offline message
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("skyContentReady", onReady);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(t);
      window.removeEventListener("skyContentReady", onReady);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [tryDismiss]);

  return (
    <WouterRouter base={basePath}>
      <CartProvider>
        <div style={{ background: "#0d0d0d", minHeight: "100vh", overflowX: "hidden" }}>
          {loading && <LoadingScreen isOffline={isOffline} onRetry={() => window.location.reload()} />}
          <AppRoutes />
        </div>
      </CartProvider>
    </WouterRouter>
  );
}
