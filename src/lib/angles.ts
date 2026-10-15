/** Angle & navigation helpers shared across the app. */

export const TAU = Math.PI * 2;

export const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const formatHeading = (heading: number): string =>
  String(Math.round(norm360(heading)) % 360).padStart(3, "0");

export const CARDINALS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export const CARDINAL_NAMES = [
  "North",
  "North-North-East",
  "North-East",
  "East-North-East",
  "East",
  "East-South-East",
  "South-East",
  "South-South-East",
  "South",
  "South-South-West",
  "South-West",
  "West-South-West",
  "West",
  "West-North-West",
  "North-West",
  "North-North-West",
] as const;

export const cardinalIndexOf = (deg: number): number =>
  Math.round(norm360(deg) / 22.5) % 16;

export const cardinalOf = (deg: number): string => CARDINALS[cardinalIndexOf(deg)];

export const cardinalNameOf = (deg: number): string =>
  CARDINAL_NAMES[cardinalIndexOf(deg)];

/**
 * Nautical quadrant notation, e.g. "N 42° E".
 * Input bearing: 0 = up/north, clockwise positive.
 */
export function quadrantBearing(deg: number): string {
  const d = norm360(deg);
  if (d === 0) return "N";
  if (d === 90) return "E";
  if (d === 180) return "S";
  if (d === 270) return "W";
  if (d < 90) return `N ${Math.round(d)}° E`;
  if (d < 180) return `S ${Math.round(180 - d)}° E`;
  if (d < 270) return `S ${Math.round(d - 180)}° W`;
  return `N ${Math.round(360 - d)}° W`;
}

/** Bearing in degrees (0 = up) from point a to point b in screen coordinates. */
export function screenBearing(ax: number, ay: number, bx: number, by: number): number {
  return norm360((Math.atan2(bx - ax, -(by - ay)) * 180) / Math.PI);
}

/** Decimal degrees to sexagesimal, e.g. 38°42'30"N */
export function toDMS(value: number, pos: string, neg: string): string {
  const dir = value >= 0 ? pos : neg;
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"${dir}`;
}

export const knotsOf = (metersPerSecond: number): number =>
  metersPerSecond * 1.943844;
