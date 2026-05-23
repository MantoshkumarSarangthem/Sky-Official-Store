import { useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import RankBoostPage from "./RankBoostPage";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

interface Package {
  id: number;
  diamonds: number;
  bonus_diamonds: number;
  price: string;
  label: string | null;
  name: string | null;
  category: string | null;
  is_popular: boolean;
  sort_order: number;
  status?: string;
}

type CategoryId = "small" | "normal" | "double" | "passes" | "starlight" | "rank";

interface Category {
  id: CategoryId;
  title: string;
  subtitle: string;
  color: string;
  glow: string;
  available: boolean;
  badge?: string;
}

const CATEGORIES: Category[] = [
  { id: "small",     title: "Small Pack",       subtitle: "Quick top-ups for daily players",        color: "#38bdf8", glow: "rgba(56,189,248,0.30)",   available: true },
  { id: "normal",    title: "Normal Pack",       subtitle: "Best value with bonus diamonds",         color: "#f59e0b", glow: "rgba(245,158,11,0.30)",   available: true, badge: "Most Popular" },
  { id: "double",    title: "Double Diamond",    subtitle: "2× diamonds on your 1st recharge (resets yearly)",  color: "#00e5ff", glow: "rgba(0,229,255,0.22)",    available: true },
  { id: "passes",    title: "Passes & Bundles",  subtitle: "Weekly & monthly passes with perks",     color: "#a855f7", glow: "rgba(168,85,247,0.25)",   available: true },
  { id: "starlight", title: "Starlight Cards",   subtitle: "Exclusive skins & limited rewards",      color: "#f5c842", glow: "rgba(245,200,66,0.25)",   available: true },
  { id: "rank",      title: "Rank Boosting",     subtitle: "Rise to Mythical Glory with experts",    color: "#ec4899", glow: "rgba(236,72,153,0.25)",   available: true },
];

// ── Animated Panels ─────────────────────────────────────────────────────────

// MLBB-style 💎 diamond: flat-top crown + pointed pavilion
function MLBBDiamond({ cx, cy, hw, gradId, opacity = 1, style }: {
  cx: number; cy: number; hw: number; gradId: string; opacity?: number; style?: React.CSSProperties;
}) {
  // Outer shape (5 pts): table-left, table-right, belt-right, bottom, belt-left
  const tl = `${cx - hw * 0.62},${cy - hw}`;
  const tr = `${cx + hw * 0.62},${cy - hw}`;
  const br = `${cx + hw},${cy - hw * 0.28}`;
  const bl = `${cx - hw},${cy - hw * 0.28}`;
  const bot = `${cx},${cy + hw}`;
  // Belt y (for internal facet lines)
  const by = cy - hw * 0.28;
  // Inner crown highlight (bright trapezoid centred on table)
  const hl = `${cx - hw * 0.32},${cy - hw} ${cx + hw * 0.32},${cy - hw} ${cx + hw * 0.2},${cy - hw * 0.55} ${cx - hw * 0.2},${cy - hw * 0.55}`;
  return (
    <g style={style} opacity={opacity}>
      {/* Main body */}
      <polygon points={`${tl} ${tr} ${br} ${bot} ${bl}`} fill={`url(#${gradId})`} />
      {/* Crown face (slightly lighter overlay) */}
      <polygon points={`${tl} ${tr} ${br} ${bl}`} fill="rgba(180,230,255,0.18)" />
      {/* Crown table highlight */}
      <polygon points={hl} fill="rgba(255,255,255,0.5)" />
      {/* Left pavilion face */}
      <polygon points={`${bl} ${cx},${by} ${bot}`} fill="rgba(0,55,150,0.38)" />
      {/* Right pavilion face */}
      <polygon points={`${br} ${cx},${by} ${bot}`} fill="rgba(0,30,120,0.5)" />
      {/* Belt edge highlight line */}
      <line x1={cx - hw} y1={by} x2={cx + hw} y2={by} stroke="rgba(255,255,255,0.28)" strokeWidth="0.6" />
      {/* Centre pavilion ridge */}
      <line x1={cx} y1={by} x2={cx} y2={cy + hw} stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
    </g>
  );
}

function SmallPackAnim() {
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <radialGradient id="sp-glow" cx="50%" cy="55%" r="52%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sp-d1" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#93e8ff" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="sp-d2" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#e0f9ff" />
          <stop offset="45%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="56" rx="40" ry="12" fill="url(#sp-glow)" />
      {/* Left small diamond */}
      <MLBBDiamond cx={30} cy={44} hw={10} gradId="sp-d1" opacity={0.9}
        style={{ animation: "sp-bob1 2.4s ease-in-out infinite", transformOrigin: "30px 44px" }} />
      {/* Centre large diamond */}
      <MLBBDiamond cx={60} cy={37} hw={15} gradId="sp-d2" opacity={1}
        style={{ animation: "sp-bob2 2.0s ease-in-out infinite", transformOrigin: "60px 37px" }} />
      {/* Right small diamond */}
      <MLBBDiamond cx={90} cy={44} hw={10} gradId="sp-d1" opacity={0.88}
        style={{ animation: "sp-bob3 2.7s ease-in-out infinite", transformOrigin: "90px 44px" }} />
      {/* Sparkles */}
      <circle cx="18" cy="20" r="1.5" fill="#bae6fd" style={{ animation: "sp-twinkle 1.8s ease-in-out infinite 0.2s" }} />
      <circle cx="104" cy="18" r="2"   fill="#7dd3fc" style={{ animation: "sp-twinkle 2.1s ease-in-out infinite 0.6s" }} />
      <circle cx="112" cy="56" r="1.2" fill="#e0f2fe" style={{ animation: "sp-twinkle 1.6s ease-in-out infinite 0.9s" }} />
      <circle cx="8"   cy="58" r="1.8" fill="#7dd3fc" style={{ animation: "sp-twinkle 2.4s ease-in-out infinite 0.3s" }} />
      <circle cx="60"  cy="9"  r="1.3" fill="#bae6fd" style={{ animation: "sp-twinkle 1.9s ease-in-out infinite 1.1s" }} />
    </svg>
  );
}

function NormalPackAnim() {
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <radialGradient id="np-glow" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="np-d1" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#93e8ff" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="np-d2" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#e0f9ff" />
          <stop offset="45%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="62" rx="46" ry="12" fill="url(#np-glow)" />
      {/* Rotating gold ring */}
      <circle cx="60" cy="40" r="30" fill="none" stroke="#f59e0b" strokeWidth="0.6" strokeOpacity="0.25"
        strokeDasharray="6 4" style={{ animation: "np-ring 6s linear infinite", transformOrigin: "60px 40px" }} />
      {/* Back-left diamond */}
      <MLBBDiamond cx={35} cy={48} hw={10} gradId="np-d1" opacity={0.68}
        style={{ animation: "sp-bob3 2.6s ease-in-out infinite 0.4s", transformOrigin: "35px 48px" }} />
      {/* Back-right diamond */}
      <MLBBDiamond cx={85} cy={47} hw={10} gradId="np-d1" opacity={0.68}
        style={{ animation: "sp-bob1 2.9s ease-in-out infinite 0.7s", transformOrigin: "85px 47px" }} />
      {/* Front large diamond */}
      <MLBBDiamond cx={60} cy={36} hw={18} gradId="np-d2" opacity={1}
        style={{ animation: "sp-bob2 2.1s ease-in-out infinite", transformOrigin: "60px 36px" }} />
      {/* Sparkles — gold to match the category colour */}
      {[[16,16,1.8,0],[104,20,1.4,0.5],[112,58,1.6,1],[8,62,1.3,0.8],[60,7,1.5,1.4],[96,60,1.2,0.3]].map(([x,y,r,d],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fde68a" style={{ animation: `sp-twinkle ${1.6+Number(d)}s ease-in-out infinite ${d}s` }} />
      ))}
    </svg>
  );
}

function DoubleDiamondAnim() {
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="dd-d1" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="dd-d2" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#e0f9ff" />
          <stop offset="45%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <filter id="dd-blur"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      {/* Glow blobs */}
      <ellipse cx="36" cy="44" rx="18" ry="18" fill="#0ea5e9" fillOpacity="0.15" filter="url(#dd-blur)"
        style={{ animation: "dd-pulse1 2s ease-in-out infinite", transformOrigin: "36px 44px" }} />
      <ellipse cx="84" cy="44" rx="18" ry="18" fill="#00e5ff" fillOpacity="0.15" filter="url(#dd-blur)"
        style={{ animation: "dd-pulse2 2s ease-in-out infinite", transformOrigin: "84px 44px" }} />
      {/* Left MLBB diamond */}
      <MLBBDiamond cx={36} cy={40} hw={17} gradId="dd-d1" opacity={1}
        style={{ animation: "dd-pulse1 2s ease-in-out infinite", transformOrigin: "36px 40px" }} />
      {/* Right MLBB diamond */}
      <MLBBDiamond cx={84} cy={40} hw={17} gradId="dd-d2" opacity={1}
        style={{ animation: "dd-pulse2 2s ease-in-out infinite", transformOrigin: "84px 40px" }} />
      {/* ×2 label */}
      <text x="60" y="46" textAnchor="middle" fontSize="10" fontWeight="900" fill="#00e5ff" opacity="0.92"
        style={{ animation: "sp-twinkle 2s ease-in-out infinite" }}>×2</text>
      {/* Sparkles */}
      {[[12,12,1.5,0],[60,8,1.8,0.6],[108,14,1.4,0.3],[6,70,1.3,1],[114,68,1.6,0.9]].map(([x,y,r,d],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#a5f3fc" style={{ animation: `sp-twinkle ${1.7+Number(d)}s ease-in-out infinite ${d}s` }} />
      ))}
    </svg>
  );
}

