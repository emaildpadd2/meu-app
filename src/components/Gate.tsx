import { useState } from "react";
import { motion } from "framer-motion";
import { Compass, MousePointer2 } from "lucide-react";
import type { CompassStatus } from "../hooks/useCompass";

interface Props {
  status: CompassStatus;
  onEnable: () => Promise<"granted" | "denied">;
  onSkip: () => void;
}

/** iOS-style motion-permission gate — the request must come from a real tap. */
export function Gate({ status, onEnable, onSkip }: Props) {
  const [busy, setBusy] = useState(false);
  const denied = status === "denied";

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    await onEnable();
    setBusy(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-ink px-8 text-center"
    >
      {/* ambient rose */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="animate-spin-slower h-[560px] w-[560px] rounded-full border border-brass/10">
          <div className="h-full w-full rounded-full border-[26px] border-brass/[0.04]" />
        </div>
      </div>

      <motion.img
        src="/icon.png"
        alt="Bússola"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.1 }}
        className="animate-float-soft h-24 w-24 rounded-[26px] shadow-dial ring-1 ring-brass/30"
      />

      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.22, duration: 0.5 }}
      >
        <div className="mt-7 font-display text-4xl italic text-parchment">Bússola</div>
        <div className="mt-2 font-mono text-[9px] tracking-[0.5em] text-brass">
          COMPASS & CHART TABLE
        </div>

        <p className="mx-auto mt-6 max-w-[280px] text-[13px] leading-relaxed text-fog">
          {denied
            ? "Motion access was declined. Re-enable it in Settings → Safari → Motion & Orientation, or explore in demo mode."
            : "To steer by the magnetometer, allow Motion & Orientation access when iOS asks. Nothing ever leaves this device."}
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.34, duration: 0.5 }}
        className="mt-8 flex flex-col items-center gap-3"
      >
        {!denied && (
          <button
            onClick={enable}
            disabled={busy}
            className="shadow-glass flex h-[52px] items-center gap-2.5 rounded-full bg-brass px-8 transition-transform active:scale-95 disabled:opacity-70"
          >
            <Compass size={16} className="text-ink" strokeWidth={2.4} />
            <span className="font-mono text-[11px] font-semibold tracking-[0.22em] text-ink">
              {busy ? "REQUESTING…" : "ENABLE MOTION"}
            </span>
          </button>
        )}
        <button
          onClick={onSkip}
          className="glass flex h-[46px] items-center gap-2 rounded-full px-7 transition-transform active:scale-95"
        >
          <MousePointer2 size={13} className="text-fog" />
          <span className="font-mono text-[10px] tracking-[0.22em] text-parchment/75">
            ENTER DEMO MODE
          </span>
        </button>
      </motion.div>

      <div className="absolute bottom-8 font-mono text-[8px] tracking-[0.4em] text-fog/50">
        NAVEGAÇÃO · DESENHO · MMXXVI
      </div>
    </motion.div>
  );
}
