import { useCallback, useEffect, useRef, useState } from "react";
import {
  Feather,
  Magnet,
  Navigation2,
  PencilLine,
  Ruler,
  Share,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  cardinalOf,
  clamp,
  formatHeading,
  norm360,
  quadrantBearing,
  screenBearing,
} from "../lib/angles";
import { buzz } from "../lib/haptics";

/* ---------------------------------- types --------------------------------- */

interface Pt {
  x: number;
  y: number;
  p: number;
}

type Stroke =
  | { id: number; kind: "pen"; color: string; width: number; pts: Pt[] }
  | { id: number; kind: "ruler"; color: string; a: Pt; b: Pt };

type Tool = "pen" | "ruler";

const STORAGE_KEY = "bussola-chart-v1";

const INKS = [
  { name: "Brass", value: "#cfa851" },
  { name: "Bone", value: "#ece2cc" },
  { name: "Blood", value: "#e0483a" },
  { name: "Sage", value: "#5ec49b" },
];

function loadStrokes(): Stroke[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Stroke[]) : [];
  } catch {
    return [];
  }
}

/* ------------------------------ canvas helpers ----------------------------- */

function pathRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const step = 46;
  ctx.lineWidth = 1;
  for (let x = 0; x <= w + step; x += step) {
    const X = Math.round(x) + 0.5;
    const major = Math.round(x / step) % 5 === 0;
    ctx.strokeStyle = major ? "rgba(207,168,81,0.1)" : "rgba(207,168,81,0.04)";
    ctx.beginPath();
    ctx.moveTo(X, 0);
    ctx.lineTo(X, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h + step; y += step) {
    const Y = Math.round(y) + 0.5;
    const major = Math.round(y / step) % 5 === 0;
    ctx.strokeStyle = major ? "rgba(207,168,81,0.1)" : "rgba(207,168,81,0.04)";
    ctx.beginPath();
    ctx.moveTo(0, Y);
    ctx.lineTo(w, Y);
    ctx.stroke();
  }
  // cartographic frame with corner ticks
  const m = 10;
  const t = 9;
  ctx.strokeStyle = "rgba(207,168,81,0.18)";
  ctx.strokeRect(m + 0.5, m + 0.5, w - m * 2 - 1, h - m * 2 - 1);
  ctx.lineWidth = 1.4;
  const corner = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx * t, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * t);
    ctx.stroke();
  };
  corner(m, m, 1, 1);
  corner(w - m, m, -1, 1);
  corner(m, h - m, 1, -1);
  corner(w - m, h - m, -1, -1);
}

function drawPen(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, width: number) {
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, width * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const mx1 = (p0.x + p1.x) / 2;
    const my1 = (p0.y + p1.y) / 2;
    const mx2 = (p1.x + p2.x) / 2;
    const my2 = (p1.y + p2.y) / 2;
    ctx.beginPath();
    ctx.moveTo(mx1, my1);
    ctx.quadraticCurveTo(p1.x, p1.y, mx2, my2);
    ctx.lineWidth = width * (0.45 + p1.p);
    ctx.stroke();
  }
}

function drawRuler(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  color: string,
  w: number,
  h: number
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  // hairline
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([1, 7]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  // measurement ticks
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  for (let d = 26; d < len - 10; d += 26) {
    const x = a.x + ux * d;
    const y = a.y + uy * d;
    const big = Math.round(d / 26) % 4 === 0;
    const t = big ? 5.5 : 3;
    ctx.beginPath();
    ctx.moveTo(x - nx * t, y - ny * t);
    ctx.lineTo(x + nx * t, y + ny * t);
    ctx.stroke();
  }
  ctx.restore();

  // anchor + arrowhead
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(a.x, a.y, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(a.x, a.y, 1.6, 0, Math.PI * 2);
  ctx.fill();
  const ah = 11;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - ux * ah + nx * 5.5, b.y - uy * ah + ny * 5.5);
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - ux * ah - nx * 5.5, b.y - uy * ah - ny * 5.5);
  ctx.stroke();
  ctx.restore();

  // label chip
  const bearing = quadrantBearing(screenBearing(a.x, a.y, b.x, b.y));
  const nm = (len / (Math.max(h, 1) / 12)).toFixed(1);
  const label = `${bearing} · ${nm} nm`;
  ctx.save();
  ctx.font = '600 10.5px "JetBrains Mono", monospace';
  const tw = ctx.measureText(label).width;
  const midx = (a.x + b.x) / 2;
  const midy = (a.y + b.y) / 2;
  let ox = nx;
  let oy = ny;
  if (oy > 0) {
    ox = -ox;
    oy = -oy;
  }
  const lx = clamp(midx + ox * 22, tw / 2 + 14, w - tw / 2 - 14);
  const ly = clamp(midy + oy * 22, 20, h - 20);
  pathRoundRect(ctx, lx - tw / 2 - 8, ly - 9, tw + 16, 18, 9);
  ctx.fillStyle = "rgba(8,11,19,0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(207,168,81,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#cfa851";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, lx, ly + 0.5);
  ctx.restore();
}