function PassesAnim() {
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="pa-card" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" /><stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="pa-shine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.28)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <clipPath id="pa-clip"><rect x="18" y="22" width="84" height="42" rx="7" /></clipPath>
      </defs>
      {/* Card body */}
      <rect x="18" y="22" width="84" height="42" rx="7" fill="url(#pa-card)" />
      <rect x="18" y="22" width="84" height="42" rx="7" fill="none" stroke="#a78bfa" strokeWidth="1.2" strokeOpacity="0.6" />
      {/* Decorative dots on left */}
      <circle cx="30" cy="43" r="7" fill="rgba(255,255,255,0.08)" />
      <circle cx="30" cy="43" r="4" fill="rgba(255,255,255,0.12)" />
      {/* Dashed separator */}
      <line x1="44" y1="28" x2="44" y2="58" stroke="#a78bfa" strokeWidth="0.8" strokeDasharray="3 2" strokeOpacity="0.5" />
      {/* "WEEKLY PASS" text */}
      <text x="55" y="38" fontSize="6" fontWeight="700" fill="#c4b5fd" letterSpacing="1">WEEKLY</text>
      <text x="55" y="47" fontSize="8" fontWeight="900" fill="#fff">PASS</text>
      {/* Gold star */}
      <text x="93" y="40" fontSize="10" fill="#fbbf24" style={{ animation: "sp-twinkle 2s ease-in-out infinite" }}>★</text>
      {/* Shimmer sweep */}
      <rect x="18" y="22" width="84" height="42" rx="7" fill="url(#pa-shine)" clipPath="url(#pa-clip)"
        style={{ animation: "pa-shimmer 2.4s ease-in-out infinite", transformOrigin: "60px 43px" }} />
      {/* Orbiting stars */}
      {[0,1,2,3].map(i => (
        <circle key={i} r="2" fill="#fbbf24" opacity="0.85"
          style={{ animation: `pa-orbit 3s linear infinite ${i*0.75}s`, transformOrigin: "60px 43px" }} />
      ))}
      {/* Sparkles */}
      {[[10,10,1.4,0],[110,12,1.6,0.5],[12,72,1.3,1],[110,70,1.5,0.8]].map(([x,y,r,d],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#c4b5fd" style={{ animation: `sp-twinkle ${1.8+Number(d)}s ease-in-out infinite ${d}s` }} />
      ))}
    </svg>
  );
}

function StarlightAnim() {
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <radialGradient id="sl-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sl-star" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" /><stop offset="100%" stopColor="#fde68a" />
        </radialGradient>
      </defs>
      {/* Glow */}
      <ellipse cx="60" cy="40" rx="38" ry="38" fill="url(#sl-glow)" />
      {/* Outer rotating ring */}
      <circle cx="60" cy="40" r="30" fill="none" stroke="#fde68a" strokeWidth="0.7" strokeOpacity="0.35"
        strokeDasharray="5 3" style={{ animation: "np-ring 5s linear infinite", transformOrigin: "60px 40px" }} />
      {/* Inner counter-ring */}
      <circle cx="60" cy="40" r="22" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeOpacity="0.25"
        strokeDasharray="3 4" style={{ animation: "np-ring 4s linear infinite reverse", transformOrigin: "60px 40px" }} />
      {/* Orbiting stars */}
      {[0,1,2,3,4].map(i => (
        <g key={i} style={{ animation: `sl-orbit${i%2===0?'':'2'} ${3.2+i*0.3}s linear infinite ${i*0.6}s`, transformOrigin: "60px 40px" }}>
          <text x="60" y="14" textAnchor="middle" fontSize={i===0?8:6} fill="#fde68a" opacity="0.9">★</text>
        </g>
      ))}
      {/* Center star */}
      <g style={{ animation: "sl-pulse 2s ease-in-out infinite", transformOrigin: "60px 40px" }}>
        {/* 8-point star */}
        {[0,45,90,135].map(a => (
          <rect key={a} x="57.5" y="26" width="5" height="28" rx="2.5" fill="url(#sl-star)" opacity="0.95"
            style={{ transformOrigin: "60px 40px", transform: `rotate(${a}deg)` }} />
        ))}
        <circle cx="60" cy="40" r="5" fill="url(#sl-star)" />
        <circle cx="60" cy="40" r="3" fill="#fff" opacity="0.8" />
      </g>
      {/* Sparkles */}
      {[[8,8,1.6,0],[112,10,1.4,0.5],[10,72,1.5,1],[112,72,1.3,0.7],[60,72,1.2,1.2]].map(([x,y,r,d],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fde68a" style={{ animation: `sp-twinkle ${1.6+Number(d)}s ease-in-out infinite ${d}s` }} />
      ))}
    </svg>
  );
}

