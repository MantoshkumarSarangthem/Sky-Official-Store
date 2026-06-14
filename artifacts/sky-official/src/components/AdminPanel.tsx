import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

// ── Biometric (WebAuthn) helpers ──────────────────────────────────────────
const ADMIN_BIO_CRED = "admin_bio_cred_id";
const ADMIN_BIO_TOKEN = "admin_bio_token";

async function adminBioAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

async function adminBioRegister(token: string): Promise<boolean> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge, rp: { name: "Sky Official Admin", id: window.location.hostname },
      user: { id: userId, name: "admin", displayName: "Admin" },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    }
  }) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(ADMIN_BIO_CRED, btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
  localStorage.setItem(ADMIN_BIO_TOKEN, token);
  return true;
}

async function adminBioAuthenticate(): Promise<string | null> {
  const b64 = localStorage.getItem(ADMIN_BIO_CRED);
  if (!b64) return null;
  const credId = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credId, type: "public-key" }],
      userVerification: "required", timeout: 60000,
    }
  });
  return assertion ? localStorage.getItem(ADMIN_BIO_TOKEN) : null;
}

interface OfferBanner { id: string; title: string; subtitle?: string; emoji?: string; bgGradient?: string; ctaText?: string; ctaLink?: string; }

interface Package {
  id: number;
  name: string | null;
  diamonds: number;
  bonus_diamonds: number;
  price: string;
  old_price?: string | null;
  label: string | null;
  is_popular: boolean;
  sort_order: number;
  category: string | null;
  status?: string;
  game_id?: number | null;
  image?: string | null;
}

interface Order {
  id: number;
  package_id: number | null;
  diamonds: number;
  price: string;
  mlbb_id: string | null;
  mlbb_server_id: string | null;
  status: string;
  note: string | null;
  created_at: string;
  pack_image?: string | null;
}

interface Stats {
  total_orders: string;
  total_revenue: string;
  total_diamonds: string;
}

interface WalletRequest {
  id: number;
  clerk_user_id: string;
  display_name: string | null;
  amount: string;
  type: string;
  status: string;
  upi_ref: string | null;
  description: string | null;
  created_at: string;
}

type Tab = "games" | "packages" | "orders" | "wallet" | "staff" | "settings" | "banners" | "offer-banners" | "stats";
type NotifState = "unknown" | "loading" | "subscribed" | "denied" | "unsupported";

