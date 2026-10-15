import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Compass,
  Download,
  Infinity as InfinityIcon,
  MoreVertical,
  Plus,
  Share,
  Smartphone,
  Trash2,
  Vibrate,
  X,
  Zap,
} from "lucide-react";
import { buzz } from "../lib/haptics";
import { getPlatform, isStandalone, useInstallPrompt } from "../lib/platform";

interface Props {
  open: boolean;
  onClose: () => void;
  haptics: boolean;
  setHaptics: (v: boolean) => void;
  wake: boolean;
  setWake: (v: boolean) => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => {
        onChange(!on);
        buzz(6);
      }}
      className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors duration-200 ${
        on ? "bg-brass" : "bg-parchment/12"
      }`}
      aria-pressed={on}
    >
      <motion.span
        animate={{ x: on ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 550, damping: 32 }}
        className={`absolute left-[3px] top-[3px] h-[21px] w-[21px] rounded-full shadow ${
          on ? "bg-ink" : "bg-parchment/80"
        }`}
      />
    </button>
  );
}

function Row({
  Icon,
  title,
  desc,
  right,
}: {
  Icon: typeof Vibrate;
  title: string;
  desc: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 py-3.5">
      <div className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
        <Icon size={15} className="text-brass" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-parchment/90">{title}</div>
        <div className="mt-0.5 text-[10.5px] leading-snug text-fog">{desc}</div>
      </div>
      {right}
    </div>
  );
}

const Divider = () => <div className="h-px bg-parchment/[0.07]" />;

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[11.5px] text-parchment/80">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-parchment/10 font-mono text-[9px] text-brass">
        {n}
      </span>
      <span className="flex items-center gap-1.5">{children}</span>
    </div>
  );
}

export function SettingsSheet({ open, onClose, haptics, setHaptics, wake, setWake }: Props) {
  const [cleared, setCleared] = useState(false);
  const { canInstall, promptInstall } = useInstallPrompt();
  const platform = useMemo(() => getPlatform(), []);
  const standalone = useMemo(() => isStandalone(), []);

  const clearData = () => {
    try {
      localStorage.removeItem("bussola-chart-v1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("bussola:reset"));
    buzz([10, 40, 10]);
    setCleared(true);
    window.setTimeout(() => setCleared(false), 1800);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/70 backdrop-blur-[3px]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose();
            }}
            className="glass-deep absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-[26px] no-scrollbar"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 22px)" }}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-parchment/20" />

            <div className="flex items-start justify-between px-6 pt-4">
              <div>
                <div className="font-mono text-[8.5px] tracking-[0.32em] text-brass/80">
                  SHIP'S LOCKER
                </div>
                <div className="mt-1 font-display text-2xl italic text-parchment">
                  Instruments
                </div>
              </div>
              <button
                onClick={onClose}
                className="glass flex h-9 w-9 items-center justify-center rounded-full text-parchment/70 transition-transform active:scale-90"
                aria-label="Close settings"
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-6 pt-2">
              <Row
                Icon={Vibrate}
                title="Haptic ticks"
                desc="A pulse each time the needle crosses a point of the rose."
                right={<Toggle on={haptics} onChange={setHaptics} />}
              />
              <Divider />
              <Row
                Icon={Zap}
                title="Keep screen awake"
                desc="The chart stays lit while you steer."
                right={<Toggle on={wake} onChange={setWake} />}
              />
              <Divider />
              <Row
                Icon={InfinityIcon}
                title="Recalibrating"
                desc="Signal drifting? Draw a figure-8 in the air with the phone — the classic trick."
              />
              <Divider />
              <Row
                Icon={Compass}
                title="Magnetic north"
                desc="Headings come from the magnetometer. True north differs by local declination."
              />
            </div>

            {/* install guide — platform aware */}
            <div className="mx-6 mt-4 rounded-2xl border border-brass/20 bg-brass/[0.06] p-4">
              <div className="font-mono text-[8.5px] tracking-[0.3em] text-brass">
                {standalone
                  ? "INSTALLED — FAIR WINDS"
                  : platform === "android"
                    ? "INSTALL ON YOUR ANDROID"
                    : platform === "ios"
                      ? "INSTALL ON YOUR IPHONE"
                      : "INSTALL THIS APP"}
              </div>

              {standalone ? null : canInstall ? (
                <button
                  onClick={async () => {
                    await promptInstall();
                    buzz([12, 60, 18]);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brass py-3 transition-transform active:scale-[0.98]"
                >
                  <Download size={14} className="text-ink" strokeWidth={2.5} />
                  <span className="font-mono text-[10px] font-semibold tracking-[0.22em] text-ink">
                    INSTALL NOW
                  </span>
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  {platform === "android" ? (
                    <>
                      <Step n={1}>
                        <Smartphone size={13} className="text-brass" /> Open in Chrome
                      </Step>
                      <Step n={2}>
                        Tap <MoreVertical size={13} className="text-brass" /> menu
                      </Step>
                      <Step n={3}>
                        <Download size={13} className="text-brass" /> Install app / Add to Home
                        screen
                      </Step>
                    </>
                  ) : platform === "ios" ? (
                    <>
                      <Step n={1}>
                        <Smartphone size={13} className="text-brass" /> Open in Safari
                      </Step>
                      <Step n={2}>
                        Tap <Share size={13} className="text-brass" /> Share
                      </Step>
                      <Step n={3}>
                        <Plus size={13} className="text-brass" /> Add to Home Screen
                      </Step>
                    </>
                  ) : (
                    <>
                      <Step n={1}>
                        <Smartphone size={13} className="text-brass" /> Open in Chrome or Edge
                      </Step>
                      <Step n={2}>
                        <Download size={13} className="text-brass" /> Use the install icon in the
                        address bar
                      </Step>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 pt-5">
              <button
                onClick={clearData}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-blood/30 bg-blood/10 py-3 transition-transform active:scale-[0.98]"
              >
                {cleared ? (
                  <Check size={14} className="text-sage" />
                ) : (
                  <Trash2 size={14} className="text-blood" />
                )}
                <span className="font-mono text-[10px] tracking-[0.22em] text-blood">
                  {cleared ? "CHART CLEARED" : "CLEAR CHART & MARKERS"}
                </span>
              </button>
            </div>

            <div className="pt-6 text-center font-mono text-[8px] tracking-[0.4em] text-fog/60">
              BÚSSOLA DRAW · V1.0 · MMXXVI
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