function RankBoostAnim() {
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="rb-shield" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
        <linearGradient id="rb-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="rb-glow"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      {/* Speed lines going up */}
      {[-20,-8,4,16,28].map((x,i) => (
        <line key={i} x1={60+x} y1="70" x2={60+x} y2={40+i*3}
          stroke="#ec4899" strokeWidth="1" strokeOpacity="0.18"
          style={{ animation: `rb-line 1.2s ease-in infinite ${i*0.18}s`, transformOrigin: `${60+x}px 55px` }} />
      ))}
      {/* Shield glow */}
      <ellipse cx="60" cy="38" rx="20" ry="20" fill="#ec4899" fillOpacity="0.12" filter="url(#rb-glow)"
        style={{ animation: "sl-pulse 2.2s ease-in-out infinite", transformOrigin: "60px 38px" }} />
      {/* Shield body */}
      <g style={{ animation: "sp-bob2 2.4s ease-in-out infinite", transformOrigin: "60px 40px" }}>
        <path d="M60 14 L78 22 L78 42 Q78 56 60 64 Q42 56 42 42 L42 22 Z" fill="url(#rb-shield)" />
        <path d="M60 14 L78 22 L78 42 Q78 56 60 64 Q42 56 42 42 L42 22 Z" fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeOpacity="0.6" />
        {/* M letter (mythic) */}
        <text x="60" y="43" textAnchor="middle" fontSize="14" fontWeight="900" fill="url(#rb-accent)" letterSpacing="-1">M</text>
        {/* Arrow up */}
        <path d="M60 26 L55 32 L57.5 32 L57.5 38 L62.5 38 L62.5 32 L65 32 Z" fill="#fbbf24" opacity="0.9" />
      </g>
      {/* Gold stars bottom */}
      {[-18,-6,6,18].map((dx,i) => (
        <text key={i} x={60+dx} y="74" textAnchor="middle" fontSize="8" fill="#fbbf24"
          style={{ animation: `sp-twinkle ${1.8+i*0.3}s ease-in-out infinite ${i*0.3}s`, opacity: 0.85 }}>★</text>
      ))}
      {/* Sparkles */}
      {[[10,10,1.5,0],[110,8,1.4,0.6],[8,65,1.3,1.1],[112,62,1.6,0.4]].map(([x,y,r,d],i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fda4af" style={{ animation: `sp-twinkle ${1.7+Number(d)}s ease-in-out infinite ${d}s` }} />
      ))}
    </svg>
  );
}

const PANEL_ANIMS: Record<CategoryId, React.ReactNode> = {
  small: <SmallPackAnim />,
  normal: <NormalPackAnim />,
  double: <DoubleDiamondAnim />,
  passes: <PassesAnim />,
  starlight: <StarlightAnim />,
  rank: <RankBoostAnim />,
};

const PANEL_IMAGES: Record<CategoryId, string> = {
  small:     "/cat-diamonds.png",
  normal:    "/cat-diamonds.png",
  double:    "/cat-double.png",
  passes:    "/cat-passes.png",
  starlight: "/cat-starlight.png",
  rank:      "/cat-rank.png",
};

// ── Image helpers ────────────────────────────────────────────────────────────
export interface PackImageTier { maxDiamonds: number; url: string; label: string; }
export type PackImagesCfg = PackImageTier[];
export type PassImagesCfg = Record<string, string>;

export const DEFAULT_PACK_IMAGES: PackImagesCfg = [
  { maxDiamonds: 20,     url: "/pack1.png", label: "1–20 Diamonds"     },
  { maxDiamonds: 50,     url: "/pack2.png", label: "21–50 Diamonds"    },
  { maxDiamonds: 100,    url: "/pack3.png", label: "51–100 Diamonds"   },
  { maxDiamonds: 500,    url: "/pack4.png", label: "101–500 Diamonds"  },
  { maxDiamonds: 1000,   url: "/pack5.png", label: "501–1000 Diamonds" },
  { maxDiamonds: 2000,   url: "/pack6.png", label: "1001–2000 Diamonds"},
  { maxDiamonds: 999999, url: "/pack7.png", label: "2001+ Diamonds"    },
];

export const DEFAULT_PASS_IMAGES: PassImagesCfg = {
  "Weekly Pass":         "/pass1.png",
  "Twilight Pass":       "/pass2.png",
  "Weekly Elite Bundle": "/pass3.png",
  "Monthly Epic Bundle": "/pass4.png",
};

export type StarlightImagesCfg = Record<string, string>;
export const DEFAULT_STARLIGHT_IMAGES: StarlightImagesCfg = {};

function getPackImage(diamonds: number, cfg: PackImagesCfg = DEFAULT_PACK_IMAGES): string {
  for (const tier of cfg) {
    if (diamonds <= tier.maxDiamonds) return tier.url;
  }
  return cfg[cfg.length - 1]?.url ?? "/pack7.png";
}

function getPassImage(name: string | null, cfg: PassImagesCfg = DEFAULT_PASS_IMAGES): string {
  return (name && cfg[name]) || cfg["Weekly Pass"] || "/pass1.png";
}

function getStarlightImage(name: string | null, _cfg?: StarlightImagesCfg): string {
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("premium")) return "/starlight-premium.png";
  return "/starlight-normal.png";
}

function CatPanelImage({ src, alt, dimmed }: { src: string; alt: string; dimmed: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading="eager"
      fetchPriority="high"
      onLoad={() => setLoaded(true)}
      style={{
        width: "100%", height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        display: "block",
        filter: dimmed ? "brightness(0.5) saturate(0.4)" : "brightness(1.05) saturate(1.1)",
        opacity: loaded ? 1 : 0,
        transition: loaded ? "opacity 0.25s ease" : "none",
      }}
    />
  );
}

function ImagePane({ src, onError }: { src: string; onError?: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{
      position: "relative", height: 112, overflow: "hidden", flexShrink: 0,
      background: "radial-gradient(ellipse at 50% 65%, #0c1a2e 0%, #080a10 100%)",
    }}>
      {/* Ambient glow layer */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        background: "radial-gradient(ellipse at 50% 70%, rgba(200,160,40,0.10) 0%, transparent 68%)",
        pointerEvents: "none",
      }} />
      <img
        src={src}
        alt=""
        loading="eager"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        onError={() => { onError?.(); }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%", height: "108%",
          objectFit: "cover",
          objectPosition: "center 45%",
          display: "block",
          transform: "translateZ(0)",
          filter: "drop-shadow(0 6px 18px rgba(56,189,248,0.22)) brightness(1.06) saturate(1.15)",
          zIndex: 1,
          opacity: loaded ? 1 : 0,
          transition: loaded ? "opacity 0.25s ease" : "none",
        }}
      />
      {/* Top vignette */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 22, zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(to bottom, rgba(8,10,16,0.7) 0%, transparent 100%)",
      }} />
      {/* Bottom fade into card body */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 42, zIndex: 2, pointerEvents: "none",
        background: "linear-gradient(to top, rgba(14,14,14,0.96) 0%, rgba(14,14,14,0.55) 55%, transparent 100%)",
      }} />
    </div>
  );
}

