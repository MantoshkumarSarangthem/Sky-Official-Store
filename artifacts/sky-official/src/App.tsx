import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import AdminPanel from "./components/AdminPanel";
import PackagesSection from "./components/PackagesSection";
import OrderHistoryPage from "./components/OrderHistoryPage";
import ProfilePage from "./components/ProfilePage";
import MLBBVerifyPage from "./components/MLBBVerifyPage";
import MLBBTargetPage, { setAfterTargetPath } from "./components/MLBBTargetPage";
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

const WHATSAPP_GROUP = "https://chat.whatsapp.com/DB3FwXqNUi649KT18VjVu9";
const WHATSAPP_NUMBER = "https://wa.me/919362003788";

const NAV_SUBTITLES = [
  "Instant Delivery",
  "Affordable Prices",
  "P2P Chat Support",
  "Secure Transaction",
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

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
function LoadingScreen({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(false);

  const triggerDone = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const t = setTimeout(triggerDone, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "#FAF9F6" }}>
      <div style={{ position: "absolute", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,148,130,0.06) 0%, transparent 60%)", pointerEvents: "none" }} />
      <div className="relative flex flex-col items-center z-10" style={{ gap: 28 }}>
        <div style={{ position: "relative", width: 74, height: 74 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(245,158,11,0.15)" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#f59e0b", animation: "skySpin 1.1s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/logo-phoenix.png" alt="Sky Official" style={{ width: 48, height: 48, objectFit: "contain" }} />
          </div>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 6 }}>
          <span style={{ color: "#3D2B1F", fontSize: 13, fontWeight: 700, letterSpacing: "0.3em" }}>SKY OFFICIAL</span>
          <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: "0.32em", background: "linear-gradient(90deg, transparent, #f59e0b, #fcd34d, #f59e0b, transparent)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "skyShimmer 2s ease-in-out infinite" }}>SHOP SMART | PLAY HARD</span>
        </div>
        <div style={{ width: 100, height: 1, background: "rgba(61,43,31,0.12)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg,#f59e0b,#fcd34d)", borderRadius: 999, animation: "skyBar 2s ease-out forwards" }} />
        </div>
      </div>
      <style>{`
        @keyframes skySpin    { to { transform: rotate(360deg); } }
        @keyframes skyShimmer { 0% { background-position: 150% 0; } 100% { background-position: -150% 0; } }
        @keyframes skyBar     { 0% { width: 0%; } 70% { width: 80%; } 100% { width: 100%; } }
        @keyframes shimmerLR {
          0%   { background-position: 150% 0; }
          100% { background-position: -150% 0; }
        }
        @keyframes scrollTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
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
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { getToken, isSignedIn } = useAuth();

  const hideWallet = location === "/mlbb-target" || location === "/pay";

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

  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e: MouseEvent) => {
      if (!profileMenuRef.current?.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileMenu]);

  return (
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
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ background: "#FAF9F6", border: "1.5px solid #A89482", boxShadow: "0 0 6px 1px rgba(168,148,130,0.3)" }}>
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
            style={{ display: "flex", alignItems: "center", gap: 4, height: 34, background: "rgba(141,110,99,0.12)", border: "1px solid rgba(141,110,99,0.4)", borderRadius: 999, padding: "0 10px 0 6px", cursor: "pointer", flexShrink: 0, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            <img src="/scoin.png" alt="S" style={{ width: 16, height: 16, objectFit: "contain" }} />
            <span style={{ color: "#8D6E63", fontSize: 11, fontWeight: 800 }}>₹{walletBalance.toFixed(0)}</span>
          </button>
        )}
        {isLoaded && (
          user ? (
            <div style={{ position: "relative" }} ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(v => !v)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: "50%", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <div className="rounded-full overflow-hidden border flex-shrink-0" style={{ width: 34, height: 34, borderColor: "#A89482", boxShadow: showProfileMenu ? "0 0 0 2px rgba(141,110,99,0.4)" : "none", transition: "box-shadow 0.15s" }}>
                  <img src={user.imageUrl} alt={user.firstName ?? "User"} className="w-full h-full object-cover" />
                </div>
              </button>
              {showProfileMenu && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", background: "#FFFFFF", border: "1px solid rgba(197,180,162,0.5)", borderRadius: 14, boxShadow: "0 8px 30px rgba(61,43,31,0.1)", minWidth: 168, overflow: "hidden", zIndex: 999, animation: "navSlideDown 0.14s ease both" }}>
                  {([
                    { label: "Profile", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>, action: () => { setLocation("/profile"); setShowProfileMenu(false); } },
                    { label: "My Orders", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { setLocation("/orders"); setShowProfileMenu(false); } },
                    { label: "My Favorites", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { setLocation("/favorites"); setShowProfileMenu(false); } },
                    { label: "Wallet", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M16 14a1 1 0 110-2 1 1 0 010 2z" fill="currentColor"/><path d="M2 11h20" stroke="currentColor" strokeWidth="1.8"/></svg>, action: () => { setLocation("/profile"); setShowProfileMenu(false); } },
                    { label: "Support", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>, action: () => { setLocation("/support"); setShowProfileMenu(false); } },
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
                    onClick={() => { signOut(() => setLocation("/")); setShowProfileMenu(false); }}
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
              style={{ background: "#8D6E63", color: "#FFFFFF", boxShadow: "0 2px 10px rgba(141,110,99,0.4)", fontSize: 12, height: 32, letterSpacing: "0.01em" }}
            >
              Sign In
            </button>
          )
        )}
      </div>
    </nav>
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
        @keyframes pgFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pgFadeOut { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
      {children}
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

function PromoBannerSlider() {
  const [banners, setBanners] = useState<PromoBannerItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const touchStartX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setLocation] = useLocation();

  const fetchBanners = useCallback(() => {
    fetch(`${API}/settings/promo_banners`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setBanners(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBanners();
    window.addEventListener("skyAdminUpdate", fetchBanners);
    return () => window.removeEventListener("skyAdminUpdate", fetchBanners);
  }, [fetchBanners]);

  const advanceSlide = useCallback(() => {
    setActiveIdx(i => (i + 1) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length < 2) return;
    const currentBanner = banners[activeIdx];
    const isVid = currentBanner && (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(currentBanner.image) || currentBanner.image?.startsWith("data:video/"));
    if (isVid) return;
    timerRef.current = setInterval(advanceSlide, 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners.length, activeIdx, advanceSlide]);

  if (banners.length === 0) return null;
  const banner = banners[activeIdx];

  function go(dir: 1 | -1) {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveIdx(i => (i + dir + banners.length) % banners.length);
  }

  return (
    <div style={{ background: "transparent", padding: "6px 14px 12px" }}>
      <div
        style={{ position: "relative", width: "100%", aspectRatio: "21/9", overflow: "hidden", cursor: banner.link ? "pointer" : "default", borderRadius: 18, boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - touchStartX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}
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
          const isVid = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(b.image) || b.image.startsWith("data:video/");
          return isVid ? (
            <video key={b.id} src={b.image} autoPlay muted playsInline onEnded={advanceSlide} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: i === activeIdx ? 1 : 0, transition: "opacity 0.4s ease", pointerEvents: "none" }} />
          ) : (
            <img key={b.id} src={b.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: i === activeIdx ? 1 : 0, transition: "opacity 0.4s ease", pointerEvents: "none" }} />
          );
        })}
        {banners.length > 1 && (
          <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, zIndex: 5 }}>
            {banners.map((_, i) => (
              <div key={i} onClick={e => { e.stopPropagation(); if (timerRef.current) clearInterval(timerRef.current); setActiveIdx(i); }} style={{ width: i === activeIdx ? 20 : 6, height: 6, borderRadius: 999, background: i === activeIdx ? "#f59e0b" : "rgba(255,255,255,0.4)", transition: "all 0.3s ease", cursor: "pointer" }} />
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
  const [games, setGames] = useState<GameItem[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const { navigateTo } = usePageNav();

  const fetchGames = useCallback((forceRefresh = false) => {
    fetch(`${API}/games`, forceRefresh ? { cache: "no-store" } : {})
      .then(r => r.ok ? r.json() : [])
      .then(d => { setGames(Array.isArray(d) ? d : []); setGamesLoading(false); })
      .catch(() => setGamesLoading(false));
  }, []);

  useEffect(() => {
    fetchGames();
    const onUpdate = () => fetchGames(true);
    window.addEventListener("skyAdminUpdate", onUpdate);
    return () => window.removeEventListener("skyAdminUpdate", onUpdate);
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
    <section style={{ background: "transparent", padding: "28px 16px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 6H3a1 1 0 00-1 1v10a1 1 0 001 1h18a1 1 0 001-1V7a1 1 0 00-1-1zM7 12H5m2 0H5m2 0v-2m0 2v2M17 10l1 1 2-2" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span style={{ color: "#3D2B1F", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>Select Game</span>
      </div>
      <style>{`@keyframes nameMarquee{0%,25%{transform:translateX(0)}80%,100%{transform:translateX(-50%)}}`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {games.map((game, idx) => {
          const c = PANEL_GLOW;
          const isRankBoost = game.name.toLowerCase().includes("rank") || game.name.toLowerCase().includes("boost");
          const needsMarquee = game.name.length > 16;
          return (
            <button
              key={game.id}
              onClick={() => {
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
                border: "1px solid rgba(197,180,162,0.4)",
                borderRadius: 16,
                cursor: "pointer",
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 3px 12px rgba(61,43,31,0.07)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
              }}
              onTouchStart={e => (e.currentTarget.style.transform = "scale(0.96)")}
              onTouchEnd={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ width: "100%", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                {game.image ? (
                  <img src={game.image} alt={game.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: game.status === "out_of_stock" ? "grayscale(60%) brightness(0.75)" : "none" }} />
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="3" stroke={c.icon} strokeWidth="1.5"/><path d="M7 12h4m-2-2v4M15 12h2" stroke={c.icon} strokeWidth="1.5" strokeLinecap="round"/></svg>
                )}
                {game.status === "out_of_stock" && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(220,38,38,0.88)", padding: "4px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#FFFFFF", fontSize: 8, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Out of Stock</span>
                  </div>
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
  const [real, setReal] = useState<{ total_orders: number; total_diamonds: number; total_users: number } | null>(null);

  useEffect(() => {
    fetch(`${API}/stats`)
      .then(r => r.ok ? r.json() : null)
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
function maskName(name: string): string {
  if (!name || name.length === 0) return "Player";
  return name[0].toUpperCase() + "***";
}

interface RecentOrder { mlbb_ign: string | null; diamonds: number; created_at: string; pack_name: string | null; currency_label: string | null; }

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
                <span key={i} className="text-gray-700 flex-shrink-0" style={{ fontSize: 13 }}>
                  <span className="font-bold text-amber-600">{maskName(p.mlbb_ign ?? "Player")}</span>{" bought "}<span className="font-bold">{displayName}</span>
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
  return (
    <section className="py-11 px-5 text-center" style={{ background: "#1a5c38" }}>
      <div className="max-w-sm mx-auto flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
          <svg width="27" height="27" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
        </div>
        <h2 className="text-white font-extrabold text-xl leading-tight">Join Our WhatsApp Store</h2>
        <p className="text-green-100 leading-relaxed" style={{ fontSize: 15 }}>Get exclusive offers, faster support, and be the first to know about new packs and discounts — all on WhatsApp.</p>
        <a href={WHATSAPP_GROUP} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white mt-1" style={{ fontSize: 15, background: "#25d366", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", textDecoration: "none" }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
          Join Our WhatsApp Group
        </a>
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
        <div className="w-10 h-10 rounded-full overflow-hidden" style={{ background: "#FAF9F6", border: "1.5px solid #A89482", boxShadow: "0 0 6px 1px rgba(168,148,130,0.3)" }}>
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
            { label: "Terms of Service", to: "/terms" },
            { label: "Privacy Policy",   to: "/privacy" },
            { label: "Refund Policy",    to: "/refund" },
          ].map(({ label, to }) => (
            <button key={to} onClick={() => setLocation(to)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.45)", fontSize: 9.5 }}>
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
  return (
    <a href={WHATSAPP_NUMBER} target="_blank" rel="noopener noreferrer" className="fixed bottom-5 right-3.5 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg" style={{ background: "#25d366", boxShadow: "0 2px 8px rgba(37,211,102,0.22)", textDecoration: "none" }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
    </a>
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
    fetch(`${API}/promo-events`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch(`${API}/packages`)
      .then(r => r.ok ? r.json() : [])
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
function MainSite() {
  return (
    <div style={{ overflowX: "hidden", paddingTop: "88px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <div style={{ flex: 1 }}>
        <AnimatedPage>
          <div style={{ minHeight: "220px" }}>
            <PromoBannerSlider />
          </div>
          <div style={{ height: 20 }} />
          <div style={{ minHeight: "500px" }}>
            <GameSelectSection />
          </div>
          <AnnouncementBar />
          <PromoCarousel />
          <StatsSection />
          <WhyChooseUs />
          <LiveTicker />
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
function AuthPageShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
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
              <div className="text-xs" style={{ color: "#f59e0b", letterSpacing: "0.12em", fontSize: 9, fontWeight: 600, textTransform: "uppercase" }}>Diamond Top‑Up Store</div>
            </div>
          </div>

          {/* Title */}
          <div style={diag(0.14)}>
            <h1 className="font-bold text-white leading-tight" style={{ fontSize: "clamp(1.5rem,6vw,1.85rem)", letterSpacing: "-0.02em" }}>{title}</h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7280" }}>{subtitle}</p>
          </div>

          {/* Divider */}
          <div className="mt-7 mb-6" style={{ height: 1, background: "linear-gradient(90deg, rgba(245,158,11,0.25) 0%, rgba(255,255,255,0.05) 100%)", ...diag(0.21) }} />

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
      title="Create an account"
      subtitle="Join Sky Official and start topping up in seconds."
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
    <div style={{ background: "#0a0a0a", minHeight: "100vh", paddingBottom: 48 }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <button onClick={() => setLocation("/")} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{title}</div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "72px 20px 0" }}>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.8 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function TermsPage() {
  return (
    <PolicyPage title="Terms of Service">
      <h2 style={{ color: "#f59e0b", fontWeight: 800, fontSize: 18, margin: "0 0 12px" }}>Terms of Service</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 20 }}>Last updated: May 2026</p>

      <p>By using Sky Official, you agree to the following terms. Please read them carefully before making any purchase.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>1. Services</h3>
      <p>Sky Official provides Mobile Legends: Bang Bang diamond top-up services. We are an independent seller and are not affiliated with Moonton or Mobile Legends.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>2. Eligibility</h3>
      <p>You must provide a valid MLBB User ID and Server ID for us to deliver diamonds. You are responsible for entering the correct account details. We are not liable for deliveries made to incorrectly provided accounts.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>3. Payment</h3>
      <p>All payments are made via UPI. Payment is due before diamond delivery. Once payment is confirmed, the order will be processed. We do not store any payment card information.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>4. Delivery</h3>
      <p>Diamonds are typically delivered within minutes of payment confirmation. During peak hours or technical issues, delivery may take up to 24 hours. We will keep you informed via WhatsApp if there are any delays.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>5. Account Security</h3>
      <p>We will never ask for your MLBB account password. Never share your login credentials with anyone. We only require your MLBB User ID and Server ID for top-up.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>6. Prohibited Activities</h3>
      <p>You may not use our services for fraudulent transactions, chargebacks, or any activity that violates Mobile Legends' terms of service.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>7. Changes</h3>
      <p>We reserve the right to modify these terms at any time. Continued use of our service constitutes acceptance of any changes.</p>

      <p style={{ marginTop: 24, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>For questions, contact us on WhatsApp.</p>
    </PolicyPage>
  );
}

function PrivacyPage() {
  return (
    <PolicyPage title="Privacy Policy">
      <h2 style={{ color: "#f59e0b", fontWeight: 800, fontSize: 18, margin: "0 0 12px" }}>Privacy Policy</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 20 }}>Last updated: May 2026</p>

      <p>Your privacy is important to us. This policy explains how Sky Official collects and uses your information.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Information We Collect</h3>
      <p>We collect the following information when you use our service:</p>
      <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>Your MLBB User ID and Server ID (to deliver diamonds)</li>
        <li>Your email address (via Clerk authentication, for order confirmations)</li>
        <li>Order history and transaction references</li>
      </ul>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>How We Use Your Information</h3>
      <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>To process and deliver your diamond orders</li>
        <li>To send order confirmation and status emails</li>
        <li>To provide customer support via WhatsApp</li>
        <li>To maintain order history for your reference</li>
      </ul>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Data Security</h3>
      <p>We take data security seriously. We do not store payment card information. We do not sell or share your personal data with third parties. Authentication is handled by Clerk, a secure identity platform.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Cookies</h3>
      <p>We use minimal cookies for authentication and session management. No tracking or advertising cookies are used.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Contact</h3>
      <p>If you have questions about your data or this policy, contact us on WhatsApp.</p>
    </PolicyPage>
  );
}

function RefundPage() {
  return (
    <PolicyPage title="Refund Policy">
      <h2 style={{ color: "#f59e0b", fontWeight: 800, fontSize: 18, margin: "0 0 12px" }}>Refund Policy</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 20 }}>Last updated: May 2026</p>

      <p>We want you to be completely satisfied with your purchase. Please read our refund policy carefully.</p>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Eligible for Refund</h3>
      <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <li><strong style={{ color: "#fff" }}>Wrong account delivery:</strong> If diamonds were delivered to a wrong MLBB account due to our error, we will issue a full refund or re-deliver.</li>
        <li><strong style={{ color: "#fff" }}>Duplicate payment:</strong> If you were charged twice for the same order, we will refund the extra charge.</li>
        <li><strong style={{ color: "#fff" }}>Non-delivery:</strong> If payment was received but diamonds were not delivered within 24 hours, a full refund will be issued.</li>
      </ul>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>Not Eligible for Refund</h3>
      <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>Orders where the correct MLBB ID and Server ID were provided and diamonds were successfully delivered</li>
        <li>Orders cancelled after diamonds have been delivered</li>
        <li>Wrong account details provided by the customer</li>
      </ul>

      <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: "20px 0 8px" }}>How to Request a Refund</h3>
      <p>Contact us on WhatsApp with your Order ID and the issue. Refund requests are reviewed within 24 hours. Approved refunds are processed within 2–3 business days to your original UPI account.</p>

      <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "14px 16px", marginTop: 24 }}>
        <p style={{ color: "#4ade80", fontWeight: 700, margin: "0 0 6px", fontSize: 14 }}>Our Commitment</p>
        <p style={{ color: "rgba(255,255,255,0.6)", margin: 0, fontSize: 13 }}>We stand behind every transaction. If something goes wrong on our end, we will make it right. Customer satisfaction is our top priority.</p>
      </div>
    </PolicyPage>
  );
}

// ── Persistent Navbar (outside page transitions so it never moves) ───────────
function PersistentNavbar() {
  const [location] = useLocation();
  if (location.startsWith("/sign-in") || location.startsWith("/sign-up") || location.startsWith("/admin") || location.startsWith("/staff") || location.startsWith("/profile") || location.startsWith("/support") || location === "/pay") return null;
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
          <Route component={MainSite} />
        </Switch>
        </div>
      </TransitionProvider>
    </ClerkProvider>
  );
}

export default function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return (
    <WouterRouter base={basePath}>
      <CartProvider>
        <div style={{ background: "#0d0d0d", minHeight: "100vh", overflowX: "hidden" }}>
          <AppRoutes />
        </div>
      </CartProvider>
    </WouterRouter>
  );
}
