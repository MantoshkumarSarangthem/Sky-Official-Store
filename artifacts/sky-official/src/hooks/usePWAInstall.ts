import { useState, useEffect, useRef } from "react";

/**
 * Captures the browser's beforeinstallprompt event and returns
 * an `install()` function plus a `canInstall` flag.
 *
 * Pass `manifestHref` to swap the <link rel="manifest"> on mount so
 * the browser installs the correct scoped PWA (admin / staff / default).
 * The original href is restored on unmount.
 */
export function usePWAInstall(manifestHref?: string) {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const deferredPrompt = useRef<any>(null);

  // Swap manifest link to the scoped one on mount, restore on unmount
  useEffect(() => {
    if (!manifestHref) return;
    const link = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (!link) return;
    const original = link.href;
    link.href = manifestHref;
    return () => {
      link.href = original;
    };
  }, [manifestHref]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanInstall(true);
    };

    const appInstalled = () => {
      deferredPrompt.current = null;
      setCanInstall(false);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const install = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt.current) return "unavailable";
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setCanInstall(false);
    if (outcome === "accepted") setInstalled(true);
    return outcome as "accepted" | "dismissed";
  };

  return { canInstall, installed, install };
}