// ── Category card ───────────────────────────────────────────────────────────
function CategoryCard({ cat, onClick, index, isPopularNow, isExiting }: { cat: Category; onClick: () => void; index: number; isPopularNow?: boolean; isExiting?: boolean }) {
  const enterDelay = index * 0.04;
  const exitDelay  = index * 0.03;
  const anim = isExiting
    ? `catFadeOut 0.15s ease ${exitDelay}s both`
    : `catFadeIn 0.2s ease ${enterDelay}s both`;
  return (
    <div
      onClick={() => cat.available && onClick()}
      style={{
        background: "rgba(14,14,14,0.82)", borderRadius: 18,
        border: `1px solid ${cat.available ? cat.color + "45" : "rgba(255,255,255,0.07)"}`,
        overflow: "hidden", display: "flex", flexDirection: "column",
        cursor: cat.available ? "pointer" : "default",
        boxShadow: cat.available ? `0 0 20px ${cat.glow}` : "none",
        opacity: cat.available ? 1 : 0.55,
        backdropFilter: "blur(6px)",
        animation: anim,
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        position: "relative",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
      onMouseEnter={e => {
        if (!cat.available) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-3px) scale(1.02)";
        el.style.boxShadow = `0 8px 36px ${cat.glow}`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "";
        el.style.boxShadow = cat.available ? `0 0 20px ${cat.glow}` : "none";
      }}
    >
      {/* Popular Now badge from admin setting */}
      {isPopularNow && cat.available && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 3,
          background: "linear-gradient(135deg,#ef4444,#dc2626)",
          color: "#fff", fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
          padding: "3px 7px", borderRadius: 999, textTransform: "uppercase" }}>
          🔥 Popular Now
        </div>
      )}
      {cat.badge && cat.available && (
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 3,
          background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
          color: "#000", fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
          padding: "3px 7px", borderRadius: 999, textTransform: "uppercase" }}>
          {cat.badge}
        </div>
      )}
      {!cat.available && (
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 3,
          background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)",
          fontSize: 8, fontWeight: 700, padding: "3px 7px", borderRadius: 999,
          textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Soon
        </div>
      )}

      {/* Category image panel */}
      <div style={{ height: 90, overflow: "hidden", flexShrink: 0, position: "relative" }}>
        <CatPanelImage src={PANEL_IMAGES[cat.id]} alt={cat.title} dimmed={!cat.available} />
        {/* Bottom fade into card body */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 32, pointerEvents: "none",
          background: "linear-gradient(to top, rgba(14,14,14,0.95) 0%, transparent 100%)",
        }} />
      </div>

      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ color: cat.available ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
          {cat.title}
        </div>
        <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 11, lineHeight: 1.4 }}>
          {cat.subtitle}
        </div>
        {cat.available && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%",
              background: cat.color + "18", border: `1px solid ${cat.color}40`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M7 3l3 3-3 3" stroke={cat.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual pack card (small / normal / double) ──────────────────────────
function PackCard({ pack, isDouble, index, onSelect, isSelected, isExiting, packImagesCfg }: { pack: Package; isDouble?: boolean; index: number; onSelect?: (pkg: Package) => void; isSelected?: boolean; isExiting?: boolean; packImagesCfg?: PackImagesCfg }) {
  const hasBonus = pack.bonus_diamonds > 0;
  const base = pack.diamonds - pack.bonus_diamonds;
  const isUnavailable = pack.status === "out_of_stock" || pack.status === "coming_soon";
  const glowBg = pack.is_popular ? "rgba(245,158,11,0.55)" : isDouble ? "rgba(0,229,255,0.5)" : "rgba(56,189,248,0.38)";
  return (
    <div style={{ position: "relative" }}>
      {/* Backlight — blurred glow sits BEHIND the card */}
      <div style={{ position: "absolute", inset: "-3px", borderRadius: 22, background: glowBg, filter: "blur(12px)", animation: `packGlow 2.8s ease-in-out ${index * 0.13 + 0.5}s infinite`, zIndex: 0, pointerEvents: "none" }} />
      <div
      onClick={() => { if (!isUnavailable) onSelect?.(pack); }}
      style={{
        background: "rgba(14,14,14,0.88)", borderRadius: 18,
        backdropFilter: "blur(6px)",
        border: isSelected ? "2px solid rgba(245,158,11,0.85)" : pack.is_popular ? "1.5px solid rgba(245,158,11,0.5)" : isDouble ? "1.5px solid rgba(0,229,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: isSelected ? "0 0 0 3px rgba(245,158,11,0.2), 0 8px 28px rgba(0,0,0,0.7)" : "0 2px 14px rgba(0,0,0,0.6)",
        position: "relative", zIndex: 1, cursor: isUnavailable ? "default" : "pointer",
        opacity: isUnavailable ? 0.65 : 1,
        animation: isExiting
          ? `catFadeOut 0.15s ease ${index * 0.03}s both`
          : `catFadeIn 0.2s ease ${index * 0.03}s both`,
        transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={e => {
        if (isUnavailable) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-3px) scale(1.02)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "";
      }}
    >

      {pack.status === "out_of_stock" && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5, background: "rgba(239,68,68,0.92)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 999 }}>Out of Stock</div>
      )}
      {pack.status === "coming_soon" && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5, background: "rgba(99,102,241,0.92)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 999 }}>Coming Soon</div>
      )}
      {isDouble && (
        <div style={{ position: "absolute", top: 10, left: pack.status && pack.status !== "available" ? undefined : 10, right: pack.status && pack.status !== "available" ? 10 : undefined, zIndex: 3, background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 999 }}>2×</div>
      )}
      {pack.is_popular && (
        <div style={{ position: "absolute", top: 0, right: 0, zIndex: 3, background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#000", fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", padding: "6px 12px 5px 8px", borderRadius: "0 18px 0 14px", textTransform: "uppercase", boxShadow: "0 2px 8px rgba(245,158,11,0.45)" }}>⭐ Best Value</div>
      )}
      <ImagePane src={getPackImage(pack.diamonds, packImagesCfg)} />
      <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <img src="/diamond.png" alt="♦" style={{ width: 17, height: 17, objectFit: "contain", flexShrink: 0 }} />
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{pack.diamonds.toLocaleString()}</span>
          <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 10 }}>Diamonds</span>
        </div>
        {hasBonus ? (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>{base.toLocaleString()}</span>
            {" + "}
            <span style={{ color: isDouble ? "#00e5ff" : "#4ade80", fontWeight: 700 }}>{pack.bonus_diamonds} bonus</span>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>No bonus</div>
        )}
        <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 16, marginTop: 3 }}>₹{Number(pack.price).toLocaleString("en-IN")}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 1 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 999, padding: "2px 6px", fontSize: 9, color: "#4ade80", fontWeight: 700 }}>⚡ Instant</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.22)", borderRadius: 999, padding: "2px 6px", fontSize: 9, color: "#7dd3fc", fontWeight: 700 }}>✓ Secure</span>
        </div>
        {isUnavailable && (
          <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
            {pack.status === "out_of_stock" ? "Unavailable" : "Coming Soon"}
          </div>
        )}
        {isSelected && !isUnavailable && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 10 }}>Selected</span>
          </div>
        )}
        {!isSelected && !isUnavailable && (
          <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>Tap to select</div>
        )}
      </div>
      </div>
    </div>
  );
}

