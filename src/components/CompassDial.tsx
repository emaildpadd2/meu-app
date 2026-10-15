import { memo } from "react";

/**
 * Mariner's compass dial.
 *
 * The rotating card (rose + numerals + needle) is a memoized SVG that the
 * parent rotates via CSS transform, so it never re-renders per frame.
 * A static bezel with the lubber (heading) marker sits on top.
 */

const C = 240;

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
};

interface Tick {
  d: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  o: number;
  hot: boolean;
}

function buildTicks(): Tick[] {
  const out: Tick[] = [];
  for (let d = 0; d < 360; d += 2) {
    let len = 6;
    let w = 1;
    let o = 0.32;
    if (d % 90 === 0) {
      len = 24;
      w = 2.4;
      o = 1;
    } else if (d % 30 === 0) {
      len = 17;
      w = 1.7;
      o = 0.9;
    } else if (d % 10 === 0) {
      len = 11;
      w = 1.25;
      o = 0.65;
    }
    const a = pt(218 - len, d);
    const b = pt(218, d);
    out.push({ d, x1: a.x, y1: a.y, x2: b.x, y2: b.y, w, o, hot: d === 0 });
  }
  return out;
}

interface RoseSpike {
  key: number;
  pathLight: string;
  pathDark: string;
  colorLight: string;
  colorDark: string;
}

function buildRose(): RoseSpike[] {
  const spikes: RoseSpike[] = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 22.5;
    const R = i % 4 === 0 ? 118 : i % 2 === 0 ? 90 : 64;
    const baseA = 8.5;
    const c = pt(0, a);
    const tip = pt(R, a);
    const l = pt(17, a - baseA);
    const r = pt(17, a + baseA);
    const isN = i === 0;
    const colorLight = isN ? "#f0564a" : i % 4 === 0 ? "#d9b25f" : i % 2 === 0 ? "#a8874a" : "#6f5a33";
    const colorDark = isN ? "#7c221a" : i % 4 === 0 ? "#7c5f27" : i % 2 === 0 ? "#54411d" : "#3a2f1a";
    spikes.push({
      key: i,
      colorLight,
      colorDark,
      pathLight: `M${c.x},${c.y} L${l.x},${l.y} L${tip.x},${tip.y} Z`,
      pathDark: `M${c.x},${c.y} L${tip.x},${tip.y} L${r.x},${r.y} Z`,
    });
  }
  return spikes;
}

const TICKS = buildTicks();
const ROSE = buildRose();

const NUMERALS = Array.from({ length: 12 }, (_, i) => i * 30);
const SUB_LETTERS: { d: number; t: string }[] = [
  { d: 45, t: "NE" },
  { d: 135, t: "SE" },
  { d: 225, t: "SW" },
  { d: 315, t: "NW" },
];
const CARD_LETTERS: { d: number; t: string; hot?: boolean }[] = [
  { d: 0, t: "N", hot: true },
  { d: 90, t: "E" },
  { d: 180, t: "S" },
  { d: 270, t: "W" },
];

