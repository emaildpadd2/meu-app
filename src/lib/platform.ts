import { useCallback, useSyncExternalStore } from "react";

export type Platform = "ios" | "android" | "desktop";

export function getPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
  ) {
    return "ios";
  }
  return "desktop";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)");
  return (
    mq?.matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    (typeof document !== "undefined" &&
      document.referrer.startsWith("android-app://")) // TWA
  );
}

/* ---------------------------------------------------------------------------
 * Native-install prompt (beforeinstallprompt) — a module-level singleton so
 * the banner and the settings sheet share the same deferred event.
 * ------------------------------------------------------------------------- */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => deferred !== null
  );

  const promptInstall = useCallback(async () => {
    const ev = deferred;
    if (!ev) return "unavailable" as const;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred = null;
    listeners.forEach((l) => l());
    return outcome;
  }, []);

  return { canInstall, promptInstall };
}