/* --------------------------------- component ------------------------------- */

interface Props {
  heading: number;
  haptics: boolean;
}

export default function DrawTab({ heading, haptics }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const strokesRef = useRef<Stroke[]>([]);
  const livePen = useRef<{ color: string; pts: Pt[] } | null>(null);
  const liveRuler = useRef<{ color: string; a: Pt; b: Pt } | null>(null);
  const activePtr = useRef<number | null>(null);
  const idSeed = useRef(Date.now() % 1_000_000_000);
  const headingRef = useRef(heading);

  const [strokes, setStrokes] = useState<Stroke[]>(loadStrokes);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(INKS[0].value);
  const [snap, setSnap] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  const drawAll = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    if (w < 4 || h < 4) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b0e18";
    ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h);
    for (const s of strokesRef.current) {
      if (s.kind === "pen") drawPen(ctx, s.pts, s.color, s.width);
      else drawRuler(ctx, s.a, s.b, s.color, w, h);
    }
    if (livePen.current) drawPen(ctx, livePen.current.pts, livePen.current.color, 3);
    if (liveRuler.current) {
      const r = liveRuler.current;
      drawRuler(ctx, r.a, r.b, r.color, w, h);
    }
  }, []);

  /* sizing */
  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      const ctx = cv.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: r.width, h: r.height };
      drawAll();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    return () => ro.disconnect();
  }, [drawAll]);

  /* persist + repaint */
  useEffect(() => {
    strokesRef.current = strokes;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strokes));
    } catch {
      /* ignore */
    }
    drawAll();
  }, [strokes, drawAll]);

  /* reset from settings */
  useEffect(() => {
    const reset = () => setStrokes([]);
    window.addEventListener("bussola:reset", reset);
    return () => window.removeEventListener("bussola:reset", reset);
  }, []);

  const getPt = (e: PointerEvent | React.PointerEvent): Pt => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: (e as PointerEvent).pressure || 0.5 };
  };

  const snapTo = (a: Pt, b: Pt): Pt => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dx, -dy);
    const step = Math.PI / 12; // 15°
    const s = Math.round(ang / step) * step;
    return { x: a.x + Math.sin(s) * len, y: a.y - Math.cos(s) * len, p: b.p };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePtr.current !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePtr.current = e.pointerId;
    const p = getPt(e);
    setIsDrawing(true);
    if (tool === "pen") livePen.current = { color, pts: [p] };
    else liveRuler.current = { color, a: p, b: p };
    if (haptics) buzz(4);
    drawAll();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePtr.current !== e.pointerId) return;
    const evts = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    if (tool === "pen" && livePen.current) {
      for (const ev of evts) livePen.current.pts.push(getPt(ev));
    } else if (tool === "ruler" && liveRuler.current) {
      const last = getPt(evts[evts.length - 1]);
      liveRuler.current.b = snap ? snapTo(liveRuler.current.a, last) : last;
    } else {
      return;
    }
    drawAll();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePtr.current !== e.pointerId) return;
    activePtr.current = null;
    if (tool === "pen" && livePen.current) {
      const pts = livePen.current.pts;
      if (pts.length > 1) {
        const live = livePen.current;
        setStrokes((s) => [
          ...s,
          { id: ++idSeed.current, kind: "pen", color: live.color, width: 3, pts: live.pts },
        ]);
      }
      livePen.current = null;
    } else if (tool === "ruler" && liveRuler.current) {
      const { a, b, color: c } = liveRuler.current;
      if (Math.hypot(b.x - a.x, b.y - a.y) > 22) {
        setStrokes((s) => [...s, { id: ++idSeed.current, kind: "ruler", color: c, a, b }]);
      }
      liveRuler.current = null;
    }
    setIsDrawing(false);
    if (haptics) buzz(8);
    drawAll();
  };

  const undo = () => {
    setStrokes((s) => s.slice(0, -1));
    if (haptics) buzz(6);
  };

  const clearAll = () => {
    setStrokes([]);
    if (haptics) buzz([10, 40, 10]);
  };

  const plotHeading = () => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const cx = w / 2;
    const cy = h / 2;
    const len = Math.min(w, h) * 0.34;
    const rad = (norm360(headingRef.current) * Math.PI) / 180;
    const b: Pt = { x: cx + Math.sin(rad) * len, y: cy - Math.cos(rad) * len, p: 0.5 };
    const a: Pt = { x: cx, y: cy, p: 0.5 };
    setStrokes((s) => [...s, { id: ++idSeed.current, kind: "ruler", color: "#e0483a", a, b }]);
    if (haptics) buzz(12);
  };

  const shareChart = async () => {
    livePen.current = null;
    liveRuler.current = null;
    drawAll();
    const cv = canvasRef.current;
    if (!cv) return;
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
    if (!blob) return;
    const file = new File([blob], "bussola-chart.png", { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Bússola chart" });
        if (haptics) buzz(10);
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bussola-chart.png";
    a.click();
    URL.revokeObjectURL(url);
    if (haptics) buzz(10);
  };

  const h = norm360(heading);

  const iconBtn =
    "glass flex h-10 w-10 items-center justify-center rounded-full text-parchment/75 transition-transform active:scale-90";

  return (
    <div className="relative flex h-full flex-col">
      {/* header */}
      <div className="flex items-end justify-between px-5 pb-2.5 pt-1">
        <div>
          <div className="font-mono text-[8.5px] tracking-[0.32em] text-brass/80">
            NAUTICAL SKETCHPAD
          </div>
          <div className="mt-0.5 font-display text-[22px] italic leading-none text-parchment">
            Chart Table
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass tabular rounded-full px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-parchment/80">
            HDG {formatHeading(h)}° {cardinalOf(h)}
          </div>
          <button onClick={shareChart} className={iconBtn} aria-label="Share chart">
            <Share size={15} />
          </button>
        </div>
      </div>

      {/* canvas */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden px-4 pb-1">
        <canvas
          ref={canvasRef}
          className="block h-full w-full cursor-crosshair touch-none rounded-lg"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* action rail */}
        <div className="glass shadow-glass absolute right-6 top-3 z-10 flex flex-col items-center gap-0.5 rounded-full p-1.5">
          <button
            onClick={plotHeading}
            aria-label="Plot current heading"
            className="flex h-9 w-9 items-center justify-center rounded-full text-blood transition-transform active:scale-90"
          >
            <Navigation2 size={15} />
          </button>
          <button
            onClick={() => {
              setSnap((s) => !s);
              if (haptics) buzz(6);
            }}
            aria-label="Snap to 15 degrees"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90 ${
              snap ? "bg-parchment/15 text-brass" : "text-parchment/55"
            }`}
          >
            <Magnet size={15} />
          </button>
          <div className="my-0.5 h-px w-5 bg-parchment/10" />
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            aria-label="Undo"
            className="flex h-9 w-9 items-center justify-center rounded-full text-parchment/55 transition-all active:scale-90 disabled:opacity-30"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={clearAll}
            disabled={strokes.length === 0}
            aria-label="Clear chart"
            className="flex h-9 w-9 items-center justify-center rounded-full text-parchment/55 transition-all active:scale-90 disabled:opacity-30"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {strokes.length === 0 && !isDrawing && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-10 text-center">
            <Feather size={20} className="text-brass/50" />
            <p className="font-display text-lg italic text-parchment/45">A blank chart</p>
            <p className="max-w-[230px] text-[11px] leading-relaxed text-fog/70">
              Ink with the pen, or lay a true course with the bearing ruler — every line reads its
              heading.
            </p>
          </div>
        )}
      </div>

      {/* toolbar */}
      <div className="flex items-center justify-center px-5 pb-3 pt-2.5">
        <div className="glass shadow-glass flex items-center gap-1 rounded-full px-2 py-1.5">
          <button
            onClick={() => setTool("pen")}
            aria-label="Pen"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 ${
              tool === "pen"
                ? "bg-brass text-ink shadow-[0_6px_20px_-6px_rgba(207,168,81,0.7)]"
                : "text-parchment/55"
            }`}
          >
            <PencilLine size={16} />
          </button>
          <button
            onClick={() => setTool("ruler")}
            aria-label="Bearing ruler"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 ${
              tool === "ruler"
                ? "bg-brass text-ink shadow-[0_6px_20px_-6px_rgba(207,168,81,0.7)]"
                : "text-parchment/55"
            }`}
          >
            <Ruler size={16} />
          </button>

          <div className="mx-1.5 h-5 w-px bg-parchment/10" />

          {INKS.map((ink) => (
            <button
              key={ink.value}
              onClick={() => setColor(ink.value)}
              aria-label={ink.name}
              className="flex h-10 w-6 items-center justify-center transition-transform active:scale-90"
            >
              <span
                className={`h-4 w-4 rounded-full transition-all ${
                  color === ink.value ? "scale-125 ring-2 ring-parchment/60" : "opacity-70"
                }`}
                style={{ background: ink.value }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
