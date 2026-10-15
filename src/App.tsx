import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings } from "lucide-react";
import CompassTab from "./components/CompassTab";
import DrawTab from "./components/DrawTab";
import { Gate } from "./components/Gate";
import { InstallBanner } from "./components/InstallBanner";
import { SettingsSheet } from "./components/SettingsSheet";
import { TabBar, type TabId } from "./components/TabBar";
import { useCompass } from "./hooks/useCompass";
import { useWakeLock } from "./hooks/useWakeLock";
import { buzz, loadFlag, saveFlag } from "./lib/haptics";

function initialTab(): TabId {
  try {
    if (window.location.hash === "#draw") return "draw";
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q === "draw") return "draw";
  } catch {
    /* ignore */
  }
  return "compass";
}

export default function App() {
  const compass = useCompass();
  const [booted, setBooted] = useState(false);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [haptics, setHaptics] = useState(() => loadFlag("bussola-haptics", true));
  const [wake, setWake] = useState(() => loadFlag("bussola-wake", true));

  useWakeLock(wake && booted);

  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 1600);
    return () => window.clearTimeout(t);
  }, []);

  const setHapticsPersist = (v: boolean) => {
    setHaptics(v);
    saveFlag("bussola-haptics", v);
    if (v) buzz(10);
  };
  const setWakePersist = (v: boolean) => {
    setWake(v);
    saveFlag("bussola-wake", v);
  };

  const showGate = booted && (compass.status === "idle" || compass.status === "denied");

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink text-parchment select-none">
      {/* ambient light */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brass/[0.07] blur-[110px]" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* app column */}
      <div className="relative z-10 flex h-full flex-col">
        <header
          className="flex items-center justify-between px-5"
          style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
        >
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.png"
              alt=""
              className="h-8 w-8 rounded-[10px] ring-1 ring-brass/30"
            />
            <div>
              <div className="font-display text-[19px] italic leading-none text-parchment">
                Bússola
              </div>
              <div className="mt-1 font-mono text-[7px] tracking-[0.46em] text-brass/70">
                DRAW · MMXXVI
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setSettingsOpen(true);
              if (haptics) buzz(6);
            }}
            className="glass flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
            aria-label="Settings"
          >
            <Settings size={15} className="text-parchment/75" />
          </button>
        </header>

        <main className="min-h-0 flex-1 pt-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              className="h-full"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "compass" ? (
                <CompassTab
                  heading={compass.heading}
                  accuracy={compass.accuracy}
                  status={compass.status}
                  source={compass.source}
                  nudge={compass.nudge}
                  haptics={haptics}
                />
              ) : (
                <DrawTab heading={compass.heading} haptics={haptics} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <TabBar
          tab={tab}
          onChange={(t) => {
            setTab(t);
            if (haptics) buzz(6);
            try {
              window.history.replaceState(null, "", t === "draw" ? "#draw" : "#compass");
            } catch {
              /* ignore */
            }
          }}
        />
      </div>

      {/* native install prompt (Android / Chromium) */}
      <InstallBanner />

      {/* permission gate */}
      <AnimatePresence>
        {showGate && (
          <Gate
            key="gate"
            status={compass.status}
            onEnable={compass.requestAccess}
            onSkip={compass.enterManual}
          />
        )}
      </AnimatePresence>

      {/* settings */}
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        haptics={haptics}
        setHaptics={setHapticsPersist}
        wake={wake}
        setWake={setWakePersist}
      />

      {/* film grain */}
      <div className="noise-layer pointer-events-none absolute inset-0 z-[90] opacity-[0.05] mix-blend-soft-light" />

      {/* splash */}
      <AnimatePresence>
        {!booted && (
          <motion.div
            key="splash"
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-ink"
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.img
              src="/icon.png"
              alt=""
              initial={{ scale: 0.75, opacity: 0, rotate: -16 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 190, damping: 19 }}
              className="h-24 w-24 rounded-[26px] shadow-dial ring-1 ring-brass/30"
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-7 text-center"
            >
              <div className="font-display text-[42px] italic leading-none text-parchment">
                Bússola
              </div>
              <div className="mt-3 font-mono text-[8.5px] tracking-[0.55em] text-brass/80">
                COMPASS & CHART TABLE
              </div>
            </motion.div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.9, ease: "easeOut" }}
              className="mt-6 h-px w-24 origin-left bg-gradient-to-r from-transparent via-brass/60 to-transparent"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
