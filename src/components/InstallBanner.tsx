import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { getPlatform, isStandalone, useInstallPrompt } from "../lib/platform";
import { buzz, loadFlag, saveFlag } from "../lib/haptics";

const DISMISS_KEY = "bussola-install-off";

/**
 * Native-install banner (Android Chrome / desktop Chromium).
 * Only renders when the browser has actually offered installation
 * (beforeinstallprompt), so it never nags where install is impossible.
 */
export function InstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => loadFlag(DISMISS_KEY, false));
  const platform = getPlatform();

  const visible =
    canInstall && !dismissed && !isStandalone() && platform !== "ios";

  const close = () => {
    saveFlag(DISMISS_KEY, true);
    setDismissed(true);
    buzz(6);
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      buzz([12, 60, 18]);
    }
    saveFlag(DISMISS_KEY, true);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 1.1 } }}
          exit={{ opacity: 0, y: 28 }}
          className="fixed inset-x-0 z-[55] flex justify-center px-6"
          style={{ bottom: "calc(86px + env(safe-area-inset-bottom))" }}
        >
          <div className="glass-deep shadow-glass flex w-full max-w-[340px] items-center gap-3 rounded-2xl p-3">
            <img
              src="/icon.png"
              alt=""
              className="h-10 w-10 rounded-[12px] ring-1 ring-brass/30"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-parchment/95">
                Instalar Bússola Draw
              </div>
              <div className="mt-0.5 text-[10px] leading-snug text-fog">
                Offline, full-screen, with home-screen shortcuts.
              </div>
            </div>
            <button
              onClick={install}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brass px-4 transition-transform active:scale-95"
            >
              <Download size={13} className="text-ink" strokeWidth={2.5} />
              <span className="font-mono text-[9px] font-semibold tracking-[0.18em] text-ink">
                INSTALL
              </span>
            </button>
            <button
              onClick={close}
              aria-label="Dismiss"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fog transition-transform active:scale-90"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
