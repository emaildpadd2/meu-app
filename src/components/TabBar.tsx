import { memo } from "react";
import { motion } from "framer-motion";
import { Compass, Feather } from "lucide-react";

export type TabId = "compass" | "draw";

const TABS: { id: TabId; label: string; Icon: typeof Compass }[] = [
  { id: "compass", label: "BÚSSOLA", Icon: Compass },
  { id: "draw", label: "DRAW", Icon: Feather },
];

export const TabBar = memo(function TabBar({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <div
      className="relative z-40 flex justify-center px-6 pt-1.5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="glass-deep shadow-glass flex w-full max-w-[320px] items-center rounded-full p-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex-1 rounded-full py-2.5 outline-none"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-brass shadow-[0_8px_24px_-8px_rgba(207,168,81,0.8)]"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative flex items-center justify-center gap-2">
                <Icon size={14} className={active ? "text-ink" : "text-fog"} strokeWidth={2.2} />
                <span
                  className={`font-mono text-[9px] tracking-[0.24em] ${
                    active ? "font-semibold text-ink" : "text-fog"
                  }`}
                >
                  {label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