const WHATSAPP_NUMBER = "919362003788";

function buildWhatsAppUrl(pack: Package, mlbbAccount: { mlbb_user_id: string; mlbb_server_id: string; mlbb_ign: string } | null, userName: string | null, staffWA?: string): string {
  const lines = [
    "Hi Sky Official! 👋",
    "",
    "I'd like to order a Starlight Card:",
    "",
    `🌟 Card: ${pack.name || "Starlight Card"}`,
    `💰 Price: ₹${Number(pack.price).toLocaleString("en-IN")}`,
    mlbbAccount ? `🎮 MLBB ID: ${mlbbAccount.mlbb_user_id} (Server: ${mlbbAccount.mlbb_server_id})` : "🎮 MLBB ID: (not set)",
    mlbbAccount ? `👤 IGN: ${mlbbAccount.mlbb_ign}` : "👤 IGN: (not set)",
    userName ? `🏪 Store Account: ${userName}` : null,
    "",
    "Please help me with the gifting process. Thank you! 🙏",
  ];
  const message = lines.filter(l => l !== null).join("\n");
  return `https://wa.me/${staffWA || WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// ── Starlight card ──────────────────────────────────────────────────────────
function StarlightCard({ pack, index, isExiting, starlightImagesCfg, mlbbAccount, userName, staffWA }: { pack: Package; index: number; isExiting?: boolean; starlightImagesCfg?: StarlightImagesCfg; mlbbAccount: { mlbb_user_id: string; mlbb_server_id: string; mlbb_ign: string } | null; userName: string | null; staffWA?: string }) {
  const isUnavailable = pack.status === "out_of_stock" || pack.status === "coming_soon";
  const imgSrc = getStarlightImage(pack.name, starlightImagesCfg);

  function handleWhatsApp(e: React.MouseEvent) {
    e.stopPropagation();
    if (isUnavailable) return;
    window.open(buildWhatsAppUrl(pack, mlbbAccount, userName, staffWA), "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: "-3px", borderRadius: 22, background: "rgba(245,200,66,0.45)", filter: "blur(12px)", animation: `packGlow 2.8s ease-in-out ${index * 0.13 + 0.5}s infinite`, zIndex: 0, pointerEvents: "none" }} />
      <div
        style={{
          background: "rgba(14,14,14,0.88)", borderRadius: 18,
          backdropFilter: "blur(6px)",
          border: "1.5px solid rgba(245,200,66,0.35)",
          overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 2px 14px rgba(0,0,0,0.6)",
          position: "relative", zIndex: 1, cursor: isUnavailable ? "default" : "pointer",
          opacity: isUnavailable ? 0.65 : 1,
          animation: isExiting
            ? `catFadeOut 0.15s ease ${index * 0.03}s both`
            : `catFadeIn 0.2s ease ${index * 0.03}s both`,
          transition: "transform 0.18s ease",
          touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
        }}
        onMouseEnter={e => { if (!isUnavailable) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px) scale(1.02)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; }}
      >
        {pack.status === "out_of_stock" && (
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5, background: "rgba(239,68,68,0.92)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 999 }}>Out of Stock</div>
        )}
        {pack.status === "coming_soon" && (
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5, background: "rgba(99,102,241,0.92)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 999 }}>Coming Soon</div>
        )}
        <ImagePane src={imgSrc} />
        <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 13, lineHeight: 1.3, minHeight: "2.6em", display: "flex", alignItems: "flex-start" }}>{pack.name || "Starlight Card"}</div>
          <div style={{ color: "#f5c842", fontWeight: 800, fontSize: 16, marginTop: 4 }}>₹{Number(pack.price).toLocaleString("en-IN")}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            {isUnavailable ? (
              <div style={{ flex: 1, textAlign: "center", padding: "6px 0", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                {pack.status === "out_of_stock" ? "Unavailable" : "Coming Soon"}
              </div>
            ) : (
              <button
                onClick={handleWhatsApp}
                style={{ flex: 1, background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "7px 0", borderRadius: 8, cursor: "pointer", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.523 5.847L0 24l6.335-1.498A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.005-1.371l-.36-.214-3.727.881.936-3.618-.235-.372A9.818 9.818 0 1112 21.818z"/></svg>
                Order Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pass card (Passes & Bundles) ────────────────────────────────────────────
function PassCard({ pack, index, onSelect, isSelected, isExiting, passImagesCfg }: { pack: Package; index: number; onSelect?: (pkg: Package) => void; isSelected?: boolean; isExiting?: boolean; passImagesCfg?: PassImagesCfg }) {
  const isUnavailable = pack.status === "out_of_stock" || pack.status === "coming_soon";

  return (
    <div style={{ position: "relative" }}>
      {/* Backlight — blurred glow sits BEHIND the card */}
      <div style={{ position: "absolute", inset: "-3px", borderRadius: 22, background: "rgba(168,85,247,0.5)", filter: "blur(12px)", animation: `packGlow 2.8s ease-in-out ${index * 0.13 + 0.5}s infinite`, zIndex: 0, pointerEvents: "none" }} />
      <div
      onClick={() => { if (!isUnavailable) onSelect?.(pack); }}
      style={{
        background: "rgba(14,14,14,0.88)", borderRadius: 18,
        backdropFilter: "blur(6px)",
        border: isSelected ? "2px solid rgba(245,158,11,0.85)" : "1.5px solid rgba(168,85,247,0.3)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: isSelected ? "0 0 0 3px rgba(245,158,11,0.2), 0 8px 28px rgba(0,0,0,0.7)" : "0 2px 14px rgba(0,0,0,0.6)",
        position: "relative", zIndex: 1, cursor: isUnavailable ? "default" : "pointer",
        opacity: isUnavailable ? 0.65 : 1,
        animation: isExiting
          ? `catFadeOut 0.15s ease ${index * 0.03}s both`
          : `catFadeIn 0.2s ease ${index * 0.03}s both`,
        transition: "transform 0.18s ease",
      }}
      onMouseEnter={e => {
        if (isUnavailable) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-3px) scale(1.02)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "";
      }}
    >

      {pack.status === "out_of_stock" && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5, background: "rgba(239,68,68,0.92)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 999 }}>Out of Stock</div>
      )}
      {pack.status === "coming_soon" && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 5, background: "rgba(99,102,241,0.92)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 999 }}>Coming Soon</div>
      )}
      <ImagePane src={getPassImage(pack.name, passImagesCfg)} />
      <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 13, lineHeight: 1.3, minHeight: "2.6em", display: "flex", alignItems: "flex-start" }}>{pack.name}</div>
        <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 16, marginTop: 4 }}>₹{Number(pack.price).toLocaleString("en-IN")}</div>
        {isUnavailable && (
          <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
            {pack.status === "out_of_stock" ? "Unavailable" : "Coming Soon"}
          </div>
        )}
        {isSelected && !isUnavailable && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 10 }}>Selected</span>
          </div>
        )}
        {!isSelected && !isUnavailable && (
          <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>Tap to select</div>
        )}
      </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#111", borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{ height: 100, background: "rgba(255,255,255,0.04)" }} />
      <div style={{ padding: "11px 13px 13px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 15, width: "60%", background: "rgba(255,255,255,0.07)", borderRadius: 6 }} />
        <div style={{ height: 10, width: "45%", background: "rgba(255,255,255,0.05)", borderRadius: 6 }} />
        <div style={{ height: 20, width: "40%", background: "rgba(255,255,255,0.07)", borderRadius: 6 }} />
      </div>
    </div>
  );
}

function filterByCategory(packages: Package[], id: CategoryId): Package[] {
  const sort = (arr: Package[]) => [...arr].sort((a, b) => a.sort_order - b.sort_order || a.diamonds - b.diamonds);
  if (id === "small")  return sort(packages.filter(p => (p.category ?? (p.diamonds <= 49 ? "small" : "normal")) === "small"));
  if (id === "normal") return sort(packages.filter(p => (p.category ?? (p.diamonds <= 49 ? "small" : "normal")) === "normal"));
  if (id === "double")    return sort(packages.filter(p => p.category === "double"));
  if (id === "passes")    return sort(packages.filter(p => p.category === "passes"));
  if (id === "starlight") return sort(packages.filter(p => p.category === "starlight"));
  if (id === "rank")      return sort(packages.filter(p => p.category === "rank"));
  return [];
}

// ── Main section ────────────────────────────────────────────────────────────
export default function PackagesSection({ onPackageSelect: _p, onBack, onBuy, onAddToCart, isExiting }: { onPackageSelect: (id: string) => void; onBack?: () => void; onBuy?: (pkg: Package) => void; onAddToCart?: (pkg: Package) => void; isExiting?: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [categoryPopular, setCategoryPopular] = useState<Record<string, boolean>>({});
  const [categoryAvailability, setCategoryAvailability] = useState<Record<string, string>>({});
  const [packImagesCfg, setPackImagesCfg] = useState<PackImagesCfg>(DEFAULT_PACK_IMAGES);
  const [passImagesCfg, setPassImagesCfg] = useState<PassImagesCfg>(DEFAULT_PASS_IMAGES);
  const [starlightImagesCfg, setStarlightImagesCfg] = useState<StarlightImagesCfg>(DEFAULT_STARLIGHT_IMAGES);
  const [mlbbAccount, setMlbbAccount] = useState<{ mlbb_user_id: string; mlbb_server_id: string; mlbb_ign: string } | null>(null);
  const activeCategoryRef = useRef<Category | null>(null);
  const [selectedPack, setSelectedPack] = useState<Package | null>(null);
  const [qty, setQty] = useState(1);
  const [payMethod, setPayMethod] = useState<"upi" | "wallet">("upi");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);
  const [walletPayResult, setWalletPayResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showMlbbModal, setShowMlbbModal] = useState(false);
  const [walletMlbb, setWalletMlbb] = useState({ uid: "", sid: "2900", ign: "" });
  const [staffWA, setStaffWA] = useState("");
  const purchaseRef = useRef<HTMLDivElement>(null);

  const userName = user ? (user.fullName || user.username || user.primaryEmailAddress?.emailAddress || null) : null;

  useEffect(() => { activeCategoryRef.current = activeCategory; }, [activeCategory]);

  useEffect(() => {
    const cat = sessionStorage.getItem("pendingOpenCategory") as CategoryId | null;
    if (cat) {
      sessionStorage.removeItem("pendingOpenCategory");
      const found = CATEGORIES.find(c => c.id === cat);
      if (found) setActiveCategory(found);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setWalletBalance(null); return; }
    getToken().then(token => {
      if (!token) return;
      fetch(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
        .then(r => r.json())
        .then(d => setWalletBalance(Number(d.balance ?? 0)))
        .catch(() => {});
    });
  }, [isSignedIn]);

  useEffect(() => {
    if (selectedPack && purchaseRef.current) {
      setTimeout(() => purchaseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    }
  }, [selectedPack?.id]);

  useEffect(() => {
    setSelectedPack(null);
    setQty(1);
    setWalletPayResult(null);
  }, [activeCategory?.id]);

  useEffect(() => {
    if (!isSignedIn) { setMlbbAccount(null); return; }
    getToken().then(token => {
      if (!token) return;
      fetch(`${API}/verify/mlbb`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
        .then(r => r.json())
        .then(data => { if (data.ok && data.account) setMlbbAccount(data.account); })
        .catch(() => {});
    });
  }, [isSignedIn]);

  useEffect(() => {
    fetch(`${API}/packages`)
      .then(r => r.json())
      .then(data => { setPackages(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`${API}/settings/category_popular`)
      .then(r => r.json())
      .then(data => setCategoryPopular(data || {}))
      .catch(() => {});
    fetch(`${API}/settings/category_availability`)
      .then(r => r.json())
      .then(data => { if (data && typeof data === "object") setCategoryAvailability(data); })
      .catch(() => {});
    fetch(`${API}/settings/pack_images`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setPackImagesCfg(data); })
      .catch(() => {});
    fetch(`${API}/settings/pass_images`)
      .then(r => r.json())
      .then(data => { if (data && typeof data === "object" && !Array.isArray(data)) setPassImagesCfg(data); })
      .catch(() => {});
    fetch(`${API}/settings/starlight_images`)
      .then(r => r.json())
      .then(data => { if (data && typeof data === "object" && !Array.isArray(data)) setStarlightImagesCfg(data); })
      .catch(() => {});
    fetch(`${API}/settings/qr`)
      .then(r => r.json())
      .then(d => { if (d.whatsapp) setStaffWA(d.whatsapp); })
      .catch(() => {});
  }, []);

  const categories = CATEGORIES.map(cat => {
    const override = categoryAvailability[cat.id];
    if (!override) return cat;
    return { ...cat, available: override !== "out_of_stock" };
  });

  // Push browser history state when category is selected so device back button works
  const selectCategory = (cat: Category) => {
    window.history.pushState({ sky_cat: cat.id }, "");
    setActiveCategory(cat);
  };

  useEffect(() => {
    const handler = () => {
      if (activeCategoryRef.current) {
        setActiveCategory(null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const handleBackBtn = () => {
    if (activeCategory) {
      window.history.back();
    } else {
      onBack?.();
    }
  };

  const executeWalletPay = async (mlbbUid: string | null, mlbbSid: string | null, mlbbIgn: string | null) => {
    if (!selectedPack) return;
    setBuyLoading(true);
    try {
      const token = await getToken();
      const displayIds: string[] = [];
      let failed = false;
      for (let i = 0; i < qty; i++) {
        const r = await fetch(`${API}/orders/wallet-pay`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: selectedPack.id,
            ...(mlbbUid ? { mlbbUserId: mlbbUid, mlbbServerId: mlbbSid, mlbbIgn } : {}),
          }),
        });
        const d = await r.json();
        if (!d.ok) {
          setWalletPayResult({ ok: false, msg: d.error || "Payment failed. Please try again." });
          failed = true;
          break;
        }
        displayIds.push(d.displayId);
      }
      if (!failed) {
        setWalletPayResult({ ok: true, msg: `Order${qty > 1 ? "s" : ""} placed! (${displayIds.join(", ")}) Diamonds will be credited shortly.` });
        const bal = await fetch(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({}));
        if (bal.balance !== undefined) setWalletBalance(Number(bal.balance));
      }
    } catch {
      setWalletPayResult({ ok: false, msg: "Network error. Please try again." });
    } finally {
      setBuyLoading(false);
      setShowMlbbModal(false);
    }
  };

  const handleBuyNow = async () => {
    if (!selectedPack) return;

    if (payMethod === "wallet") {
      const totalPrice = Number(selectedPack.price) * qty;
      if (walletBalance === null || walletBalance < totalPrice) {
        setWalletPayResult({ ok: false, msg: `Insufficient wallet balance. You have ₹${(walletBalance ?? 0).toFixed(0)}, need ₹${totalPrice.toFixed(0)}.` });
        return;
      }
      if (!mlbbAccount) {
        setWalletMlbb({ uid: "", sid: "2900", ign: "" });
        setShowMlbbModal(true);
        return;
      }
      await executeWalletPay(null, null, null);
      return;
    }

    setBuyLoading(true);
    await new Promise(res => setTimeout(res, 650));
    setBuyLoading(false);
    if (qty > 1) {
      for (let i = 0; i < qty; i++) onAddToCart?.(selectedPack);
      onBuy?.({ ...selectedPack, id: 0 });
    } else {
      onBuy?.(selectedPack);
    }
  };

  const activePacks = activeCategory ? filterByCategory(packages, activeCategory.id) : [];

  return (
    <section style={{ position: "relative", background: activeCategory ? "#0a0a0a" : "transparent", minHeight: "100vh", paddingBottom: 48, overflow: "hidden" }}>
      {activeCategory && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#0a0a0a", zIndex: 0, pointerEvents: "none" }} />}
      <style>{`
        @keyframes pkg-diagIn   { from{opacity:0;transform:translate(-20px,-20px)} to{opacity:1;transform:translate(0,0)} }
        @keyframes pkgSlideLeft { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:translateX(0)} }
        @keyframes catFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes catFadeOut { from{opacity:1} to{opacity:0} }
        @keyframes packGlow     { 0%,100%{opacity:0.3;transform:scale(0.96)} 50%{opacity:1;transform:scale(1.04)} }
        @keyframes sp-bob1     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes sp-bob2     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes sp-bob3     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes sp-twinkle  { 0%,100%{opacity:0.15;transform:scale(0.7)} 50%{opacity:1;transform:scale(1.3)} }
        @keyframes np-ring     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dd-pulse1   { 0%,100%{opacity:0.7;transform:scale(0.96)} 50%{opacity:1;transform:scale(1.04)} }
        @keyframes dd-pulse2   { 0%,100%{opacity:1;transform:scale(1.04)} 50%{opacity:0.7;transform:scale(0.96)} }
        @keyframes pa-shimmer  { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes pa-orbit    {
          0%   {transform:rotate(0deg)   translateY(-36px) rotate(0deg)}
          100% {transform:rotate(360deg) translateY(-36px) rotate(-360deg)}
        }
        @keyframes sl-orbit    {
          0%   {transform:rotate(0deg)   translateY(-30px) rotate(0deg)}
          100% {transform:rotate(360deg) translateY(-30px) rotate(-360deg)}
        }
        @keyframes sl-orbit2   {
          0%   {transform:rotate(180deg) translateY(-22px) rotate(-180deg)}
          100% {transform:rotate(540deg) translateY(-22px) rotate(-540deg)}
        }
        .pkg-pack-grid { transform: translateZ(0); backface-visibility: hidden; }
        .pkg-pack-grid > * { contain: layout paint; }
        @keyframes sl-pulse    { 0%,100%{transform:scale(0.93);opacity:0.85} 50%{transform:scale(1.07);opacity:1} }
        @keyframes rb-line     { 0%{opacity:0;transform:scaleY(0)} 40%{opacity:1} 100%{opacity:0;transform:scaleY(1) translateY(-30px)} }
        @keyframes pkgPageIn   { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "min(560px, calc(100dvh * 9 / 16))", margin: "0 auto", padding: "0 16px" }}>
        {/* Header */}
        {(() => {
          const exitHeader = isExiting && !activeCategory;
          const hdrAnim = (delay: number) =>
            exitHeader
              ? `catFadeOut 0.15s ease ${delay}s both`
              : `catFadeIn 0.22s ease ${delay}s both`;
          return (
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ display: "inline-block", padding: "5px 16px", borderRadius: 999,
                background: "rgba(245,200,40,0.1)", border: "1px solid rgba(245,200,40,0.3)",
                color: "#f5c842", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
                textTransform: "uppercase", marginBottom: 12,
                animation: hdrAnim(0) }}>
                Our Packages
              </div>
              <h2 style={{ color: "#fff", fontSize: "clamp(1.6rem,6vw,2.2rem)", fontWeight: 800, lineHeight: 1.2, margin: 0, animation: hdrAnim(exitHeader ? 0.02 : 0.05) }}>
                {activeCategory ? activeCategory.title : "Choose Your Pack"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 8, animation: hdrAnim(exitHeader ? 0.04 : 0.09) }}>
                {activeCategory ? "Tap a pack to purchase" : "Tap a category to view available packs"}
              </p>
            </div>
          );
        })()}

        {/* Single back button — context-aware */}
        <button
          onClick={handleBackBtn}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 999, padding: "7px 16px 7px 12px",
            color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", marginBottom: 20,
            animation: isExiting && !activeCategory
              ? `catFadeOut 0.15s ease 0.04s both`
              : `catFadeIn 0.22s ease 0.07s both`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {activeCategory ? "All Categories" : "Home"}
        </button>

        {/* Category grid */}
        {!activeCategory && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {categories.map((cat, i) => (
              <CategoryCard key={cat.id} cat={cat} index={i} onClick={() => selectCategory(cat)} isPopularNow={!!categoryPopular[cat.id]} isExiting={isExiting && !activeCategory} />
            ))}
          </div>
        )}

        {/* Rank Boost page — full custom form */}
        {activeCategory?.id === "rank" && (
          <RankBoostPage onBack={() => window.history.back()} />
        )}

        {/* Starlight info banner */}
        {activeCategory?.id === "starlight" && (
          <div style={{
            background: "linear-gradient(135deg, rgba(245,200,66,0.08) 0%, rgba(245,158,11,0.05) 100%)",
            border: "1px solid rgba(245,200,66,0.25)",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 18,
            animation: "catFadeIn 0.38s ease 0.1s both",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.3 }}>🎁</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ color: "#f5c842", fontWeight: 800, fontSize: 13 }}>How Starlight Card Orders Work</div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11.5, lineHeight: 1.7 }}>
                  Starlight Cards are gifted directly inside MLBB — this requires a <span style={{ color: "#f5c842", fontWeight: 700 }}>7-day in-game friendship</span> with us before the gift can be sent.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                  {[
                    { step: "1", text: "Tap 'Order Now' on any card" },
                    { step: "2", text: "Send us your MLBB ID & IGN to add as friend" },
                    { step: "3", text: "After 7 days of friendship, we send your gift!" },
                  ].map(({ step, text }) => (
                    <div key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(245,200,66,0.18)", border: "1px solid rgba(245,200,66,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ color: "#f5c842", fontSize: 9, fontWeight: 800 }}>{step}</span>
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pack list — individual stagger slide-in from right */}
        {activeCategory && activeCategory.id !== "rank" && (
          <div key={activeCategory.id}>
            {loading && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}
            {!loading && activePacks.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", padding: "40px 0", fontSize: 14 }}>
                No packs in this category yet.
              </div>
            )}
            {!loading && activePacks.length > 0 && (
              <div className="pkg-pack-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {activePacks.map((pack, i) =>
                  activeCategory?.id === "passes"
                    ? <PassCard key={pack.id} pack={pack} index={i} onSelect={p => { setSelectedPack(p); setQty(1); }} isSelected={selectedPack?.id === pack.id} isExiting={isExiting} passImagesCfg={passImagesCfg} />
                    : activeCategory?.id === "starlight"
                    ? <StarlightCard key={pack.id} pack={pack} index={i} isExiting={isExiting} starlightImagesCfg={starlightImagesCfg} mlbbAccount={mlbbAccount} userName={userName} staffWA={staffWA} />
                    : <PackCard key={pack.id} pack={pack} index={i} isDouble={activeCategory?.id === "double"} onSelect={p => { setSelectedPack(p); setQty(1); }} isSelected={selectedPack?.id === pack.id} isExiting={isExiting} packImagesCfg={packImagesCfg} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Purchase options panel ─────────────────────────────────── */}
        {selectedPack && !["starlight", "rank"].includes(activeCategory?.id ?? "") && (
          <div ref={purchaseRef} style={{
            background: "rgba(14,14,14,0.97)", border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 20, padding: "20px 16px", marginTop: 20,
            boxShadow: "0 -4px 40px rgba(245,158,11,0.12), 0 8px 30px rgba(0,0,0,0.5)",
            animation: "catFadeIn 0.2s ease both",
          }}>
            {/* Pack summary */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Your Order</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <img src="/diamond.png" alt="♦" style={{ width: 15, height: 15, objectFit: "contain" }} />
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{selectedPack.diamonds.toLocaleString()} Diamonds</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 20 }}>₹{(Number(selectedPack.price) * qty).toLocaleString("en-IN")}</div>
                {qty > 1 && <div style={{ color: "rgba(255,255,255,0.32)", fontSize: 10 }}>₹{Number(selectedPack.price).toLocaleString("en-IN")} × {qty}</div>}
              </div>
            </div>

            {/* Quantity */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600 }}>Quantity</span>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 30, height: 30, borderRadius: "50%", background: qty === 1 ? "rgba(255,255,255,0.04)" : "rgba(245,158,11,0.15)", border: qty === 1 ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(245,158,11,0.4)", color: qty === 1 ? "rgba(255,255,255,0.2)" : "#f59e0b", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: qty === 1 ? "default" : "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>−</button>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, minWidth: 24, textAlign: "center" }}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>+</button>
              </div>
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Payment Method</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPayMethod("upi")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 11, background: payMethod === "upi" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", border: payMethod === "upi" ? "1.5px solid rgba(245,158,11,0.7)" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.15s", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke={payMethod === "upi" ? "#f59e0b" : "rgba(255,255,255,0.4)"} strokeWidth="2"/><path d="M2 10h20" stroke={payMethod === "upi" ? "#f59e0b" : "rgba(255,255,255,0.4)"} strokeWidth="2"/></svg>
                  <span style={{ color: payMethod === "upi" ? "#f59e0b" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700 }}>Pay via UPI</span>
                </button>
                {walletBalance !== null && (
                  <button onClick={() => setPayMethod("wallet")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 11, background: payMethod === "wallet" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", border: payMethod === "wallet" ? "1.5px solid rgba(245,158,11,0.7)" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.15s", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
                    <img src="/scoin.png" alt="S" style={{ width: 14, height: 14, objectFit: "contain" }} />
                    <span style={{ color: payMethod === "wallet" ? "#f59e0b" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700 }}>Wallet · ₹{walletBalance.toFixed(0)}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Wallet pay result */}
            {walletPayResult && (
              <div style={{
                marginBottom: 10,
                background: walletPayResult.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${walletPayResult.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                borderRadius: 10, padding: "10px 14px",
                color: walletPayResult.ok ? "#22c55e" : "#ef4444", fontSize: 13,
              }}>
                {walletPayResult.msg}
              </div>
            )}
            {/* Buy Now */}
            <button onClick={handleBuyNow} disabled={buyLoading} style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: buyLoading ? "rgba(245,158,11,0.45)" : "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#000", fontWeight: 800, fontSize: 15, border: "none", cursor: buyLoading ? "default" : "pointer", boxShadow: buyLoading ? "none" : "0 0 24px rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
              {buyLoading
                ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#000" strokeWidth="2" strokeDasharray="56" strokeDashoffset="14"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>Preparing order…</>
                : "Buy Now →"}
            </button>
          </div>
        )}
      </div>

      {/* ── MLBB ID Modal (wallet pay, no saved account) ── */}
      {showMlbbModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#111117", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/diamond.png" alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Enter Your MLBB ID</div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12.5, lineHeight: 1.55 }}>
              No saved MLBB account found. Please enter your Player ID and Server ID to proceed with wallet payment.
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Player ID</div>
              <input
                value={walletMlbb.uid}
                onChange={e => setWalletMlbb(p => ({ ...p, uid: e.target.value }))}
                placeholder="e.g. 123456789"
                inputMode="numeric"
                style={{ width: "100%", background: "#0d0d11", border: "1px solid rgba(245,158,11,0.22)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "11px 14px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Server ID</div>
              <input
                value={walletMlbb.sid}
                onChange={e => setWalletMlbb(p => ({ ...p, sid: e.target.value }))}
                placeholder="e.g. 2900"
                inputMode="numeric"
                style={{ width: "100%", background: "#0d0d11", border: "1px solid rgba(245,158,11,0.22)", borderRadius: 10, color: "#fff", fontSize: 15, padding: "11px 14px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setShowMlbbModal(false)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                disabled={!walletMlbb.uid.trim() || !walletMlbb.sid.trim() || buyLoading}
                onClick={() => executeWalletPay(walletMlbb.uid.trim(), walletMlbb.sid.trim(), walletMlbb.ign.trim() || null)}
                style={{ flex: 2, padding: "12px 0", borderRadius: 12, background: (!walletMlbb.uid.trim() || !walletMlbb.sid.trim()) ? "rgba(245,158,11,0.3)" : "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#000", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {buyLoading ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#000" strokeWidth="2" strokeDasharray="56" strokeDashoffset="14"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>Processing…</> : "Confirm & Pay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