async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function AdminPanel({ onClose, fullPage = false }: { onClose: () => void; fullPage?: boolean }) {
  const [, setLocation] = useLocation();
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem("admin_token"));
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [bioAvail, setBioAvail] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(() => !!localStorage.getItem(ADMIN_BIO_CRED));
  const [bioLoading, setBioLoading] = useState(false);
  const [bioMsg, setBioMsg] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showPwForm, setShowPwForm] = useState(() => !localStorage.getItem(ADMIN_BIO_CRED));
  const [tab, setTab] = useState<Tab>(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    const valid: Tab[] = ["games","packages","orders","wallet","staff","settings","banners","offer-banners","stats"];
    return (valid.includes(p as Tab) ? p : "packages") as Tab;
  });
  const [packages, setPackages] = useState<Package[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  function copyWithFeedback(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  }
  const [stats, setStats] = useState<Stats | null>(null);
  const [storeStats, setStoreStats] = useState<{ total_orders: number; total_diamonds: number; total_users: number } | null>(null);
  const [recentOrders, setRecentOrders] = useState<{ mlbb_ign: string | null; diamonds: number; created_at: string; pack_name: string | null; currency_label: string | null; user_display_name: string | null }[]>([]);
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);
  const [newPkg, setNewPkg] = useState({ name: "", diamonds: "", bonus_diamonds: "", price: "", label: "", is_popular: false, category: "small", status: "available" });
  const [loading, setLoading] = useState(false);
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [newPkgStep, setNewPkgStep] = useState<"game" | "form">("game");
  const [newPkgGameId, setNewPkgGameId] = useState<number | null>(null);
  const [newPkgCurrencyType, setNewPkgCurrencyType] = useState("");
  const [newOrder, setNewOrder] = useState({ diamonds: "", price: "", mlbb_id: "", status: "completed", note: "" });
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [walletRequests, setWalletRequests] = useState<WalletRequest[]>([]);
  const [walletLoading, setWalletLoading] = useState<number | null>(null);
  const [categoryPopular, setCategoryPopular] = useState<Record<string, boolean>>({});
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [qrCurrent, setQrCurrent] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrSaving, setQrSaving] = useState(false);
  const [qrSaved, setQrSaved] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [adminUpiId, setAdminUpiId] = useState("");
  const [adminUpiSaving, setAdminUpiSaving] = useState(false);
  const [adminUpiSaved, setAdminUpiSaved] = useState(false);
  const [adminAvailable, setAdminAvailable] = useState(false);
  const [adminAvailSaving, setAdminAvailSaving] = useState(false);
  const [trustpilotUrl, setTrustpilotUrl] = useState("");
  const [trustpilotEnabled, setTrustpilotEnabled] = useState(false);
  const [trustpilotSaving, setTrustpilotSaving] = useState(false);
  const [trustpilotSaved, setTrustpilotSaved] = useState(false);
  const [communityWhatsapp, setCommunityWhatsapp] = useState("");
  const [communityInstagram, setCommunityInstagram] = useState("");
  const [communitySaving, setCommunitySaving] = useState(false);
  const [communitySaved, setCommunitySaved] = useState(false);
  const [banners, setBanners] = useState<OfferBanner[]>([]);
  const [bannersSaving, setBannersSaving] = useState(false);
  const [showAddBanner, setShowAddBanner] = useState(false);
  const [newBanner, setNewBanner] = useState({ emoji: "", title: "", subtitle: "", bgGradient: "linear-gradient(135deg,#1a0a2e,#2d1b69)", ctaText: "", ctaLink: "" });
  const [dailyOfferIds, setDailyOfferIds] = useState<number[]>([]);
  const [dailyOfferSaving, setDailyOfferSaving] = useState(false);
  const [dailyOfferSaved, setDailyOfferSaved] = useState(false);
  const [offerSelectedGameId, setOfferSelectedGameId] = useState<number | null>(null);
  const [offerGamePkgs, setOfferGamePkgs] = useState<Package[]>([]);
  const [offerPkgLoading, setOfferPkgLoading] = useState(false);

  interface PromoBannerAdmin { id: string; image: string; link: string; active: boolean; }
  const [promoBanners, setPromoBanners] = useState<PromoBannerAdmin[]>([]);
  const [promoBannersSaving, setPromoBannersSaving] = useState(false);
  const [newBannerLink, setNewBannerLink] = useState("");
  const [bannerLinkType, setBannerLinkType] = useState<"url"|"game"|"packages">("url");
  const [bannerLinkGameId, setBannerLinkGameId] = useState<string>("");
  const [bannerMediaType, setBannerMediaType] = useState<"file" | "url">("file");
  const [bannerMediaUrl, setBannerMediaUrl] = useState("");
  const [bannerFileName, setBannerFileName] = useState("");
  const promoBannerImgRef = useRef<HTMLInputElement>(null);

  interface Game { id: number; name: string; image: string | null; sort_order: number; region?: string | null; }
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [newGame, setNewGame] = useState({ name: "", sort_order: "0", region: "" });
  const [gamesSaving, setGamesSaving] = useState(false);
  const gameImgRef = useRef<HTMLInputElement>(null);
  const adminCurrLabel = (gameId: number | null) => {
    const gName = games.find(g => g.id === gameId)?.name || "";
    const n = gName.toLowerCase();
    if (n.includes("pubg") || n.includes("bgmi") || n.includes("battleground")) return "UC";
    if (n.includes("free fire") || n.includes("freefire")) return "Diamonds";
    if (n.includes("clash") || n.includes("royale")) return "Gems";
    if (n.includes("valorant")) return "VP";
    if (n.includes("cod") || n.includes("call of duty")) return "CP";
    if (n.includes("genshin") || n.includes("honkai")) return "Crystals";
    if (n.includes("fortnite")) return "V-Bucks";
    return "Diamonds";
  };
  const [updatingGameId, setUpdatingGameId] = useState<number | null>(null);
  const gameUpdateImgRef = useRef<HTMLInputElement>(null);
  const [editingGameMeta, setEditingGameMeta] = useState<{id: number; name: string; region: string} | null>(null);

  const fetchGames = async () => {
    setGamesLoading(true);
    try {
      const res = await fetch(`${API}/admin/games`, { headers });
      if (res.ok) setGames(await res.json());
    } catch {} finally { setGamesLoading(false); }
  };

  const addGame = async () => {
    if (!newGame.name.trim()) return;
    setGamesSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", newGame.name.trim());
      fd.append("sort_order", newGame.sort_order);
      fd.append("region", newGame.region.trim());
      if (gameImgRef.current?.files?.[0]) fd.append("image", gameImgRef.current.files[0]);
      const res = await fetch(`${API}/admin/games`, { method: "POST", headers: { Authorization: headers.Authorization }, body: fd });
      if (res.ok) {
        const g = await res.json();
        setGames(prev => [...prev, g]);
        setNewGame({ name: "", sort_order: "0", region: "" });
        if (gameImgRef.current) gameImgRef.current.value = "";
        window.dispatchEvent(new Event("skyAdminUpdate"));
      }
    } finally { setGamesSaving(false); }
  };

  const deleteGame = async (id: number) => {
    try {
      await fetch(`${API}/admin/games/${id}`, { method: "DELETE", headers });
      setGames(prev => prev.filter(g => g.id !== id));
      window.dispatchEvent(new Event("skyAdminUpdate"));
    } catch {}
  };

  const updateGameImage = async (file: File, gameId: number) => {
    setGamesSaving(true);
    try {
      const game = games.find(g => g.id === gameId);
      if (!game) return;
      const fd = new FormData();
      fd.append("name", game.name);
      fd.append("sort_order", String(game.sort_order || 0));
      fd.append("region", game.region?.trim() || "");
      fd.append("image", file);
      const res = await fetch(`${API}/admin/games/${gameId}`, { method: "PUT", headers: { Authorization: headers.Authorization }, body: fd });
      if (res.ok) {
        const updated = await res.json();
        setGames(prev => prev.map(g => g.id === gameId ? updated : g));
        window.dispatchEvent(new Event("skyAdminUpdate"));
      }
    } finally {
      setGamesSaving(false);
      setUpdatingGameId(null);
      if (gameUpdateImgRef.current) gameUpdateImgRef.current.value = "";
    }
  };

  const saveGameMeta = async (id: number, name: string, region: string) => {
    setGamesSaving(true);
    try {
      const g = games.find(x => x.id === id);
      if (!g) return;
      const fd = new FormData();
      fd.append("name", name.trim() || g.name);
      fd.append("sort_order", String(g.sort_order || 0));
      fd.append("region", region.trim());
      const res = await fetch(`${API}/admin/games/${id}`, { method: "PUT", headers: { Authorization: headers.Authorization }, body: fd });
      if (res.ok) {
        const updated = await res.json();
        setGames(prev => prev.map(x => x.id === id ? updated : x));
        setEditingGameMeta(null);
        window.dispatchEvent(new Event("skyAdminUpdate"));
      }
    } finally { setGamesSaving(false); }
  };

  const fetchPromoBanners = async () => {
    try {
      const res = await fetch(`${API}/admin/settings/promo_banners`, { headers });
      if (res.ok) setPromoBanners(await res.json());
    } catch {}
  };
  const savePromoBanners = async (updated: PromoBannerAdmin[]) => {
    setPromoBannersSaving(true);
    try {
      await fetch(`${API}/admin/settings/promo_banners`, { method: "PUT", headers, body: JSON.stringify(updated) });
      setPromoBanners(updated);
      window.dispatchEvent(new Event("skyAdminUpdate"));
    } finally { setPromoBannersSaving(false); }
  };
  const uploadMediaFile = (file: File, onProgress: (p: number) => void): Promise<string> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
      xhr.onload = () => {
        if (xhr.status === 200) { try { resolve(JSON.parse(xhr.responseText).url); } catch { reject(new Error("Invalid response")); } }
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      const fd = new FormData();
      fd.append("file", file);
      xhr.open("POST", `${API}/admin/upload-media`);
      xhr.setRequestHeader("Authorization", `Bearer ${sessionStorage.getItem("admin_token") ?? ""}`);
      xhr.send(fd);
    });

  const addPromoBanner = async () => {
    if (promoBanners.length >= 5) return;
    let image = "";
    if (bannerMediaType === "url") {
      if (!bannerMediaUrl.trim()) return;
      image = bannerMediaUrl.trim();
    } else {
      if (!promoBannerImgRef.current?.files?.[0]) return;
      const file = promoBannerImgRef.current.files[0];
      setPromoBannersSaving(true);
      setUploadProgress(0);
      try {
        image = await uploadMediaFile(file, p => setUploadProgress(p));
      } catch (err: any) {
        alert(`Upload failed: ${err?.message ?? "Unknown error"}`);
        setUploadProgress(null);
        setPromoBannersSaving(false);
        return;
      }
      setUploadProgress(null);
      setPromoBannersSaving(false);
    }
    let link = "";
    if (bannerLinkType === "url") link = newBannerLink.trim();
    else if (bannerLinkType === "game" && bannerLinkGameId) link = `/game/${bannerLinkGameId}`;
    else if (bannerLinkType === "packages") link = "/packages";
    const banner: PromoBannerAdmin = { id: Date.now().toString(), image, link, active: true };
    await savePromoBanners([...promoBanners, banner]);
    setNewBannerLink("");
    setBannerLinkType("url");
    setBannerLinkGameId("");
    setBannerMediaUrl("");
    setBannerMediaType("file");
    setBannerFileName("");
    if (promoBannerImgRef.current) promoBannerImgRef.current.value = "";
  };

  interface PromoEventAdmin { id: string; title: string; description: string; badge: string; bgImage: string; bgGradient: string; packIds: number[]; active: boolean; sortOrder: number; }
  const [promoEvents, setPromoEvents] = useState<PromoEventAdmin[]>([]);
  const [promoSaving, setPromoSaving] = useState(false);
  const [showAddPromo, setShowAddPromo] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoEventAdmin | null>(null);
  const [newPromo, setNewPromo] = useState({ title: "", description: "", badge: "", bgImage: "", bgGradient: "linear-gradient(135deg,#1a0a2e,#2d1b4e)", packIds: [] as number[], active: true });
  const promoImgRef = useRef<HTMLInputElement>(null);

  interface RechargeStaff { id: number; name: string; email: string | null; qr_image: string | null; whatsapp: string | null; upi_id: string | null; status: string; shift_hours: string | null; sort_order: number; created_at: string; staff_pin: string | null; notify_orders: boolean; }
  const [staffList, setStaffList] = useState<RechargeStaff[]>([]);
  const [staffSaving, setStaffSaving] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [revealedStaff, setRevealedStaff] = useState<Record<number, boolean>>({});
  const [newStaff, setNewStaff] = useState({ name: "", email: "", whatsapp: "", upi_id: "", shift_hours: "", status: "offline", pin: "" });
  const [staffQrPreview, setStaffQrPreview] = useState<string | null>(null);
  const staffQrRef = useRef<HTMLInputElement>(null);
  const [staffQrFile, setStaffQrFile] = useState<File | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSearchStatus, setOrderSearchStatus] = useState("");
  const [searchResults, setSearchResults] = useState<Order[] | null>(null);
  const [searching, setSearching] = useState(false);

  const DEFAULT_PACK_IMAGES_ADMIN = [
    { maxDiamonds: 20,     url: "/pack1.png", label: "1–20 Diamonds"     },
    { maxDiamonds: 50,     url: "/pack2.png", label: "21–50 Diamonds"    },
    { maxDiamonds: 100,    url: "/pack3.png", label: "51–100 Diamonds"   },
    { maxDiamonds: 500,    url: "/pack4.png", label: "101–500 Diamonds"  },
    { maxDiamonds: 1000,   url: "/pack5.png", label: "501–1000 Diamonds" },
    { maxDiamonds: 2000,   url: "/pack6.png", label: "1001–2000 Diamonds"},
    { maxDiamonds: 999999, url: "/pack7.png", label: "2001+ Diamonds"    },
  ];
  const DEFAULT_PASS_IMAGES_ADMIN: Record<string, string> = {
    "Weekly Pass":         "/pass1.png",
    "Twilight Pass":       "/pass2.png",
    "Weekly Elite Bundle": "/pass3.png",
    "Monthly Epic Bundle": "/pass4.png",
  };

  const [packImages, setPackImages] = useState(DEFAULT_PACK_IMAGES_ADMIN);
  const [passImages, setPassImages] = useState(DEFAULT_PASS_IMAGES_ADMIN);
  const [imagesSaving, setImagesSaving] = useState(false);
  const [imagesSaved, setImagesSaved] = useState(false);
  const [categoryAvailability, setCategoryAvailability] = useState<Record<string, string>>({});
  const [catAvailSaving, setCatAvailSaving] = useState(false);
  const [catAvailSaved, setCatAvailSaved] = useState(false);
  const [newPassName, setNewPassName] = useState("");
  const [newPassUrl, setNewPassUrl] = useState("");
  const [starlightImages, setStarlightImages] = useState<Record<string, string>>({});
  const [newStarlightName, setNewStarlightName] = useState("");
  const [newStarlightUrl, setNewStarlightUrl] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [newPkgImage, setNewPkgImage] = useState("");
  const [editingPkgImage, setEditingPkgImage] = useState("");
  const [newPkgOldPrice, setNewPkgOldPrice] = useState("");
  const [newPkgIconUrl, setNewPkgIconUrl] = useState("");
  const [newPkgIconUploading, setNewPkgIconUploading] = useState(false);
  const newPkgIconRef = useRef<HTMLInputElement>(null);
  const [editingPkgIconUploading, setEditingPkgIconUploading] = useState(false);
  const editingPkgIconRef = useRef<HTMLInputElement>(null);
  const [latestEvent, setLatestEvent] = useState<{ enabled: boolean; image: string; targetCategory: string }>({ enabled: false, image: "", targetCategory: "" });
  const [latestEventSaving, setLatestEventSaving] = useState(false);
  const [latestEventSaved, setLatestEventSaved] = useState(false);
  const latestEventImgRef = useRef<HTMLInputElement>(null);
  const [latestEventUploading, setLatestEventUploading] = useState(false);

  const uploadImage = async (file: File, onDone: (url: string) => void) => {
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await fetch(`${API}/admin/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        const { url } = await res.json();
        onDone(url);
      } else {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        alert(`Upload failed: ${err.error || res.statusText}`);
      }
    } catch (e) {
      alert("Upload failed: network error. Please try again.");
    }
  };

  // Test email
  const [emailTestState, setEmailTestState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [emailTestError, setEmailTestError] = useState("");
  const [pipelineState, setPipelineState] = useState<"idle" | "running" | "done">("idle");
  const [pipelineResult, setPipelineResult] = useState<any>(null);

  const runPipelineTest = async () => {
    setPipelineState("running");
    setPipelineResult(null);
    try {
      const res = await fetch(`${API}/admin/test-notification`, { method: "POST", headers });
      const data = await res.json();
      setPipelineResult(data);
    } catch (err: any) {
      setPipelineResult({ error: "Network error — " + (err?.message || "could not reach server") });
    }
    setPipelineState("done");
  };

  const sendTestEmail = async () => {
    setEmailTestState("sending");
    setEmailTestError("");
    try {
      const res = await fetch(`${API}/admin/test-email`, { method: "POST", headers });
      const data = await res.json();
      if (data.ok) {
        setEmailTestState("ok");
        setTimeout(() => setEmailTestState("idle"), 5000);
      } else {
        setEmailTestError(data.error || "Unknown error");
        setEmailTestState("error");
        setTimeout(() => setEmailTestState("idle"), 6000);
      }
    } catch {
      setEmailTestError("Network error — is the API server running?");
      setEmailTestState("error");
      setTimeout(() => setEmailTestState("idle"), 6000);
    }
  };

  // Push notifications
  const [notifState, setNotifState] = useState<NotifState>("unknown");
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  const token = sessionStorage.getItem("admin_token") || "";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // Check current notification status on mount
  useEffect(() => {
    if (!authed) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setNotifState("denied");
      return;
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      swRegRef.current = reg;
      const existing = await reg.pushManager.getSubscription();
      setNotifState(existing ? "subscribed" : "unknown");
    });
  }, [authed]);

  const enableNotifications = async () => {
    setNotifState("loading");
    try {
      const reg = await registerSW();
      if (!reg) { setNotifState("unsupported"); return; }
      swRegRef.current = reg;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setNotifState("denied"); return; }

      const keyRes = await fetch(`${API}/push/vapid-public-key`);
      const { publicKey } = await keyRes.json();
      if (!publicKey) { setNotifState("unknown"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(`${API}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub.toJSON()),
      });

      setNotifState("subscribed");
    } catch {
      setNotifState("unknown");
    }
  };

  const disableNotifications = async () => {
    const reg = swRegRef.current || await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(`${API}/push/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setNotifState("unknown");
  };

  const fetchPackages = useCallback(async () => {
    const res = await fetch(`${API}/admin/packages`, { headers });
    if (res.ok) setPackages(await res.json());
  }, [token]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`${API}/admin/orders`, { headers });
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders);
      setStats(data.stats);
    }
  }, [token]);

  const fetchWalletRequests = useCallback(async () => {
    const res = await fetch(`${API}/admin/wallet-requests`, { headers });
    if (res.ok) setWalletRequests(await res.json());
  }, [token]);

  const fetchCategoryPopular = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/category_popular`, { headers });
    if (res.ok) setCategoryPopular(await res.json());
  }, [token]);

  const saveCategoryPopular = async (updated: Record<string, boolean>) => {
    setFeaturedSaving(true);
    await fetch(`${API}/admin/settings/category_popular`, {
      method: "PUT", headers,
      body: JSON.stringify(updated),
    });
    setCategoryPopular(updated);
    setFeaturedSaving(false);
  };

  const fetchQr = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/qr`, { headers });
    if (res.ok) {
      const data = await res.json();
      setQrCurrent(data.qr || null);
      setAdminUpiId(data.upi_id || "");
    }
  }, [token]);

  const fetchAdminStatus = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/admin-status`, { headers });
    if (res.ok) {
      const data = await res.json();
      setAdminAvailable(data.status === "available");
    }
  }, [token]);

  const saveAdminUpiId = async () => {
    setAdminUpiSaving(true);
    await fetch(`${API}/admin/settings/admin-upi`, {
      method: "PUT", headers,
      body: JSON.stringify({ upi_id: adminUpiId }),
    });
    setAdminUpiSaved(true);
    setTimeout(() => setAdminUpiSaved(false), 3000);
    setAdminUpiSaving(false);
  };

  const toggleAdminAvailable = async () => {
    const next = adminAvailable ? "offline" : "available";
    setAdminAvailSaving(true);
    await fetch(`${API}/admin/settings/admin-status`, {
      method: "PUT", headers,
      body: JSON.stringify({ status: next }),
    });
    setAdminAvailable(next === "available");
    setAdminAvailSaving(false);
  };

  const fetchTrustpilot = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/trustpilot`, { headers });
    if (res.ok) {
      const data = await res.json();
      setTrustpilotUrl(data.url || "");
      setTrustpilotEnabled(data.enabled || false);
    }
  }, [token]);

  const fetchCommunityLinks = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/community_links`, { headers });
    if (res.ok) {
      const data = await res.json();
      setCommunityWhatsapp(data.whatsapp || "");
      setCommunityInstagram(data.instagram || "");
    }
  }, [token]);

  const fetchBanners = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/offer_banners`, { headers });
    if (res.ok) setBanners(await res.json());
  }, [token]);

  const fetchDailyOfferIds = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/daily_offer_packages`, { headers });
    if (res.ok) setDailyOfferIds(await res.json());
  }, [token]);

  const fetchOfferGamePkgs = useCallback(async (gameId: number) => {
    setOfferPkgLoading(true);
    try {
      const res = await fetch(`${API}/packages?game_id=${gameId}`);
      if (res.ok) setOfferGamePkgs(await res.json());
    } catch {} finally { setOfferPkgLoading(false); }
  }, []);

  const saveDailyOfferIds = async (ids: number[]) => {
    setDailyOfferSaving(true);
    await fetch(`${API}/admin/settings/daily_offer_packages`, { method: "PUT", headers, body: JSON.stringify(ids) });
    setDailyOfferIds(ids);
    window.dispatchEvent(new Event("skyAdminUpdate"));
    setDailyOfferSaved(true);
    setTimeout(() => setDailyOfferSaved(false), 2500);
    setDailyOfferSaving(false);
  };

  const toggleDailyOffer = (pkgId: number) => {
    const next = dailyOfferIds.includes(pkgId)
      ? dailyOfferIds.filter(id => id !== pkgId)
      : dailyOfferIds.length < 10 ? [...dailyOfferIds, pkgId] : dailyOfferIds;
    saveDailyOfferIds(next);
  };

  const fetchPackImages = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/pack_images`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) setPackImages(data);
    }
  }, [token]);

  const fetchPassImages = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/pass_images`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && !Array.isArray(data)) setPassImages(data);
    }
  }, [token]);

  const fetchStarlightImages = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/starlight_images`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && !Array.isArray(data)) setStarlightImages(data);
    }
  }, [token]);

  const fetchCategoryAvailability = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/category_availability`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") setCategoryAvailability(data);
    }
  }, [token]);

  const saveCategoryAvailability = async (updated: Record<string, string>) => {
    setCatAvailSaving(true);
    await fetch(`${API}/admin/settings/category_availability`, { method: "PUT", headers, body: JSON.stringify(updated) });
    setCatAvailSaved(true);
    setTimeout(() => setCatAvailSaved(false), 2500);
    setCatAvailSaving(false);
  };

  const fetchLatestEvent = useCallback(async () => {
    const res = await fetch(`${API}/admin/settings/latest_event`, { headers });
    if (res.ok) setLatestEvent(await res.json());
  }, [token]);

  const saveLatestEvent = async (data: typeof latestEvent) => {
    setLatestEventSaving(true);
    await fetch(`${API}/admin/settings/latest_event`, { method: "PUT", headers, body: JSON.stringify(data) });
    setLatestEvent(data);
    setLatestEventSaved(true);
    setTimeout(() => setLatestEventSaved(false), 3000);
    setLatestEventSaving(false);
  };

  const saveStarlightImages = async (images: Record<string, string>) => {
    await fetch(`${API}/admin/settings/starlight_images`, { method: "PUT", headers, body: JSON.stringify(images) });
  };

  const savePackImages = async () => {
    setImagesSaving(true);
    await fetch(`${API}/admin/settings/pack_images`, { method: "PUT", headers, body: JSON.stringify(packImages) });
    await fetch(`${API}/admin/settings/pass_images`, { method: "PUT", headers, body: JSON.stringify(passImages) });
    await saveStarlightImages(starlightImages);
    setImagesSaved(true);
    setTimeout(() => setImagesSaved(false), 3000);
    setImagesSaving(false);
  };

  const saveBanners = async (updated: OfferBanner[]) => {
    setBannersSaving(true);
    await fetch(`${API}/admin/settings/offer_banners`, { method: "PUT", headers, body: JSON.stringify(updated) });
    setBanners(updated);
    setBannersSaving(false);
  };

  const addBanner = () => {
    if (!newBanner.title.trim()) return;
    const banner: OfferBanner = {
      id: Date.now().toString(),
      title: newBanner.title,
      ...(newBanner.subtitle && { subtitle: newBanner.subtitle }),
      ...(newBanner.emoji && { emoji: newBanner.emoji }),
      ...(newBanner.bgGradient && { bgGradient: newBanner.bgGradient }),
      ...(newBanner.ctaText && { ctaText: newBanner.ctaText }),
      ...(newBanner.ctaLink && { ctaLink: newBanner.ctaLink }),
    };
    saveBanners([...banners, banner]);
    setNewBanner({ emoji: "", title: "", subtitle: "", bgGradient: "linear-gradient(135deg,#1a0a2e,#2d1b69)", ctaText: "", ctaLink: "" });
    setShowAddBanner(false);
  };

  const deleteBanner = (id: string) => saveBanners(banners.filter(b => b.id !== id));

  const saveTrustpilot = async () => {
    setTrustpilotSaving(true);
    await fetch(`${API}/admin/settings/trustpilot`, {
      method: "PUT", headers,
      body: JSON.stringify({ url: trustpilotUrl, enabled: trustpilotEnabled }),
    });
    setTrustpilotSaved(true);
    setTimeout(() => setTrustpilotSaved(false), 3000);
    setTrustpilotSaving(false);
  };

  const saveCommunityLinks = async () => {
    setCommunitySaving(true);
    await fetch(`${API}/admin/settings/community_links`, {
      method: "PUT", headers,
      body: JSON.stringify({ whatsapp: communityWhatsapp, instagram: communityInstagram }),
    });
    setCommunitySaved(true);
    setTimeout(() => setCommunitySaved(false), 3000);
    setCommunitySaving(false);
  };

  const saveQr = async () => {
    if (!qrPreview) return;
    setQrSaving(true);
    await fetch(`${API}/admin/settings/qr`, {
      method: "PUT", headers,
      body: JSON.stringify({ qr: qrPreview }),
    });
    setQrCurrent(qrPreview);
    setQrPreview(null);
    setQrSaved(true);
    setTimeout(() => setQrSaved(false), 3000);
    setQrSaving(false);
  };

  function handleQrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setQrPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!authed) return;
    fetchPackages();
    fetchOrders();
    fetchWalletRequests();
    fetchCategoryPopular();
    fetchStarlightImages();
  }, [authed]);

  useEffect(() => {
    if (authed && tab === "settings") { fetchQr(); fetchTrustpilot(); fetchCommunityLinks(); fetchBanners(); fetchPackImages(); fetchPassImages(); fetchStarlightImages(); fetchCategoryAvailability(); fetchLatestEvent(); }
    if (authed && tab === "staff") { fetchStaff(); fetchAdminStatus(); }
    if (authed && tab === "banners") fetchPromoBanners();
    if (authed && tab === "offer-banners") { fetchDailyOfferIds(); fetchGames(); }
    if (authed && (tab === "games" || tab === "packages")) fetchGames();
  }, [authed, tab]);

  useEffect(() => {
    if (!authed || tab !== "stats") return;
    fetch(`${API}/orders/recent`, { headers }).then(r => r.ok ? r.json() : []).then(d => setRecentOrders(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/stats`, { headers }).then(r => r.ok ? r.json() : null).then(d => { if (d) setStoreStats(d); }).catch(() => {});
  }, [authed, tab]);

  const fetchPromoEvents = async () => {
    try {
      const res = await fetch(`${API}/admin/promo-events`, { headers });
      if (res.ok) setPromoEvents(await res.json());
    } catch {}
  };

  const savePromoEvents = async (list: any[]) => {
    setPromoSaving(true);
    try {
      await fetch(`${API}/admin/promo-events`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(list) });
      await fetchPromoEvents();
    } catch {} finally { setPromoSaving(false); }
  };

  const uploadPromoImage = async (file: File): Promise<string | null> => {
    const fd = new FormData(); fd.append("image", file);
    const res = await fetch(`${API}/admin/upload-image`, { method: "POST", headers, body: fd });
    if (!res.ok) return null;
    return (await res.json()).url;
  };

  const addPromoEvent = async () => {
    if (!newPromo.title.trim()) { alert("Title is required."); return; }
    let bgImage = newPromo.bgImage;
    if (promoImgRef.current?.files?.[0]) {
      const url = await uploadPromoImage(promoImgRef.current.files[0]);
      if (url) bgImage = url;
    }
    const ev = { ...newPromo, bgImage, id: Date.now().toString(), sortOrder: promoEvents.length };
    await savePromoEvents([...promoEvents, ev]);
    setNewPromo({ title: "", description: "", badge: "", bgImage: "", bgGradient: "linear-gradient(135deg,#1a0a2e,#2d1b4e)", packIds: [], active: true });
    setShowAddPromo(false);
    if (promoImgRef.current) promoImgRef.current.value = "";
  };

  const deletePromoEvent = async (id: string) => {
    await savePromoEvents(promoEvents.filter(e => e.id !== id));
  };

  const togglePromoActive = async (id: string) => {
    await savePromoEvents(promoEvents.map(e => e.id === id ? { ...e, active: !e.active } : e));
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch(`${API}/admin/staff`, { headers });
      if (res.ok) setStaffList(await res.json());
    } catch {}
  };

  const addStaff = async () => {
    if (!newStaff.name.trim()) { alert("Name is required."); return; }
    setStaffSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", newStaff.name);
      if (newStaff.email) fd.append("email", newStaff.email);
      if (newStaff.whatsapp) fd.append("whatsapp", newStaff.whatsapp);
      if (newStaff.upi_id.trim()) fd.append("upi_id", newStaff.upi_id.trim());
      if (newStaff.shift_hours) fd.append("shift_hours", newStaff.shift_hours);
      fd.append("status", newStaff.status);
      if (staffQrFile) fd.append("qr_image", staffQrFile);
      if (newStaff.pin.trim()) fd.append("staff_pin", newStaff.pin.trim());
      await fetch(`${API}/admin/staff`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      await fetchStaff();
      setNewStaff({ name: "", email: "", whatsapp: "", upi_id: "", shift_hours: "", status: "offline", pin: "" });
      setStaffQrFile(null); setStaffQrPreview(null);
      setShowAddStaff(false);
    } catch {} finally { setStaffSaving(false); }
  };

  const toggleStaffStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "available" ? "offline" : "available";
    try {
      await fetch(`${API}/admin/staff/${id}/status`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
      await fetchStaff();
    } catch {}
  };

  const toggleStaffNotify = async (id: number, current: boolean) => {
    try {
      await fetch(`${API}/admin/staff/${id}/notify`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ notify_orders: !current }) });
      await fetchStaff();
    } catch {}
  };

  const [testEmailStates, setTestEmailStates] = useState<Record<number, "idle" | "sending" | "ok" | "error">>({});
  const sendStaffTestEmail = async (id: number) => {
    setTestEmailStates(s => ({ ...s, [id]: "sending" }));
    try {
      const res = await fetch(`${API}/admin/staff/${id}/test-email`, { method: "POST", headers });
      const data = await res.json();
      if (res.ok) {
        setTestEmailStates(s => ({ ...s, [id]: "ok" }));
        setTimeout(() => setTestEmailStates(s => ({ ...s, [id]: "idle" })), 3000);
      } else {
        alert(data.error || "Failed to send test email.");
        setTestEmailStates(s => ({ ...s, [id]: "error" }));
        setTimeout(() => setTestEmailStates(s => ({ ...s, [id]: "idle" })), 3000);
      }
    } catch {
      alert("Network error sending test email.");
      setTestEmailStates(s => ({ ...s, [id]: "error" }));
      setTimeout(() => setTestEmailStates(s => ({ ...s, [id]: "idle" })), 3000);
    }
  };

  const deleteStaff = async (id: number) => {
    if (!confirm("Delete this staff member?")) return;
    await fetch(`${API}/admin/staff/${id}`, { method: "DELETE", headers });
    await fetchStaff();
  };

  const searchOrders = async () => {
    if (!orderSearch.trim() && !orderSearchStatus) return;
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (orderSearch.trim()) params.set("q", orderSearch.trim());
      if (orderSearchStatus) params.set("status", orderSearchStatus);
      const res = await fetch(`${API}/admin/orders/search?${params}`, { headers });
      if (res.ok) setSearchResults(await res.json());
    } catch {} finally { setSearching(false); }
  };

  const approveWallet = async (id: number) => {
    setWalletLoading(id);
    await fetch(`${API}/admin/wallet-requests/${id}/approve`, { method: "POST", headers });
    await fetchWalletRequests();
    setWalletLoading(null);
  };

  const rejectWallet = async (id: number) => {
    setWalletLoading(id);
    await fetch(`${API}/admin/wallet-requests/${id}/reject`, { method: "POST", headers });
    await fetchWalletRequests();
    setWalletLoading(null);
  };

  useEffect(() => { adminBioAvailable().then(setBioAvail); }, []);
  useEffect(() => { if (!authed && bioAvail && bioEnabled) loginWithBio(); }, [bioAvail]);

  const login = async () => {
    setLoginError(""); setBioMsg("");
    const res = await fetch(`${API}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      sessionStorage.setItem("admin_token", password);
      setAuthed(true);
    } else {
      setLoginError("Wrong password. Try again.");
    }
  };

  const loginWithBio = async () => {
    setBioLoading(true); setLoginError(""); setBioMsg("");
    try {
      const token = await adminBioAuthenticate();
      if (token) { sessionStorage.setItem("admin_token", token); setAuthed(true); }
      else setBioMsg("Biometric verification failed. Use password instead.");
    } catch (e: any) {
      setBioMsg(e?.name === "NotAllowedError" ? "Biometric cancelled." : "Biometric login failed.");
    } finally { setBioLoading(false); }
  };

  const enableBio = async () => {
    setBioLoading(true); setBioMsg("");
    try {
      const ok = await adminBioRegister(password);
      if (ok) { setBioEnabled(true); setBioMsg("✓ Biometric login enabled for this device!"); }
      else setBioMsg("Could not save biometric credential.");
    } catch (e: any) {
      setBioMsg(e?.name === "NotAllowedError" ? "Biometric setup cancelled." : "Biometric setup failed.");
    } finally { setBioLoading(false); }
  };

  const disableBio = () => {
    localStorage.removeItem(ADMIN_BIO_CRED); localStorage.removeItem(ADMIN_BIO_TOKEN);
    setBioEnabled(false); setBioMsg("Biometric login removed.");
  };

  const savePkg = async (pkg: Package) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/packages/${pkg.id}`, {
        method: "PUT", headers,
        body: JSON.stringify(pkg),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to save package: ${err.error || res.statusText}`);
        return;
      }
      if (pkg.category === "starlight" && pkg.name?.trim() && editingPkgImage.trim()) {
        const updated = { ...starlightImages, [pkg.name.trim()]: editingPkgImage.trim() };
        setStarlightImages(updated);
        await saveStarlightImages(updated);
      }
      await fetchPackages();
      setEditingPkg(null);
      setEditingPkgImage("");
    } finally {
      setLoading(false);
    }
  };

  const deletePkg = async (id: number) => {
    if (!confirm("Delete this package?")) return;
    await fetch(`${API}/admin/packages/${id}`, { method: "DELETE", headers });
    await fetchPackages();
  };

  const addPkg = async () => {
    if (!newPkg.diamonds || !newPkg.price) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/packages`, {
        method: "POST", headers,
        body: JSON.stringify({ ...newPkg, sort_order: packages.length + 1, game_id: newPkgGameId, image: newPkgIconUrl || null, old_price: newPkgOldPrice || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to save package: ${err.error || res.statusText}`);
        return;
      }
      if (newPkg.category === "starlight" && newPkg.name.trim() && newPkgImage.trim()) {
        const updated = { ...starlightImages, [newPkg.name.trim()]: newPkgImage.trim() };
        setStarlightImages(updated);
        await saveStarlightImages(updated);
      }
      setNewPkg({ name: "", diamonds: "", bonus_diamonds: "", price: "", label: "", is_popular: false, category: "small", status: "available" });
      setNewPkgImage("");
      setNewPkgOldPrice("");
      setNewPkgIconUrl("");
      if (newPkgIconRef.current) newPkgIconRef.current.value = "";
      setNewPkgGameId(null);
      setNewPkgStep("game");
      setNewPkgCurrencyType("");
      setShowAddPkg(false);
      await fetchPackages();
    } finally {
      setLoading(false);
    }
  };

  const addOrder = async () => {
    if (!newOrder.diamonds || !newOrder.price) return;
    setLoading(true);
    await fetch(`${API}/admin/orders`, {
      method: "POST", headers,
      body: JSON.stringify(newOrder),
    });
    setNewOrder({ diamonds: "", price: "", mlbb_id: "", status: "completed", note: "" });
    setShowAddOrder(false);
    await fetchOrders();
    setLoading(false);
  };

  const updateOrderStatus = async (id: number, status: string, note: string | null) => {
    await fetch(`${API}/admin/orders/${id}`, {
      method: "PUT", headers,
      body: JSON.stringify({ status, note }),
    });
    await fetchOrders();
  };

  const deleteOrder = async (id: number) => {
    if (!confirm("Delete this order?")) return;
    await fetch(`${API}/admin/orders/${id}`, { method: "DELETE", headers });
    await fetchOrders();
  };

  const logout = () => {
    sessionStorage.removeItem("admin_token");
    setAuthed(false);
    onClose();
  };

  const notifButton = () => {
    if (notifState === "unsupported") return null;
    if (notifState === "denied") return (
      <span className="text-xs text-red-400 font-semibold">Notifications blocked in browser</span>
    );
    if (notifState === "loading") return (
      <span className="text-xs text-amber-400 animate-pulse">Enabling…</span>
    );
    if (notifState === "subscribed") return (
      <button
        onClick={disableNotifications}
        className="flex items-center gap-1.5 text-xs font-bold transition-all"
        style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.28)", flexShrink: 0 }}
      >
        <span>🔔</span> Notifs ON
      </button>
    );
    return (
      <button
        onClick={enableNotifications}
        className="flex items-center gap-1.5 text-xs font-bold transition-all"
        style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "rgba(245,158,11,0.10)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", flexShrink: 0 }}
      >
        <span>🔕</span> Enable Notifs
      </button>
    );
  };

  const pkgSelGame = games.find(g => g.id === newPkgGameId);
  const pkgN = (pkgSelGame?.name ?? "").toLowerCase();
  const pkgHasTypes = pkgN.includes("genshin") || pkgN.includes("honor of kings") || pkgN.includes("hok");
  const pkgCurrTypes = pkgN.includes("genshin") ? ["Chronal Nexus", "Crystals"] : (pkgN.includes("honor of kings") || pkgN.includes("hok")) ? ["Tokens", "Card"] : [];
  const pkgBaseLabel = pkgN.includes("mobile legends") || pkgN.includes("mlbb") ? "Diamonds" : (pkgN.includes("bgmi") || pkgN.includes("pubg")) ? "UC" : "Currency";
  const pkgCurrLabel = pkgHasTypes && newPkgCurrencyType ? newPkgCurrencyType : pkgBaseLabel;
  const cancelAddPkg = () => { setShowAddPkg(false); setNewPkgStep("game"); setNewPkgGameId(null); setNewPkgCurrencyType(""); };

  return (
    <div
      className={fullPage
        ? "fixed inset-0 z-[100] flex flex-col"
        : "fixed inset-0 z-[100] flex items-center justify-center p-4"}
      style={fullPage
        ? { background: "#0a0a0a" }
        : { background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={!fullPage ? (e: React.MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div
        className={fullPage
          ? "flex flex-col flex-1 overflow-hidden"
          : "w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl"}
        style={fullPage
          ? {}
          : { background: "#111", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 0 60px rgba(245,158,11,0.15)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: "#111", borderBottom: "1px solid rgba(255,255,255,0.07)", minHeight: 52 }}>
          {/* Left: back / title */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {fullPage ? (
              <button onClick={onClose} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm font-semibold">
                <span style={{ fontSize: 18, lineHeight: 1 }}>←</span> Back
              </button>
            ) : (
              <>
                <span style={{ color: "#f59e0b", fontSize: 17 }}>🔑</span>
                <span className="font-bold text-white text-sm">Admin Panel</span>
              </>
            )}
          </div>

          {/* Right: compact actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {authed && notifButton()}
            {authed && bioAvail && !bioEnabled && password && (
              <button
                onClick={enableBio}
                disabled={bioLoading}
                title={bioLoading ? "Setting up…" : "Enable biometric login for this device"}
                className="flex items-center justify-center text-xs font-bold transition-all"
                style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", cursor: "pointer", flexShrink: 0, gap: 4 }}
              >
                {bioLoading ? "…" : <><span style={{ fontSize: 13 }}>🔑</span></>}
              </button>
            )}
            {authed && bioAvail && bioEnabled && (
              <button
                onClick={disableBio}
                title="Biometric ON — click to remove"
                className="flex items-center justify-center text-xs font-bold transition-all"
                style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.32)", color: "#a5b4fc", cursor: "pointer", flexShrink: 0 }}
              >
                <span style={{ fontSize: 13 }}>🔑</span>
              </button>
            )}
            {authed && (
              <button
                onClick={logout}
                className="flex items-center justify-center text-xs font-semibold transition-all"
                style={{ height: 28, padding: "0 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", whiteSpace: "nowrap", flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                Sign out
              </button>
            )}
            {!fullPage && (
              <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none">×</button>
            )}
          </div>
        </div>

        {!authed ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 p-10">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>🔐</div>
            <div className="text-center">
              <div className="text-white font-bold text-lg">Admin Access</div>
              <div className="text-gray-400 text-sm mt-1">Enter your password to continue</div>
            </div>
            <div className="w-full max-w-xs flex flex-col gap-3">
              {bioAvail && bioEnabled && (
                <button
                  onClick={loginWithBio}
                  disabled={bioLoading}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)", border: "1.5px solid rgba(129,140,248,0.5)", color: "#a5b4fc" }}
                >
                  {bioLoading ? <span className="animate-pulse">Verifying…</span> : <><span style={{ fontSize: 18 }}>🔑</span> Login with Biometrics</>}
                </button>
              )}
              {bioAvail && bioEnabled && !showPwForm && (
                <button
                  onClick={() => setShowPwForm(true)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 12, padding: 0 }}
                >
                  Use password instead
                </button>
              )}
              {(!bioEnabled || !bioAvail || showPwForm) && (
                <>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && login()}
                    className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                    style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
                    autoFocus
                  />
                  <button
                    onClick={login}
                    className="w-full py-3 rounded-xl font-bold text-sm text-black"
                    style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                  >
                    Enter
                  </button>
                </>
              )}
              {(loginError || bioMsg) && (
                <p className={`text-xs text-center ${loginError ? "text-red-400" : "text-amber-400"}`}>{loginError || bioMsg}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div
              className="flex gap-1 px-4 pt-3 flex-shrink-0"
              style={{
                background: "#111",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                touchAction: "pan-x",
                overscrollBehavior: "contain",
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {(["games", "packages", "orders", "wallet", "staff", "banners", "offer-banners", "settings", "stats"] as Tab[]).map((t) => {
                const pendingCount = t === "wallet" ? walletRequests.filter(r => r.status === "pending").length : 0;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-5 py-2.5 text-sm font-semibold capitalize rounded-t-lg transition-colors flex items-center gap-1.5"
                    style={{
                      flexShrink: 0,
                      ...(tab === t
                        ? { color: "#f59e0b", borderBottom: "2px solid #f59e0b", background: "rgba(245,158,11,0.07)" }
                        : { color: "#9ca3af" }),
                    }}
                  >
                    {t === "stats" ? "Store Stats" : t === "offer-banners" ? "Offer Banners" : t}
                    {pendingCount > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#ef4444", color: "#fff", fontSize: 10 }}>{pendingCount}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 flex flex-col" style={{ overflow: "hidden" }}>
              {/* ── GAMES TAB ── */}
              {tab === "games" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, overflowY: "auto", padding: 20 }}>
                  <div>
                    <div className="text-amber-400 text-sm font-bold mb-1">Game Selection Panels</div>
                    <div className="text-gray-500 text-xs mb-4">These panels appear on the Home page under "Select Game". Add as many games as you want. Each panel shows the game image and name.</div>
                    <input
                      ref={gameUpdateImgRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file && updatingGameId !== null) updateGameImage(file, updatingGameId);
                      }}
                    />
                    {gamesLoading ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <style>{`@keyframes admSkel{0%,100%{opacity:0.35}50%{opacity:0.7}} @keyframes slideAdminName{0%,20%{transform:translateX(0)}80%,100%{transform:translateX(calc(-100% + 68px))}}`}</style>
                        {[0,1,2,3].map(i => (
                          <div key={i} style={{ borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", animation: `admSkel 1.5s ease-in-out ${i * 0.1}s infinite` }}>
                            <div style={{ width: "100%", aspectRatio: "1/1", background: "rgba(255,255,255,0.03)" }} />
                            <div style={{ padding: "10px 10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ height: 11, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
                              <div style={{ height: 26, borderRadius: 8, background: "rgba(245,158,11,0.06)" }} />
                              <div style={{ height: 26, borderRadius: 8, background: "rgba(239,68,68,0.06)" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : games.length === 0 ? (
                      <div className="text-gray-500 text-xs py-4 text-center">No games added yet. Add one below.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {games.map((g) => (
                          <div key={g.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px", border: editingGameMeta?.id === g.id ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: 8, background: g.image ? "transparent" : "rgba(255,255,255,0.06)", border: g.image ? "none" : "1px dashed rgba(255,255,255,0.15)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {g.image ? <img src={g.image} alt={g.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>No image</span>}
                            </div>
                            {editingGameMeta?.id === g.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <input value={editingGameMeta.name} onChange={e => setEditingGameMeta(m => m ? { ...m, name: e.target.value } : m)} placeholder="Game name" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 7, padding: "6px 8px", color: "#fff", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
                                <input value={editingGameMeta.region} onChange={e => setEditingGameMeta(m => m ? { ...m, region: e.target.value } : m)} placeholder="Region (e.g. Global)" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "6px 8px", color: "#fff", fontSize: 11, outline: "none", width: "100%", boxSizing: "border-box" }} />
                                <div style={{ display: "flex", gap: 5 }}>
                                  <button onClick={() => saveGameMeta(g.id, editingGameMeta.name, editingGameMeta.region)} disabled={gamesSaving} style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 7, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", cursor: "pointer" }}>{gamesSaving ? "Saving…" : "Save"}</button>
                                  <button onClick={() => setEditingGameMeta(null)} style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 7, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                                {g.region && <div style={{ color: "rgba(245,158,11,0.65)", fontSize: 10, textAlign: "center", marginTop: -4 }}>{g.region}</div>}
                                <button onClick={() => setEditingGameMeta({ id: g.id, name: g.name, region: g.region ?? "" })} style={{ fontSize: 11, padding: "4px 0", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", width: "100%" }}>Edit Name / Region</button>
                                <button onClick={() => { setUpdatingGameId(g.id); gameUpdateImgRef.current?.click(); }} disabled={gamesSaving} style={{ fontSize: 11, padding: "4px 0", borderRadius: 8, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", cursor: "pointer", width: "100%" }}>
                                  {gamesSaving && updatingGameId === g.id ? "Saving…" : "Upload Image"}
                                </button>
                                <button onClick={() => deleteGame(g.id)} style={{ fontSize: 11, padding: "4px 0", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none", cursor: "pointer", width: "100%" }}>Delete</button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "18px 16px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="text-amber-400 text-sm font-bold mb-4">Add New Game</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <input
                        placeholder="Game name (e.g. Mobile Legends)"
                        value={newGame.name}
                        onChange={e => setNewGame(g => ({ ...g, name: e.target.value }))}
                        className="px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <div>
                        <div className="text-gray-400 text-xs mb-1.5">Game image (square ratio recommended)</div>
                        <input ref={gameImgRef} type="file" accept="image/*" style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                      </div>
                      <input
                        placeholder="Region (e.g. Global, SEA, India — optional)"
                        value={newGame.region}
                        onChange={e => setNewGame(g => ({ ...g, region: e.target.value }))}
                        className="px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <input
                        placeholder="Sort order (0 = first)"
                        type="number"
                        value={newGame.sort_order}
                        onChange={e => setNewGame(g => ({ ...g, sort_order: e.target.value }))}
                        className="px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <button
                        onClick={addGame}
                        disabled={gamesSaving || !newGame.name.trim()}
                        className="py-2.5 rounded-xl text-sm font-bold text-black"
                        style={{ background: (gamesSaving || !newGame.name.trim()) ? "rgba(245,158,11,0.5)" : "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                      >
                        {gamesSaving ? "Saving…" : "+ Add Game"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PACKAGES TAB ── */}
              {tab === "packages" && (
                <div className="flex flex-col gap-4" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">{packages.length} Packages</span>
                    <button
                      onClick={() => setShowAddPkg(!showAddPkg)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-black"
                      style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                    >
                      + Add Package
                    </button>
                  </div>

                  {showAddPkg && (
                    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(245,158,11,0.2)" }}>
                      {newPkgStep === "game" ? (
                        <>
                          <div className="text-amber-400 text-sm font-bold">Select Game for Package</div>
                          <div className="text-xs text-gray-500">Choose which game this package belongs to.</div>
                          {games.length === 0 ? (
                            <div className="text-xs text-gray-500 py-4 text-center">No games added yet. Add games in the Games tab first.</div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {games.map(g => (
                                <button key={g.id}
                                  onClick={() => { setNewPkgGameId(g.id); setNewPkgCurrencyType(""); setNewPkgStep("form"); }}
                                  className="flex flex-col items-center gap-2 p-3 rounded-xl text-center"
                                  style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                                  {g.image && <img src={g.image} alt={g.name} style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8 }} />}
                                  <span className="text-white text-xs font-semibold">{g.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <button onClick={cancelAddPkg} className="py-2 rounded-lg text-xs font-bold text-gray-400" style={{ background: "#222" }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setNewPkgStep("game"); setNewPkgCurrencyType(""); }} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 0, fontSize: 18, lineHeight: 1 }}>←</button>
                            <div className="text-amber-400 text-sm font-bold">New Package</div>
                            {pkgSelGame && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>{pkgSelGame.name}</span>}
                          </div>
                          {pkgHasTypes && (
                            <div>
                              <div className="text-xs text-gray-400 mb-1.5">Currency Type</div>
                              <div className="flex gap-2">
                                {pkgCurrTypes.map(t => (
                                  <button key={t} onClick={() => setNewPkgCurrencyType(t)}
                                    className="flex-1 py-2 rounded-lg text-xs font-bold"
                                    style={{ background: newPkgCurrencyType === t ? "#f59e0b" : "#222", color: newPkgCurrencyType === t ? "#000" : "#9ca3af", border: "1px solid " + (newPkgCurrencyType === t ? "#f59e0b" : "rgba(255,255,255,0.1)") }}>
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <input placeholder='Name (e.g. "Starter Pack")' value={newPkg.name} onChange={(e) => setNewPkg(p => ({ ...p, name: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none col-span-2" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                            <input placeholder={pkgCurrLabel} type="number" value={newPkg.diamonds} onChange={(e) => setNewPkg(p => ({ ...p, diamonds: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                            <input placeholder={"Bonus " + pkgCurrLabel} type="number" value={newPkg.bonus_diamonds} onChange={(e) => setNewPkg(p => ({ ...p, bonus_diamonds: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                            <input placeholder="Price (₹)" type="number" value={newPkg.price} onChange={(e) => setNewPkg(p => ({ ...p, price: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                            <input placeholder="Old Price (₹, optional)" type="number" value={newPkgOldPrice} onChange={(e) => setNewPkgOldPrice(e.target.value)} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                            <input placeholder='Label (e.g. "Best Value")' value={newPkg.label} onChange={(e) => setNewPkg(p => ({ ...p, label: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none col-span-2" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                          </div>
                          {/* Package icon upload */}
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Package Icon (optional)</div>
                            <div className="flex gap-2 items-center">
                              <label style={{ flexShrink: 0, cursor: "pointer" }}>
                                <input ref={newPkgIconRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                                  const file = e.target.files?.[0]; if (!file) return;
                                  setNewPkgIconUploading(true);
                                  await uploadImage(file, u => setNewPkgIconUrl(u));
                                  setNewPkgIconUploading(false);
                                  e.target.value = "";
                                }} />
                                <div style={{ padding: "6px 12px", borderRadius: 8, background: newPkgIconUploading ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  {newPkgIconUploading ? "Uploading…" : "Upload Icon"}
                                </div>
                              </label>
                              {newPkgIconUrl && (
                                <>
                                  <img src={newPkgIconUrl} alt="icon preview" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} />
                                  <button onClick={() => { setNewPkgIconUrl(""); if (newPkgIconRef.current) newPkgIconRef.current.value = ""; }} style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                                </>
                              )}
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                            <input type="checkbox" checked={newPkg.is_popular} onChange={(e) => setNewPkg(p => ({ ...p, is_popular: e.target.checked }))} />
                            Mark as popular
                          </label>
                          <select value={newPkg.status} onChange={(e) => setNewPkg(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <option value="available">Available</option>
                            <option value="out_of_stock">Out of Stock</option>
                            <option value="coming_soon">Coming Soon</option>
                          </select>
                          {newPkg.category === "starlight" && (
                            <div>
                              <div className="text-xs mb-1" style={{ color: "#f5c842" }}>★ Card Image</div>
                              <div className="flex gap-2 items-center">
                                <input value={newPkgImage} onChange={e => setNewPkgImage(e.target.value)} placeholder="/uploads/image.png or https://..." className="flex-1 px-3 py-2 rounded-lg text-white text-xs outline-none font-mono" style={{ background: "#111", border: "1px solid rgba(245,200,66,0.3)" }} />
                                <label style={{ flexShrink: 0, cursor: "pointer" }} title="Upload image">
                                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                                    const file = e.target.files?.[0]; if (!file) return;
                                    setUploadingKey("__newpkg__");
                                    await uploadImage(file, u => setNewPkgImage(u));
                                    setUploadingKey(null);
                                    e.target.value = "";
                                  }} />
                                  <div style={{ width: 36, height: 32, borderRadius: 6, background: uploadingKey === "__newpkg__" ? "rgba(245,200,66,0.3)" : "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {uploadingKey === "__newpkg__"
                                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#f5c842" strokeWidth="2" strokeDasharray="56" strokeDashoffset="14"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle></svg>
                                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#f5c842" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="#f5c842" strokeWidth="2"/></svg>
                                    }
                                  </div>
                                </label>
                                {newPkgImage && <img src={newPkgImage} alt="" style={{ width: 40, height: 32, objectFit: "contain", borderRadius: 6, background: "#0d0d14", border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={addPkg} disabled={loading} className="flex-1 py-2 rounded-lg text-xs font-bold text-black" style={{ background: "#f59e0b" }}>Save</button>
                            <button onClick={cancelAddPkg} className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-400" style={{ background: "#222" }}>Cancel</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {packages.map((pkg) => (
                    <div key={pkg.id} className="rounded-xl p-4" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                      {editingPkg?.id === pkg.id ? (
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <div className="text-xs text-gray-400 mb-1">Name</div>
                              <input placeholder='e.g. "Starter Pack"' value={editingPkg.name || ""} onChange={(e) => setEditingPkg(p => p ? { ...p, name: e.target.value } : p)} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)" }} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Diamonds</div>
                              <input type="number" value={editingPkg.diamonds} onChange={(e) => setEditingPkg(p => p ? { ...p, diamonds: +e.target.value } : p)} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)" }} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Bonus Diamonds</div>
                              <input type="number" value={editingPkg.bonus_diamonds} onChange={(e) => setEditingPkg(p => p ? { ...p, bonus_diamonds: +e.target.value } : p)} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)" }} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Price (₹)</div>
                              <input type="number" value={editingPkg.price} onChange={(e) => setEditingPkg(p => p ? { ...p, price: e.target.value } : p)} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)" }} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Old Price (₹, optional)</div>
                              <input type="number" value={editingPkg.old_price || ""} onChange={(e) => setEditingPkg(p => p ? { ...p, old_price: e.target.value || null } : p)} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)" }} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Label</div>
                              <input value={editingPkg.label || ""} onChange={(e) => setEditingPkg(p => p ? { ...p, label: e.target.value } : p)} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)" }} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400 mb-1">Sort Order</div>
                              <input type="number" value={editingPkg.sort_order} onChange={(e) => setEditingPkg(p => p ? { ...p, sort_order: +e.target.value } : p)} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)" }} />
                            </div>
                          </div>
                          {/* Edit package icon */}
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Package Icon</div>
                            <div className="flex gap-2 items-center">
                              <label style={{ flexShrink: 0, cursor: "pointer" }}>
                                <input ref={editingPkgIconRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                                  const file = e.target.files?.[0]; if (!file) return;
                                  setEditingPkgIconUploading(true);
                                  await uploadImage(file, u => setEditingPkg(p => p ? { ...p, image: u } : p));
                                  setEditingPkgIconUploading(false);
                                  e.target.value = "";
                                }} />
                                <div style={{ padding: "6px 12px", borderRadius: 8, background: editingPkgIconUploading ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                  {editingPkgIconUploading ? "Uploading…" : editingPkg.image ? "Change Icon" : "Upload Icon"}
                                </div>
                              </label>
                              {editingPkg.image && (
                                <>
                                  <img src={editingPkg.image} alt="icon" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} />
                                  <button onClick={() => setEditingPkg(p => p ? { ...p, image: null } : p)} style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                                </>
                              )}
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                            <input type="checkbox" checked={editingPkg.is_popular} onChange={(e) => setEditingPkg(p => p ? { ...p, is_popular: e.target.checked } : p)} />
                            Mark as popular
                          </label>
                          <div className="col-span-2">
                            <div className="text-xs text-gray-400 mb-1">Status</div>
                            <select value={editingPkg.status || "available"} onChange={(e) => setEditingPkg(p => p ? { ...p, status: e.target.value } : p)} className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)" }}>
                              <option value="available">Available</option>
                              <option value="out_of_stock">Out of Stock</option>
                              <option value="coming_soon">Coming Soon</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => savePkg(editingPkg)} disabled={loading} className="flex-1 py-2 rounded-lg text-xs font-bold text-black" style={{ background: "#f59e0b" }}>Save</button>
                            <button onClick={() => { setEditingPkg(null); if (editingPkgIconRef.current) editingPkgIconRef.current.value = ""; }} className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-400" style={{ background: "#222" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: pkg.image ? "rgba(255,255,255,0.05)" : "rgba(56,189,248,0.12)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              {pkg.image
                                ? <img src={pkg.image} alt="icon" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <img src="/diamond.png" alt="♦" style={{ width: 22, height: 22, objectFit: "contain" }} />
                              }
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-bold text-sm">{pkg.name || `${pkg.diamonds.toLocaleString()} ${adminCurrLabel(pkg.game_id)}`}</span>
                              </div>
                              <div className="text-amber-400 text-xs font-semibold mt-0.5 flex items-center gap-1">
                                {pkg.image ? <img src={pkg.image} alt="icon" style={{ width: 12, height: 12, objectFit: "cover", flexShrink: 0, borderRadius: 3 }} /> : <img src="/diamond.png" alt="♦" style={{ width: 12, height: 12, objectFit: "contain", flexShrink: 0 }} />} {pkg.diamonds.toLocaleString()}{pkg.bonus_diamonds > 0 ? <span className="text-green-400"> +{pkg.bonus_diamonds.toLocaleString()} bonus</span> : null}
                                <span className="text-gray-500 mx-1">·</span>₹{parseFloat(pkg.price).toFixed(0)}
                                {pkg.label ? <span className="text-gray-400 font-normal"> · {pkg.label}</span> : null}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {pkg.is_popular && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>Popular</span>}
                            {pkg.status === "out_of_stock" && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>Out of Stock</span>}
                            {pkg.status === "coming_soon" && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>Coming Soon</span>}
                            <button onClick={() => { setEditingPkg(pkg); setEditingPkgImage(starlightImages[pkg.name || ""] || ""); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors text-sm">✏️</button>
                            <button onClick={() => deletePkg(pkg.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors text-sm">🗑️</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── ORDERS TAB ── */}
              {tab === "orders" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                  <div style={{ flexShrink: 0, padding: "20px 20px 12px", background: "#111", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {stats && (
                      <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 14 }}>
                        {[
                          { label: "Total Orders", value: stats.total_orders, icon: "📦" },
                          { label: "Revenue", value: `₹${parseFloat(stats.total_revenue).toFixed(0)}`, icon: "💰" },
                          { label: "Products Sold", value: parseInt(stats.total_diamonds).toLocaleString(), icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                        ].map((s) => (
                          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", fontSize: 22, lineHeight: 1, marginBottom: 4, height: 26 }}>{s.icon}</div>
                            <div className="text-white font-bold text-lg leading-tight">{s.value}</div>
                            <div className="text-gray-400 text-xs mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="text-white font-bold text-sm">Recent Orders</span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {orders.length === 0 && (
                      <div className="text-center text-gray-500 text-sm py-8">No orders yet.</div>
                    )}

                    {orders.map((order) => (
                    <div key={order.id} className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold text-sm flex items-center gap-1">{order.diamonds.toLocaleString()} {order.pack_image ? <img src={order.pack_image} alt="icon" style={{ width: 14, height: 14, objectFit: "cover", flexShrink: 0, borderRadius: 3 }} /> : <img src="/diamond.png" alt="♦" style={{ width: 14, height: 14, objectFit: "contain", flexShrink: 0 }} />}</span>
                          <span className="text-amber-400 text-xs font-semibold">₹{parseFloat(order.price).toFixed(0)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: order.note === "Paid via wallet" ? "rgba(167,139,250,0.15)" : "rgba(52,211,153,0.12)", color: order.note === "Paid via wallet" ? "#a78bfa" : "#34d399", border: `1px solid ${order.note === "Paid via wallet" ? "rgba(167,139,250,0.3)" : "rgba(52,211,153,0.25)"}` }}>
                            {order.note === "Paid via wallet" ? "💳 Wallet" : "📱 UPI"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {order.mlbb_id && (
                            <span className="flex items-center gap-1">
                              <span className="text-gray-400 text-xs">ID: {order.mlbb_id}</span>
                              <button onClick={() => copyWithFeedback(order.mlbb_id!, `mlbb_${order.id}`)} title="Copy MLBB ID" className="text-xs px-1 py-0.5 rounded transition-colors" style={{ background: copiedKey === `mlbb_${order.id}` ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${copiedKey === `mlbb_${order.id}` ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)"}`, color: copiedKey === `mlbb_${order.id}` ? "#22c55e" : "rgba(255,255,255,0.4)", lineHeight: 1, fontWeight: 700 }}>
                                {copiedKey === `mlbb_${order.id}` ? "✓" : "⎘"}
                              </button>
                            </span>
                          )}
                          {order.mlbb_server_id && (
                            <span className="flex items-center gap-1">
                              <span className="text-gray-500 text-xs">Zone: {order.mlbb_server_id}</span>
                              <button onClick={() => copyWithFeedback(order.mlbb_server_id!, `zone_${order.id}`)} title="Copy Zone ID" className="text-xs px-1 py-0.5 rounded transition-colors" style={{ background: copiedKey === `zone_${order.id}` ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${copiedKey === `zone_${order.id}` ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)"}`, color: copiedKey === `zone_${order.id}` ? "#22c55e" : "rgba(255,255,255,0.4)", lineHeight: 1, fontWeight: 700 }}>
                                {copiedKey === `zone_${order.id}` ? "✓" : "⎘"}
                              </button>
                            </span>
                          )}
                        </div>
                        {order.note && order.note !== "Paid via wallet" && <div className="text-gray-500 text-xs mt-0.5 truncate">{order.note}</div>}
                        <div className="text-gray-600 text-xs mt-0.5 flex items-center gap-2">
                          <span className="font-mono text-gray-500">#{`SKY-${String(order.id).padStart(5,"0")}`}</span>
                          <span>·</span>
                          <span>{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value, order.note)}
                          className="text-xs px-2 py-1 rounded-lg outline-none font-bold"
                          style={{
                            background: order.status === "completed" ? "rgba(34,197,94,0.15)" : order.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                            color: order.status === "completed" ? "#22c55e" : order.status === "failed" ? "#ef4444" : "#f59e0b",
                            border: "none",
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                          <option value="failed">Failed</option>
                        </select>
                        <button onClick={() => deleteOrder(order.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs">🗑️</button>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}

              {/* ── FEATURED TAB ── */}

              {/* ── SETTINGS TAB ── */}
              {tab === "settings" && (
                <div className="flex flex-col gap-5" style={{ flex: 1, overflowY: "auto", padding: 20 }}>

                  {/* Latest Event Popup */}
                  <div>
                    <div className="text-white font-bold text-sm mb-1">Latest Event Popup</div>
                    <div className="text-gray-400 text-xs">Upload a 16:9 image for the popup shown to users on first visit. When enabled, users see it once per session with "Later" and "Shop Now" buttons.</div>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {/* Enable toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-semibold">Show popup</span>
                      <button
                        onClick={() => setLatestEvent(prev => ({ ...prev, enabled: !prev.enabled }))}
                        className="relative flex-shrink-0"
                        style={{ width: 44, height: 24, borderRadius: 12, background: latestEvent.enabled ? "#f59e0b" : "rgba(255,255,255,0.1)", border: `1px solid ${latestEvent.enabled ? "#d97706" : "rgba(255,255,255,0.15)"}`, transition: "all 0.2s", cursor: "pointer", padding: 0 }}
                      >
                        <span style={{ position: "absolute", top: 3, left: latestEvent.enabled ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", display: "block" }} />
                      </button>
                    </div>

                    {/* Image upload */}
                    <div className="flex flex-col gap-2">
                      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Event Image (16:9)</span>
                      {latestEvent.image && (
                        <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 10, overflow: "hidden", background: "#000", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <img src={latestEvent.image} alt="Event preview" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                      )}
                      <input
                        ref={latestEventImgRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setLatestEventUploading(true);
                          await uploadImage(file, url => setLatestEvent(prev => ({ ...prev, image: url })));
                          setLatestEventUploading(false);
                          if (latestEventImgRef.current) latestEventImgRef.current.value = "";
                        }}
                      />
                      <button
                        onClick={() => latestEventImgRef.current?.click()}
                        disabled={latestEventUploading}
                        className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                        style={{ background: "rgba(245,158,11,0.09)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", cursor: latestEventUploading ? "default" : "pointer", opacity: latestEventUploading ? 0.6 : 1 }}
                      >
                        {latestEventUploading && <span style={{ width: 13, height: 13, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
                        {latestEventUploading ? "Uploading…" : latestEvent.image ? "Replace Image" : "Upload Image"}
                      </button>
                      {latestEvent.image && (
                        <button
                          onClick={() => setLatestEvent(prev => ({ ...prev, image: "" }))}
                          className="w-full py-2 rounded-xl text-xs font-bold transition-all"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer" }}
                        >
                          Remove Image
                        </button>
                      )}
                    </div>

                    {/* Target category */}
                    <div className="flex flex-col gap-2">
                      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">"Shop Now" Destination</span>
                      <select
                        value={latestEvent.targetCategory}
                        onChange={e => setLatestEvent(prev => ({ ...prev, targetCategory: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        <option value="">Packages Home</option>
                        {games.map(g => (
                          <option key={g.id} value={`game:${g.id}`}>{g.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Save button */}
                    <button
                      onClick={() => saveLatestEvent(latestEvent)}
                      disabled={latestEventSaving}
                      className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      style={{
                        background: latestEventSaved ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.1)",
                        border: `1px solid ${latestEventSaved ? "rgba(34,197,94,0.4)" : "rgba(245,158,11,0.3)"}`,
                        color: latestEventSaved ? "#4ade80" : "#f59e0b",
                        cursor: latestEventSaving ? "default" : "pointer",
                        opacity: latestEventSaving ? 0.6 : 1,
                      }}
                    >
                      {latestEventSaving && <span style={{ width: 13, height: 13, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
                      {latestEventSaved ? "✓ Saved!" : latestEventSaving ? "Saving…" : "Save Latest Event"}
                    </button>
                  </div>

                  {/* Email Test */}
                  <div>
                    <div className="text-white font-bold text-sm mb-1">Email Notifications</div>
                    <div className="text-gray-400 text-xs">Send a test email to verify your notification setup is working correctly.</div>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <button
                      onClick={sendTestEmail}
                      disabled={emailTestState === "sending"}
                      className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      style={{
                        background: emailTestState === "ok"
                          ? "rgba(34,197,94,0.15)"
                          : emailTestState === "error"
                          ? "rgba(239,68,68,0.12)"
                          : "rgba(245,158,11,0.1)",
                        border: `1px solid ${emailTestState === "ok" ? "rgba(34,197,94,0.4)" : emailTestState === "error" ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.3)"}`,
                        color: emailTestState === "ok" ? "#4ade80" : emailTestState === "error" ? "#f87171" : "#f59e0b",
                        cursor: emailTestState === "sending" ? "default" : "pointer",
                        opacity: emailTestState === "sending" ? 0.6 : 1,
                      }}
                    >
                      {emailTestState === "sending" && <span style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
                      {emailTestState === "ok" ? "✓ Test Email Sent!" : emailTestState === "error" ? "✕ Failed — Try Again" : emailTestState === "sending" ? "Sending…" : "📧 Send Test Email"}
                    </button>
                    {emailTestState === "ok" && (
                      <div className="text-green-400 text-xs text-center">Check your inbox — email notifications are working!</div>
                    )}
                    {emailTestState === "error" && emailTestError && (
                      <div className="text-red-400 text-xs text-center">{emailTestError}</div>
                    )}
                  </div>

                  {/* Notification Pipeline Test */}
                  <div>
                    <div className="text-white font-bold text-sm mb-1">Notification Pipeline Diagnostic</div>
                    <div className="text-gray-400 text-xs">Runs the full email pipeline and shows exactly where it succeeds or fails. Use this to debug issues on any device.</div>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <button
                      onClick={runPipelineTest}
                      disabled={pipelineState === "running"}
                      className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      style={{
                        background: "rgba(56,189,248,0.1)",
                        border: "1px solid rgba(56,189,248,0.3)",
                        color: "#38bdf8",
                        cursor: pipelineState === "running" ? "default" : "pointer",
                        opacity: pipelineState === "running" ? 0.6 : 1,
                      }}
                    >
                      {pipelineState === "running" && <span style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
                      {pipelineState === "running" ? "Running…" : "🧪 Run Notification Diagnostic"}
                    </button>

                    {pipelineState === "done" && pipelineResult && (
                      <div className="flex flex-col gap-2 mt-1">
                        {/* Env vars */}
                        {pipelineResult.env && (
                          <div className="rounded-lg p-3 flex flex-col gap-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Environment</div>
                            {Object.entries(pipelineResult.env).map(([k, v]: any) => (
                              <div key={k} className="flex justify-between items-center gap-2">
                                <span className="text-gray-400 text-xs font-mono">{k}</span>
                                <span className="text-xs font-mono" style={{ color: String(v).includes("NOT SET") ? "#f87171" : "#4ade80" }}>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Owner email result */}
                        {pipelineResult.ownerEmail && (
                          <div className="rounded-lg p-3 flex items-center justify-between gap-2" style={{ background: pipelineResult.ownerEmail.ok ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)", border: `1px solid ${pipelineResult.ownerEmail.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                            <span className="text-xs font-medium" style={{ color: pipelineResult.ownerEmail.ok ? "#4ade80" : "#f87171" }}>
                              {pipelineResult.ownerEmail.ok ? "✓ Owner email sent" : "✕ Owner email failed"}
                            </span>
                            {pipelineResult.ownerEmail.error && <span className="text-red-400 text-xs">{pipelineResult.ownerEmail.error}</span>}
                            {pipelineResult.ownerEmail.sentTo && <span className="text-gray-400 text-xs">{pipelineResult.ownerEmail.sentTo}</span>}
                          </div>
                        )}

                        {/* Staff email results */}
                        {pipelineResult.staffEmails && pipelineResult.staffEmails.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {pipelineResult.staffEmails.map((s: any, i: number) => (
                              <div key={i} className="rounded-lg p-3 flex items-center justify-between gap-2" style={{ background: s.ok === true ? "rgba(34,197,94,0.07)" : s.ok === false ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)", border: `1px solid ${s.ok === true ? "rgba(34,197,94,0.2)" : s.ok === false ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                                <span className="text-xs" style={{ color: s.ok === true ? "#4ade80" : s.ok === false ? "#f87171" : "#9ca3af" }}>
                                  {s.ok === true ? `✓ ${s.name}` : s.ok === false ? `✕ ${s.name}` : `– ${s.name} (skipped)`}
                                </span>
                                {s.error && <span className="text-red-400 text-xs">{s.error}</span>}
                                {s.skipped && <span className="text-gray-500 text-xs">{s.skipped}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Top-level error */}
                        {pipelineResult.error && (
                          <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                            <span className="text-red-400 text-xs">{pipelineResult.error}</span>
                          </div>
                        )}

                        {/* Step log */}
                        {pipelineResult.steps && pipelineResult.steps.length > 0 && (
                          <div className="rounded-lg p-3 flex flex-col gap-1" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Step Log</div>
                            {pipelineResult.steps.map((s: string, i: number) => (
                              <div key={i} className="text-xs font-mono" style={{ color: s.includes("FAILED") || s.includes("NOT SET") ? "#f87171" : s.includes("SUCCESS") ? "#4ade80" : "#6b7280" }}>{s}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Category Panel Availability */}
                  <div>
                    <div className="text-white font-bold text-sm mb-1">Category Panel Availability</div>
                    <div className="text-gray-400 text-xs">Switch each storefront panel between Available and Coming Soon. Changes apply instantly to all visitors.</div>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {games.length === 0 ? (
                      <div className="text-gray-500 text-xs text-center py-2">No games yet — add games in the Games tab first.</div>
                    ) : games.map((game, gi) => {
                      const GAME_COLORS = ["#38bdf8","#f59e0b","#a855f7","#22c55e","#ec4899","#f5c842","#6366f1","#14b8a6"];
                      const color = GAME_COLORS[gi % GAME_COLORS.length];
                      const key = String(game.id);
                      const status = categoryAvailability[key] ?? "available";
                      const isAvail = status === "available";
                      return (
                        <div key={key} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {game.image ? (
                              <img src={game.image} alt={game.name} style={{ width: 22, height: 22, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            )}
                            <span className="text-white text-sm font-medium">{game.name}</span>
                          </div>
                          <button
                            disabled={catAvailSaving}
                            onClick={async () => {
                              const updated = { ...categoryAvailability, [key]: isAvail ? "out_of_stock" : "available" };
                              setCategoryAvailability(updated);
                              await saveCategoryAvailability(updated);
                            }}
                            style={{
                              background: isAvail ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                              border: `1px solid ${isAvail ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.35)"}`,
                              color: isAvail ? "#4ade80" : "#f87171",
                              padding: "4px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                              cursor: catAvailSaving ? "default" : "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            {isAvail ? "✓ Available" : "Out of Stock"}
                          </button>
                        </div>
                      );
                    })}
                    {catAvailSaved && <div className="text-center text-green-400 text-xs font-bold pt-1">✓ Saved!</div>}
                  </div>

                  <div>
                    <div className="text-white font-bold text-sm mb-1">QR Code Management</div>
                    <div className="text-gray-400 text-xs">Upload a new UPI QR code. It will replace the one shown on the payment page instantly.</div>
                  </div>

                  {/* Current QR */}
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="text-amber-400 text-xs font-bold uppercase tracking-wider">Current QR Code</div>
                    <div className="flex justify-center">
                      <div style={{ background: "#fff", borderRadius: 12, padding: 12, display: "inline-flex" }}>
                        <img
                          src={qrCurrent || "/upi-qr.jpg"}
                          alt="Current QR"
                          style={{ width: 160, height: 160, objectFit: "contain", borderRadius: 6, display: "block" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Upload new QR */}
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="text-amber-400 text-xs font-bold uppercase tracking-wider">Upload New QR</div>
                    <input
                      ref={qrInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleQrFile}
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => qrInputRef.current?.click()}
                      className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "rgba(245,158,11,0.1)", border: "2px dashed rgba(245,158,11,0.35)", color: "#f59e0b" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {qrPreview ? "Change Image" : "Choose QR Image"}
                    </button>

                    {qrPreview && (
                      <>
                        <div className="text-gray-400 text-xs text-center">Preview of new QR</div>
                        <div className="flex justify-center">
                          <div style={{ background: "#fff", borderRadius: 12, padding: 12, display: "inline-flex" }}>
                            <img src={qrPreview} alt="New QR Preview" style={{ width: 160, height: 160, objectFit: "contain", borderRadius: 6, display: "block" }} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveQr}
                            disabled={qrSaving}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black"
                            style={{ background: qrSaving ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                          >
                            {qrSaving ? "Saving…" : "Save New QR"}
                          </button>
                          <button
                            onClick={() => { setQrPreview(null); if (qrInputRef.current) qrInputRef.current.value = ""; }}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-400"
                            style={{ background: "#222" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}

                    {qrSaved && (
                      <div className="text-center text-green-400 text-sm font-bold py-1">✓ QR updated successfully!</div>
                    )}
                  </div>

                  {/* Admin UPI ID */}
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="text-amber-400 text-xs font-bold uppercase tracking-wider">Admin UPI ID</div>
                    <div className="text-gray-400 text-xs">Your UPI ID shown to customers as the fallback when no staff QR is active.</div>
                    <input
                      value={adminUpiId}
                      onChange={e => setAdminUpiId(e.target.value)}
                      placeholder="e.g. yourname@upi"
                      className="px-3 py-2 rounded-lg text-white text-sm outline-none font-mono"
                      style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                    <button
                      onClick={saveAdminUpiId}
                      disabled={adminUpiSaving}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-black"
                      style={{ background: adminUpiSaving ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                    >
                      {adminUpiSaving ? "Saving…" : adminUpiSaved ? "✓ Saved!" : "Save UPI ID"}
                    </button>
                  </div>

                  {/* Trustpilot Settings */}
                  <div>
                    <div className="text-white font-bold text-sm mb-1">Trustpilot Button</div>
                    <div className="text-gray-400 text-xs">Show or hide a "Review us on Trustpilot" button in the footer, and set the link.</div>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300 font-semibold">Show Trustpilot Button</span>
                      <button
                        onClick={() => setTrustpilotEnabled(e => !e)}
                        className="relative flex-shrink-0 transition-all"
                        style={{ width: 44, height: 24, borderRadius: 999, background: trustpilotEnabled ? "#00b67a" : "rgba(255,255,255,0.1)", border: `1px solid ${trustpilotEnabled ? "#00b67a" : "rgba(255,255,255,0.15)"}`, cursor: "pointer" }}
                      >
                        <span style={{ position: "absolute", top: 2, left: trustpilotEnabled ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.18s ease", display: "block" }} />
                      </button>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Trustpilot URL</div>
                      <input
                        value={trustpilotUrl}
                        onChange={(e) => setTrustpilotUrl(e.target.value)}
                        placeholder="https://www.trustpilot.com/review/..."
                        className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                    <button
                      onClick={saveTrustpilot}
                      disabled={trustpilotSaving}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-black"
                      style={{ background: trustpilotSaving ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                    >
                      {trustpilotSaving ? "Saving…" : trustpilotSaved ? "✓ Saved!" : "Save Trustpilot Settings"}
                    </button>
                  </div>

                  {/* Community Links */}
                  <div>
                    <div className="text-white font-bold text-sm mb-1">Community Links</div>
                    <div className="text-gray-400 text-xs">Links for the WhatsApp and Instagram buttons on the home page community section.</div>
                  </div>
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">WhatsApp Group Link</div>
                      <input
                        value={communityWhatsapp}
                        onChange={(e) => setCommunityWhatsapp(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Instagram Channel Link</div>
                      <input
                        value={communityInstagram}
                        onChange={(e) => setCommunityInstagram(e.target.value)}
                        placeholder="https://www.instagram.com/..."
                        className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                    <button
                      onClick={saveCommunityLinks}
                      disabled={communitySaving}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-black"
                      style={{ background: communitySaving ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#fbbf24,#f59e0b)" }}
                    >
                      {communitySaving ? "Saving…" : communitySaved ? "✓ Saved!" : "Save Community Links"}
                    </button>
                  </div>

                </div>
              )}

              {/* ── STAFF TAB ── */}
              {tab === "staff" && (
                <div className="flex flex-col gap-4" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                  {/* Staff Portal shortcut */}
                  <button
                    onClick={() => { onClose(); setLocation("/staff"); }}
                    className="w-full rounded-xl p-3 flex items-center justify-between gap-3 text-left"
                    style={{ background: "#1a1a1a", border: "1px solid rgba(99,102,241,0.35)", cursor: "pointer" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 36, height: 36, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white font-bold text-sm">Open Staff Portal</span>
                        <span className="text-xs" style={{ color: "rgba(165,180,252,0.7)" }}>View & fulfil orders as staff</span>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>

                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Recharge Staff</span>
                    <button onClick={() => setShowAddStaff(v => !v)} className="px-4 py-2 rounded-xl text-xs font-bold text-black" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>+ Add Staff</button>
                  </div>
                  <div className="text-gray-400 text-xs">Set staff as "Available" to receive orders. Their QR is shown to customers on the payment page.</div>

                  {/* Order Search */}
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="text-amber-400 text-xs font-bold">Order Search</div>
                    <div className="flex gap-2">
                      <input placeholder="Search by Order ID, MLBB ID, IGN…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchOrders()} className="flex-1 px-3 py-2 rounded-lg text-white text-xs outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <select value={orderSearchStatus} onChange={e => setOrderSearchStatus(e.target.value)} className="px-2 py-2 rounded-lg text-white text-xs outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button onClick={searchOrders} disabled={searching} className="px-3 py-2 rounded-lg text-xs font-bold text-black" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)", flexShrink: 0 }}>{searching ? "…" : "Search"}</button>
                    </div>
                    {searchResults && (
                      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                        {searchResults.length === 0 ? (
                          <div className="text-gray-500 text-xs text-center py-3">No results found.</div>
                        ) : searchResults.map(o => (
                          <div key={o.id} className="rounded-lg p-3" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-amber-400 font-bold text-xs font-mono">{(o as any).display_id || `#${o.id}`}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: o.status === "completed" ? "rgba(34,197,94,0.12)" : o.status === "pending" ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.06)", color: o.status === "completed" ? "#22c55e" : o.status === "pending" ? "#f59e0b" : "#9ca3af" }}>{o.status}</span>
                            </div>
                            <div className="text-gray-300 text-xs mt-1 flex items-center gap-1"><img src="/diamond.png" alt="♦" style={{ width: 11, height: 11, objectFit: "contain" }} />{Number(o.diamonds).toLocaleString()} · ₹{parseFloat(o.price).toFixed(0)}</div>
                            {o.mlbb_id && <div className="text-gray-500 text-xs mt-0.5">MLBB: {o.mlbb_id}</div>}
                            {(o as any).staff_name && <div className="text-gray-500 text-xs mt-0.5">Staff: {(o as any).staff_name}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {showAddStaff && (
                    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <div className="text-amber-400 text-sm font-bold">New Staff Member</div>
                      <input placeholder="Name *" value={newStaff.name} onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <input placeholder="Email (for order notifications)" value={newStaff.email} onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <input placeholder="WhatsApp number" value={newStaff.whatsapp} onChange={e => setNewStaff(s => ({ ...s, whatsapp: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <input placeholder="UPI ID (e.g. 9876543210@upi)" value={newStaff.upi_id} onChange={e => setNewStaff(s => ({ ...s, upi_id: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none font-mono" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <input placeholder="Shift hours (e.g. 9AM–6PM)" value={newStaff.shift_hours} onChange={e => setNewStaff(s => ({ ...s, shift_hours: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <input placeholder="Staff PIN (for staff portal login)" value={newStaff.pin} onChange={e => setNewStaff(s => ({ ...s, pin: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none font-mono" style={{ background: "#111", border: "1px solid rgba(245,158,11,0.25)" }} />
                      <select value={newStaff.status} onChange={e => setNewStaff(s => ({ ...s, status: e.target.value }))} className="px-3 py-2 rounded-lg text-white text-sm outline-none" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <option value="offline">Offline</option>
                        <option value="available">Available</option>
                      </select>
                      <div>
                        <div className="text-gray-400 text-xs mb-1.5">QR Code (customer pays to this QR)</div>
                        <input ref={staffQrRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setStaffQrFile(f); const r = new FileReader(); r.onload = ev2 => setStaffQrPreview(ev2.target?.result as string); r.readAsDataURL(f); } }} className="text-gray-300 text-xs" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px", width: "100%" }} />
                        {staffQrPreview && <img src={staffQrPreview} alt="QR preview" className="mt-2 rounded-lg" style={{ maxWidth: 120, maxHeight: 120, objectFit: "contain" }} />}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={addStaff} disabled={staffSaving} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-black" style={{ background: staffSaving ? "rgba(245,158,11,0.5)" : "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>{staffSaving ? "Saving…" : "Add Staff"}</button>
                        <button onClick={() => setShowAddStaff(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-gray-300" style={{ background: "#222", border: "1px solid rgba(255,255,255,0.1)" }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {staffList.length === 0 && !showAddStaff && (
                    <div className="text-center text-gray-500 text-sm py-8">No staff yet. Add your coworkers!</div>
                  )}

                  {staffList.map((s) => (
                    <div key={s.id} className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "#1a1a1a", border: `1px solid ${s.status === "available" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.07)"}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold text-sm">{s.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: s.status === "available" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", color: s.status === "available" ? "#22c55e" : "#9ca3af" }}>{s.status === "available" ? "● Available" : "○ Offline"}</span>
                          </div>
                          {s.shift_hours && <div className="text-gray-500 text-xs mt-0.5">⏰ {s.shift_hours}</div>}
                          <button onClick={() => setRevealedStaff(prev => ({ ...prev, [s.id]: !prev[s.id] }))} className="text-xs mt-1.5 px-2 py-0.5 rounded" style={{ background: revealedStaff[s.id] ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.06)", color: revealedStaff[s.id] ? "#f59e0b" : "rgba(255,255,255,0.4)", border: `1px solid ${revealedStaff[s.id] ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, cursor: "pointer" }}>
                            {revealedStaff[s.id] ? "🔒 Hide Details" : "🔓 Reveal Details"}
                          </button>
                          {revealedStaff[s.id] && (
                            <div className="mt-1.5 flex flex-col gap-1">
                              {s.email && <div className="text-gray-400 text-xs">✉ {s.email}</div>}
                              {s.whatsapp && <div className="text-gray-400 text-xs">📱 {s.whatsapp}</div>}
                              {s.staff_pin && <div className="text-gray-600 text-xs">🔐 Portal PIN: <span className="font-mono text-amber-600">{s.staff_pin}</span></div>}
                              {s.qr_image && (
                                <div className="mt-1">
                                  <img src={s.qr_image} alt="QR" className="rounded-lg" style={{ maxWidth: 100, maxHeight: 100, objectFit: "contain" }} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                          <button onClick={() => toggleStaffStatus(s.id, s.status)} className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: s.status === "available" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)", color: s.status === "available" ? "#ef4444" : "#22c55e", border: `1px solid ${s.status === "available" ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}` }}>{s.status === "available" ? "Set Offline" : "Set Available"}</button>
                          <button onClick={() => deleteStaff(s.id)} className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>Remove</button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}

              {/* ── WALLET TAB ── */}
              {tab === "wallet" && (
                <div className="flex flex-col gap-4" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Top-up Requests</span>
                    <button onClick={fetchWalletRequests} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>Refresh</button>
                  </div>

                  {walletRequests.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-8">No wallet requests yet.</div>
                  )}

                  {walletRequests.map((req) => {
                    const isPending = req.status === "pending";
                    const isProcessing = walletLoading === req.id;
                    const statusColor = req.status === "approved" ? "#22c55e" : req.status === "rejected" ? "#ef4444" : "#f59e0b";
                    return (
                      <div key={req.id} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "#1a1a1a", border: `1px solid ${isPending ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)"}` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-bold text-sm">S {parseFloat(req.amount).toFixed(0)}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: statusColor + "20", color: statusColor }}>{req.status}</span>
                            </div>
                            <div className="text-gray-300 text-xs mt-1 font-semibold">{req.display_name || req.clerk_user_id.slice(0, 14) + "…"}</div>
                            {req.upi_ref && (
                              <div className="text-gray-300 text-xs mt-1">Request ID: <span className="font-mono font-semibold text-amber-300">{req.upi_ref}</span></div>
                            )}
                            <div className="text-gray-600 text-xs mt-1">{new Date(req.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        </div>
                        {isPending && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveWallet(req.id)}
                              disabled={isProcessing}
                              className="flex-1 py-2 rounded-lg text-xs font-bold text-black"
                              style={{ background: isProcessing ? "rgba(34,197,94,0.4)" : "#22c55e" }}
                            >
                              {isProcessing ? "Processing…" : "Approve & Credit"}
                            </button>
                            <button
                              onClick={() => rejectWallet(req.id)}
                              disabled={isProcessing}
                              className="flex-1 py-2 rounded-lg text-xs font-bold"
                              style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── BANNERS TAB ── */}
              {tab === "banners" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40, flex: 1, overflowY: "auto", padding: 20 }}>

                  {/* Add New Banner — always on top */}
                  {promoBanners.length < 5 ? (
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: "20px 18px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="text-amber-400 text-sm font-bold mb-5">Add New Banner ({promoBanners.length}/5)</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                          <div className="text-gray-400 text-xs mb-2">Media type</div>
                          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            {(["file", "url"] as const).map(t => (
                              <button key={t} onClick={() => setBannerMediaType(t)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, background: bannerMediaType === t ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", border: bannerMediaType === t ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.1)", color: bannerMediaType === t ? "#f59e0b" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                {t === "file" ? "Upload File" : "Paste URL"}
                              </button>
                            ))}
                          </div>
                          {bannerMediaType === "file" ? (
                            <>
                              <div className="text-gray-400 text-xs mb-2">Image or video file (21:9 ratio recommended, e.g. 1280×549 px)</div>
                              <label style={{ display: "block", cursor: "pointer" }}>
                                <div style={{ background: "rgba(255,255,255,0.05)", border: "1.5px dashed rgba(255,255,255,0.18)", borderRadius: 12, padding: "18px 16px", textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                                  <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
                                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Tap to choose a file</div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Images: JPG, PNG, WebP · Videos: MP4, WebM, MOV</div>
                                  {bannerFileName && (
                                    <div style={{ marginTop: 10, color: "#f59e0b", fontWeight: 600, fontSize: 12 }}>
                                      ✓ {bannerFileName}
                                    </div>
                                  )}
                                </div>
                                <input ref={promoBannerImgRef} type="file" accept="image/*,video/*,.mp4,.webm,.mov,.ogg" style={{ display: "none" }} onChange={e => setBannerFileName(e.target.files?.[0]?.name ?? "")} />
                              </label>
                            </>
                          ) : (
                            <>
                              <div className="text-gray-400 text-xs mb-2">Paste a direct image or video URL (.jpg, .png, .mp4, .webm…)</div>
                              <input value={bannerMediaUrl} onChange={e => setBannerMediaUrl(e.target.value)} placeholder="https://cdn.example.com/banner.mp4" className="px-3 py-2.5 rounded-lg text-white text-sm outline-none w-full" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                            </>
                          )}
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs mb-2">Link when tapped (optional)</div>
                          <select value={bannerLinkType} onChange={e => setBannerLinkType(e.target.value as "url"|"game"|"packages")} className="px-3 py-2.5 rounded-lg text-white text-sm outline-none w-full mb-2.5" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <option value="url">Custom URL</option>
                            <option value="game">Specific Game Page</option>
                            <option value="packages">Browse Packages Page</option>
                          </select>
                          {bannerLinkType === "url" && (
                            <input value={newBannerLink} onChange={e => setNewBannerLink(e.target.value)} placeholder="e.g. /packages or https://..." className="px-3 py-2.5 rounded-lg text-white text-sm outline-none w-full" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }} />
                          )}
                          {bannerLinkType === "game" && (
                            <select value={bannerLinkGameId} onChange={e => setBannerLinkGameId(e.target.value)} className="px-3 py-2.5 rounded-lg text-white text-sm outline-none w-full" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                              <option value="">Select a game…</option>
                              {games.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                            </select>
                          )}
                          {bannerLinkType === "packages" && (
                            <div className="text-gray-500 text-xs py-1">Banner will link to the Packages page.</div>
                          )}
                        </div>
                        {uploadProgress !== null && (
                          <div style={{ borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.06)", height: 6 }}>
                            <div style={{ height: "100%", background: "linear-gradient(90deg,#6366f1,#a5b4fc)", width: `${uploadProgress}%`, transition: "width 0.3s ease", borderRadius: 8 }} />
                          </div>
                        )}
                        <button onClick={addPromoBanner} disabled={promoBannersSaving || uploadProgress !== null} className="py-3 rounded-xl text-sm font-bold text-black" style={{ background: (promoBannersSaving || uploadProgress !== null) ? "rgba(245,158,11,0.5)" : "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>
                          {uploadProgress !== null ? `Uploading ${uploadProgress}%…` : promoBannersSaving ? "Saving…" : "Upload & Add Banner"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-xs text-center py-3" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>Maximum 5 banners reached. Delete one to add more.</div>
                  )}

                  {/* Promo Banners list — below the form */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: "18px 18px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="text-amber-400 text-sm font-bold mb-1">Promo Banners</div>
                    <div className="text-gray-500 text-xs mb-4">Upload up to 5 promotional images (21:9 ratio recommended, e.g. 1280×549 px). Shown as a carousel at the top of the homepage.</div>
                    {promoBanners.length === 0 ? (
                      <div className="text-gray-500 text-xs py-4 text-center">No banners yet. Add one above.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {promoBanners.map((b, i) => (
                          <div key={b.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
                            {/\.(mp4|webm|ogg|mov)(\?|$)/i.test(b.image) ? (
                              <video src={b.image} muted style={{ width: 60, height: Math.round(60 / 21 * 9), objectFit: "cover", borderRadius: 6, flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" }} />
                            ) : (
                              <img src={b.image} alt="" style={{ width: 60, height: Math.round(60 / 21 * 9), objectFit: "cover", borderRadius: 6, flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="text-gray-400 text-xs truncate mb-1.5">{b.link || "(no link)"}</div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => savePromoBanners(promoBanners.map((x, j) => j === i ? { ...x, active: !x.active } : x))} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, background: b.active ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)", color: b.active ? "#22c55e" : "#9ca3af", border: "none", cursor: "pointer" }}>{b.active ? "Active" : "Hidden"}</button>
                                <button onClick={() => savePromoBanners(promoBanners.filter((_, j) => j !== i))} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none", cursor: "pointer" }}>Delete</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── STORE STATS TAB ── */}
              {tab === "offer-banners" && (
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ color: "#f59e0b", fontSize: 14, fontWeight: 700 }}>Daily Offer Packages</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{dailyOfferIds.length}/10 selected</div>
                  </div>

                  {dailyOfferIds.length > 0 && (
                    <div style={{ background: "rgba(245,158,11,0.06)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{dailyOfferIds.length} package{dailyOfferIds.length > 1 ? "s" : ""} showing in Daily Offers</div>
                      <button
                        onClick={() => saveDailyOfferIds([])}
                        style={{ padding: "4px 12px", borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                      >Clear All</button>
                    </div>
                  )}

                  {offerSelectedGameId === null ? (
                    <>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Tap a game to browse its packages:</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                        {games.map(g => (
                          <button
                            key={g.id}
                            onClick={() => { setOfferSelectedGameId(g.id); fetchOfferGamePkgs(g.id); }}
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 6px 10px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}
                          >
                            {g.image
                              ? <img src={g.image} alt="" style={{ width: 50, height: 50, borderRadius: 11, objectFit: "cover" }} />
                              : <div style={{ width: 50, height: 50, borderRadius: 11, background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="3" stroke="rgba(139,92,246,0.7)" strokeWidth="1.5"/><path d="M7 12h4m-2-2v4M15 12h2" stroke="rgba(139,92,246,0.7)" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
                            }
                            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 9.5, fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>{g.name}</span>
                          </button>
                        ))}
                        {games.length === 0 && (
                          <div style={{ gridColumn: "1/-1", color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", padding: 20 }}>No games found.</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          onClick={() => { setOfferSelectedGameId(null); setOfferGamePkgs([]); }}
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 12px", color: "rgba(255,255,255,0.65)", fontSize: 12, cursor: "pointer" }}
                        >← Back</button>
                        <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{games.find(g => g.id === offerSelectedGameId)?.name}</span>
                      </div>

                      {offerPkgLoading ? (
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", padding: 24 }}>Loading packages…</div>
                      ) : offerGamePkgs.length === 0 ? (
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", padding: 24 }}>No packages found for this game.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {offerGamePkgs.map(pkg => {
                            const isSelected = dailyOfferIds.includes(pkg.id);
                            const atMax = !isSelected && dailyOfferIds.length >= 10;
                            const total = pkg.diamonds + (pkg.bonus_diamonds || 0);
                            const label = pkg.name || `${total.toLocaleString()} Diamonds`;
                            return (
                              <div key={pkg.id} style={{ background: isSelected ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.04)", border: isSelected ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: atMax ? 0.5 : 1 }}>
                                {pkg.image
                                  ? <img src={pkg.image} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
                                  : <div style={{ width: 38, height: 38, borderRadius: 9, background: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 9l10 13L22 9z" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round"/></svg></div>
                                }
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                                  <div style={{ fontSize: 10, display: "flex", gap: 5, alignItems: "center" }}>
                                    {pkg.old_price && parseFloat(pkg.old_price) > parseFloat(pkg.price) && (
                                      <span style={{ color: "rgba(255,255,255,0.35)", textDecoration: "line-through" }}>₹{parseFloat(pkg.old_price).toFixed(0)}</span>
                                    )}
                                    <span style={{ color: "#f59e0b", fontWeight: 800 }}>₹{parseFloat(pkg.price).toFixed(0)}</span>
                                  </div>
                                </div>
                                <button
                                  disabled={atMax || dailyOfferSaving}
                                  onClick={() => toggleDailyOffer(pkg.id)}
                                  style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: isSelected ? "rgba(239,68,68,0.18)" : "rgba(139,92,246,0.2)", color: isSelected ? "#f87171" : "#a78bfa", fontSize: 11, fontWeight: 800, cursor: atMax ? "not-allowed" : "pointer", flexShrink: 0 }}
                                >{isSelected ? "Remove" : "Add"}</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {dailyOfferSaved && (
                    <div style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, textAlign: "center" }}>✓ Saved</div>
                  )}
                </div>
              )}

              {tab === "stats" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                  <div style={{ flexShrink: 0, padding: "20px 20px 12px", background: "#111", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="text-amber-400 text-sm font-bold" style={{ marginBottom: 12 }}>Store Statistics</div>
                    {stats && (
                      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 16 }}>
                        {[
                          { label: "Total Orders", value: stats.total_orders, icon: "📦" },
                          { label: "Revenue", value: `₹${parseFloat(stats.total_revenue).toFixed(0)}`, icon: "💰" },
                          { label: "Products Sold", value: parseInt(stats.total_diamonds).toLocaleString(), icon: "🛒" },
                          { label: "Happy Gamers", value: storeStats ? String(storeStats.total_users) : "—", icon: "⭐" },
                        ].map(s => (
                          <div key={s.label} className="rounded-xl p-3 flex flex-col items-center gap-1.5" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <div style={{ fontSize: 20 }}>{s.icon}</div>
                            <div className="text-white font-bold text-lg">{s.value}</div>
                            <div className="text-gray-400 text-xs text-center">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-white font-bold text-sm">⚡ Recent Purchases</div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
                    {recentOrders.length === 0 ? (
                      <div className="text-gray-500 text-sm text-center py-6">No purchases yet.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {recentOrders.map((p, i) => {
                          const rawName = p.user_display_name || (p.mlbb_ign ?? "");
                          const name = rawName ? rawName[0].toUpperCase() + rawName.slice(1) + "***" : "A***";
                          const shouldSlide = name.length > 7;
                          const label = p.currency_label || "Diamonds";
                          const displayName = p.pack_name || `${Number(p.diamonds).toLocaleString()} ${label}`;
                          return (
                            <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <div className="flex items-center gap-0 min-w-0">
                                <div style={{ width: 68, flexShrink: 0, overflow: "hidden" }}>
                                  <span
                                    className="text-amber-400 font-bold text-sm"
                                    style={shouldSlide ? { display: "inline-block", whiteSpace: "nowrap", animation: "slideAdminName 3.5s ease-in-out infinite alternate" } : { display: "inline-block", whiteSpace: "nowrap" }}
                                  >{name}</span>
                                </div>
                                <span className="text-gray-400 text-sm"> bought </span>
                                <span className="text-white text-sm font-semibold ml-1">{displayName}</span>
                              </div>
                              <div className="text-gray-500 text-xs ml-2 flex-shrink-0">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