export const RotatingRose = memo(function RotatingRose({
  markers,
}: {
  markers: number[];
}) {
  return (
    <svg
      viewBox="0 0 480 480"
      className="h-full w-full"
      style={{ filter: "drop-shadow(0 22px 44px rgba(0,0,0,0.55))" }}
    >
      <defs>
        <radialGradient id="capGrad" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#f0d488" />
          <stop offset="55%" stopColor="#cfa851" />
          <stop offset="100%" stopColor="#6d5222" />
        </radialGradient>
        <linearGradient id="lanceRed" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#b03024" />
          <stop offset="100%" stopColor="#f2604f" />
        </linearGradient>
        <linearGradient id="lanceBone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#efe6cf" />
          <stop offset="100%" stopColor="#8d8472" />
        </linearGradient>
        <radialGradient id="faceGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#11161f" />
          <stop offset="82%" stopColor="#0c101a" />
          <stop offset="100%" stopColor="#0a0d16" />
        </radialGradient>
        <path id="ringTextPath" d="M240,96 A144,144 0 1,1 240,384 A144,144 0 1,1 240,96" fill="none" />
      </defs>

      {/* face */}
      <circle cx={C} cy={C} r={238} fill="url(#faceGrad)" stroke="rgba(207,168,81,0.25)" strokeWidth={1} />
      <circle cx={C} cy={C} r={222} fill="none" stroke="rgba(236,226,204,0.06)" strokeWidth={26} />

      {/* ticks */}
      {TICKS.map((t) => (
        <line
          key={t.d}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.hot ? "#e0483a" : "#ece2cc"}
          strokeOpacity={t.o}
          strokeWidth={t.w}
          strokeLinecap="round"
        />
      ))}

      {/* degree numerals */}
      {NUMERALS.map((d) => {
        if (d % 90 === 0) return null;
        const p = pt(188, d);
        return (
          <text
            key={d}
            x={p.x}
            y={p.y}
            transform={`rotate(${d} ${p.x} ${p.y})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize={15}
            fill="#ece2cc"
            fillOpacity={0.75}
          >
            {d}
          </text>
        );
      })}

      {/* sub-cardinal letters */}
      {SUB_LETTERS.map((l) => {
        const p = pt(188, l.d);
        return (
          <text
            key={l.d}
            x={p.x}
            y={p.y}
            transform={`rotate(${l.d} ${p.x} ${p.y})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize={12}
            letterSpacing={1}
            fill="#cfa851"
            fillOpacity={0.6}
          >
            {l.t}
          </text>
        );
      })}

      {/* cardinal letters */}
      {CARD_LETTERS.map((l) => {
        const p = pt(181, l.d);
        return (
          <text
            key={l.d}
            x={p.x}
            y={p.y - 2}
            transform={`rotate(${l.d} ${p.x} ${p.y - 2})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Fraunces, serif"
            fontWeight={500}
            fontSize={34}
            fill={l.hot ? "#e0483a" : "#ece2cc"}
          >
            {l.t}
          </text>
        );
      })}

      {/* ring inscription */}
      <text
        fontFamily="JetBrains Mono, monospace"
        fontSize={10.5}
        letterSpacing={4.5}
        fill="#cfa851"
        fillOpacity={0.5}
      >
        <textPath href="#ringTextPath" startOffset="0">
          BÚSSOLA DRAW · NAUTICAL INSTRUMENT · Nº 26 · EST. MMXXVI · MAGNETIC NORTH ·
        </textPath>
      </text>

      {/* sixteen-point wind rose */}
      {ROSE.map((s) => (
        <g key={s.key}>
          <path d={s.pathLight} fill={s.colorLight} />
          <path d={s.pathDark} fill={s.colorDark} />
        </g>
      ))}

      {/* bearing markers */}
      {markers.map((m) => (
        <g key={m} transform={`rotate(${m} ${C} ${C})`}>
          <polygon
            points="240,128 246.5,134.5 240,141 233.5,134.5"
            fill="#e0483a"
            stroke="#0a0d16"
            strokeWidth={1.2}
          />
        </g>
      ))}

      {/* needle */}
      <polygon
        points="234,246 246,246 240,112"
        fill="url(#lanceRed)"
        stroke="#0a0d16"
        strokeOpacity={0.55}
        strokeWidth={1}
      />
      <polygon
        points="234,234 246,234 240,368"
        fill="url(#lanceBone)"
        stroke="#0a0d16"
        strokeOpacity={0.55}
        strokeWidth={1}
      />

      {/* jeweled cap */}
      <circle cx={C} cy={C} r={26} fill="none" stroke="rgba(207,168,81,0.35)" strokeWidth={1} />
      <circle cx={C} cy={C} r={18} fill="none" stroke="rgba(207,168,81,0.5)" strokeWidth={1} />
      <circle cx={C} cy={C} r={12.5} fill="url(#capGrad)" stroke="#0a0d16" strokeWidth={1} />
      <circle cx={C} cy={C} r={3.4} fill="#0a0d16" />
    </svg>
  );
});

/** Fixed bezel + lubber line that never rotates. */
export const StaticBezel = memo(function StaticBezel() {
  return (
    <svg viewBox="0 0 480 480" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(236,226,204,0.14)" />
          <stop offset="14%" stopColor="rgba(236,226,204,0.03)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </linearGradient>
      </defs>
      <circle cx={C} cy={C} r={239.25} fill="none" stroke="rgba(207,168,81,0.4)" strokeWidth={1.5} />
      <circle cx={C} cy={C} r={233} fill="none" stroke="url(#bezel)" strokeWidth={9} />
      {/* lubber marker */}
      <polygon points="240,3 248,17 232,17" fill="#e0483a" />
      <line x1={C} y1={18} x2={C} y2={36} stroke="#e0483a" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
});

export const CompassDial = memo(function CompassDial({
  heading,
  markers,
}: {
  heading: number;
  markers: number[];
}) {
  return (
    <div className="relative h-full w-full select-none">
      <div
        className="absolute inset-0 will-change-transform"
        style={{ transform: `rotate(${-heading}deg)` }}
      >
        <RotatingRose markers={markers} />
      </div>
      <StaticBezel />
      {/* glass glare */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(120%_70%_at_50%_0%,rgba(236,226,204,0.06),transparent_55%)]" />
    </div>
  );
});
