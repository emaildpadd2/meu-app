import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CameraOff,
  Crosshair,
  Flag,
  Infinity as InfinityIcon,
  Mountain,
  Wind,
  X,
} from "lucide-react";
import { CompassDial } from "./CompassDial";
import { useGeolocation } from "../hooks/useGeolocation";
import type { CompassSource, CompassStatus } from "../hooks/useCompass";
import {
  cardinalOf,
  cardinalNameOf,
  formatHeading,
  knotsOf,
  norm360,
  toDMS,
} from "../lib/angles";
import { buzz } from "../lib/haptics";

/* ---------------------------------- tape --------------------------------- */

const DegreeTape = memo(function DegreeTape({ heading }: { heading: number }) {
  const W = 236;
  const PX = 4.4;
  const center = norm360(heading);
  const span = W / PX / 2;
  const from = Math.floor(center - span) - 1;
  const to = Math.ceil(center + span) + 1;
  const items = [];
  for (let d = from; d <= to; d++) {
    const x = W / 2 + (d - center) * PX;
    const lab = norm360(d);
    const major = lab % 15 === 0;
    const labeled = lab % 5 === 0;
    items.push(
      <div
        key={d}
        className="absolute inset-y-0 flex -translate-x-1/2 flex-col items-center"
        style={{ left: x }}
      >
        <div className={major ? "h-2.5 w-px bg-parchment/70" : "h-1.5 w-px bg-parchment/30"} />
        {labeled && (
          <span className="tabular mt-1 font-mono text-[8.5px] text-fog/80">
            {String(lab).padStart(3, "0")}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="mask-fade-x relative mx-auto mt-2 h-[26px]" style={{ width: W }}>
      {items}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-blood/80" />
      <div className="absolute left-1/2 top-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-blood" />
    </div>
  );
});

/* ------------------------------- status pill ------------------------------ */

function statusPill(status: CompassStatus, accuracy: number | null, source: CompassSource) {
  if (status === "manual") return { label: "DEMO MODE", dot: "bg-fog" };
  if (status === "idle") return { label: "SENSORS OFF", dot: "bg-fog" };
  if (status === "denied") return { label: "BLOCKED", dot: "bg-blood" };
  if (accuracy == null) {
    return source === "fusion"
      ? { label: "FUSION LOCK", dot: "bg-sage" }
      : { label: "LIVE", dot: "bg-sage" };
  }
  if (accuracy < 0 || accuracy > 35) return { label: "CALIBRATE", dot: "bg-blood" };
  if (accuracy <= 15) return { label: "LOCKED", dot: "bg-sage" };
  return { label: "FAIR", dot: "bg-brass" };
}

/* --------------------------------- main tab ------------------------------- */

interface Props {
  heading: number;
  accuracy: number | null;
  status: CompassStatus;
  source: CompassSource;
  nudge: (delta: number) => void;
  haptics: boolean;
}

export default function CompassTab({ heading, accuracy, status, source, nudge, haptics }: Props) {
  const { fix, error: geoError } = useGeolocation();
  const [markers, setMarkers] = useState<number[]>([]);
  const [arOn, setArOn] = useState(false);
  const [arError, setArError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ptr: number; lastAng: number } | null>(null);

  const h = norm360(heading);
  const pill = statusPill(status, accuracy, source);
  const drifting = status === "active" && accuracy != null && (accuracy < 0 || accuracy > 35);

  /* cardinal-crossing haptic tick */
  const lastBand = useRef(-1);
  useEffect(() => {
    const band = Math.round(h / 45) % 8;
    if (band !== lastBand.current) {
      if (lastBand.current !== -1 && haptics && status === "active") buzz(6);
      lastBand.current = band;
    }
  }, [h, haptics, status]);

  /* reset coming from settings */
  useEffect(() => {
    const clear = () => setMarkers([]);
    window.addEventListener("bussola:reset", clear);
    return () => window.removeEventListener("bussola:reset", clear);
  }, []);

  /* stop camera tracks on unmount */
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const toggleAR = useCallback(async () => {
    if (arOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setArOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setArOn(true);
      buzz(10);
    } catch {
      setArError(true);
      window.setTimeout(() => setArError(false), 2600);
    }
  }, [arOn]);

  const addMarker = useCallback(() => {
    setMarkers((prev) => {
      if (prev.length >= 6) return prev;
      const m = Math.round(norm360(heading));
      return [...prev, m];
    });
    buzz(14);
  }, [heading]);

  /* manual drag — spin the rose with a finger when no sensor exists */
  const angleFromCenter = (clientX: number, clientY: number) => {
    const el = dialRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (status !== "manual") return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { ptr: e.pointerId, lastAng: angleFromCenter(e.clientX, e.clientY) };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.ptr) return;
    const a = angleFromCenter(e.clientX, e.clientY);
    let d = a - drag.lastAng;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    drag.lastAng = a;
    nudge(-d);
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const speedKn = fix?.speed != null && fix.speed >= 0 ? knotsOf(fix.speed) : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* AR camera layer */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          arOn ? "opacity-50" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/30 to-ink/80 transition-opacity duration-700 ${
          arOn ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5">
        {/* readout */}
        <div className="pt-0.5 text-center">
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="tabular font-mono text-[clamp(56px,18vw,88px)] leading-none tracking-[-0.04em] text-parchment">
              {formatHeading(h)}
            </span>
            <span className="font-display text-3xl italic text-brass">°</span>
          </div>
          <DegreeTape heading={heading} />
          <div className="mt-2 flex items-center justify-center gap-2.5 whitespace-nowrap">
            <span className="font-mono text-[11px] tracking-[0.34em] text-brass">
              {cardinalOf(h)}
            </span>
            <span className="h-3 w-px bg-parchment/20" />
            <span className="font-display text-[13px] italic text-parchment/55">
              {cardinalNameOf(h)}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${pill.dot} ${
                  status === "active" ? "animate-pulse-dot" : ""
                }`}
              />
              <span className="font-mono text-[8px] tracking-[0.22em] text-fog">
                {pill.label}
              </span>
            </span>
          </div>
        </div>

        {/* calibration strip */}
        <AnimatePresence>
          {drifting && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-blood/30 bg-blood/10 px-3.5 py-1.5">
                <InfinityIcon size={13} className="text-blood" />
                <span className="text-[10.5px] text-parchment/80">
                  Signal drifting — draw a figure-8 in the air with your phone
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* dial */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center py-2.5">
          <div
            ref={dialRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`relative aspect-square rounded-full shadow-dial ${
              status === "manual" ? "cursor-grab touch-none active:cursor-grabbing" : ""
            }`}
            style={{ width: "min(80vw, 40vh, 430px)" }}
          >
            <div className="absolute inset-0 rounded-full ring-1 ring-brass/20" />
            <CompassDial heading={heading} markers={markers} />
          </div>
          {status === "manual" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
              <span className="glass rounded-full px-3 py-1 font-mono text-[8.5px] tracking-[0.24em] text-fog">
                DRAG THE ROSE
              </span>
            </div>
          )}
        </div>

        {/* bearing markers */}
        <AnimatePresence>
          {markers.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2.5">
                {markers.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMarkers((prev) => prev.filter((x) => x !== m));
                      buzz(6);
                    }}
                    className="glass flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5"
                  >
                    <span className="h-1.5 w-1.5 rotate-45 bg-blood" />
                    <span className="tabular font-mono text-[10px] tracking-[0.14em] text-parchment/80">
                      {formatHeading(m)}° {cardinalOf(m)}
                    </span>
                    <X size={11} className="text-fog" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* position panel */}
        <div className="glass rounded-2xl px-4 py-3">
          {fix ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-mono text-[8px] tracking-[0.3em] text-fog">LAT</div>
                  <div className="tabular mt-0.5 font-mono text-[13px] text-parchment/90">
                    {toDMS(fix.lat, "N", "S")}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[8px] tracking-[0.3em] text-fog">LNG</div>
                  <div className="tabular mt-0.5 font-mono text-[13px] text-parchment/90">
                    {toDMS(fix.lng, "E", "W")}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-4 border-t border-parchment/5 pt-2.5">
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-fog">
                  <Mountain size={11} className="text-brass/80" />
                  <span className="tabular">
                    {fix.altitude != null ? `${Math.round(fix.altitude)} m` : "—"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-fog">
                  <Wind size={11} className="text-brass/80" />
                  <span className="tabular">
                    {speedKn != null ? `${speedKn.toFixed(1)} kn` : "—"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-fog">
                  <Crosshair size={11} className="text-brass/80" />
                  <span className="tabular">
                    {fix.accuracy != null ? `±${Math.round(fix.accuracy)} m` : "—"}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 py-1">
              <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-brass" />
              <span className="font-mono text-[10px] tracking-[0.18em] text-fog">
                {geoError ? "LOCATION OFF — GRANT ACCESS TO CHART YOUR POSITION" : "ACQUIRING POSITION…"}
              </span>
            </div>
          )}
        </div>

        {/* controls */}
        <div className="flex items-center justify-center gap-3 pb-3 pt-2.5">
          <button
            onClick={addMarker}
            className="glass shadow-glass flex h-11 items-center gap-2 rounded-full px-5 transition-transform active:scale-95"
          >
            <Flag size={14} className="text-blood" />
            <span className="tabular font-mono text-[10px] tracking-[0.22em] text-parchment/85">
              MARK {formatHeading(h)}°
            </span>
          </button>
          <button
            onClick={toggleAR}
            className={`glass shadow-glass flex h-11 items-center gap-2 rounded-full px-5 transition-transform active:scale-95 ${
              arOn ? "border-brass/40 text-brass" : ""
            }`}
          >
            {arOn ? <Camera size={14} /> : <CameraOff size={14} className="text-fog" />}
            <span className={`font-mono text-[10px] tracking-[0.22em] ${arOn ? "" : "text-parchment/85"}`}>
              {arOn ? "AR ON" : "AR OFF"}
            </span>
          </button>
        </div>
      </div>

      {/* camera error toast */}
      <AnimatePresence>
        {arError && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="glass-deep absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full px-4 py-2"
          >
            <span className="font-mono text-[10px] tracking-[0.18em] text-blood">
              CAMERA UNAVAILABLE
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
