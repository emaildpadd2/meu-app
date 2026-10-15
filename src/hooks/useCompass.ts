import { useCallback, useEffect, useRef, useState } from "react";

export type CompassStatus =
  | "idle" // iOS-style: explicit permission request required
  | "active" // sensor streaming
  | "denied" // user refused / error
  | "manual"; // no usable sensor — drag-the-rose demo mode

export type CompassSource = "fusion" | "events" | "none";

export interface Compass {
  /** Smoothed, continuous heading in degrees (unwrapped, may exceed 0–360). */
  heading: number;
  /** iOS compass accuracy in degrees; negative when unreliable; null when unknown. */
  accuracy: number | null;
  status: CompassStatus;
  /** Which sensor engine is feeding the dial. */
  source: CompassSource;
  /** Ask the OS for motion access. Must be called from a user gesture on iOS. */
  requestAccess: () => Promise<"granted" | "denied">;
  /** Rotate the target heading by delta degrees (manual drag). */
  nudge: (delta: number) => void;
  /** Force demo/manual mode (user skipped permission). */
  enterManual: () => void;
}

const SPRING_RATE = 6.5;

function screenAngle(): number {
  const so = (typeof screen !== "undefined" ? screen.orientation : undefined) as
    | { angle?: number }
    | undefined;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return so?.angle ?? legacy ?? 0;
}

/** Minimal structural typing for the Generic Sensor API orientation sensor. */
interface AbsOrientationSensor {
  start: () => void;
  stop: () => void;
  onreading: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  quaternion?: [number, number, number, number];
}

/**
 * Multi-engine compass:
 *
 *  1. Generic Sensor `AbsoluteOrientationSensor` (Android Chrome — hardware
 *     sensor fusion of accelerometer + magnetometer + gyroscope). Heading is
 *     derived from the quaternion using the Android azimuth formula.
 *  2. `deviceorientationabsolute` / absolute `deviceorientation` events.
 *  3. Relative `deviceorientation` (only when nothing absolute ever arrives).
 *  4. Manual mode — the user drags the rose.
 *
 * All engines feed one unwrap + critically-damped spring pipeline.
 */
export function useCompass(): Compass {
  const [status, setStatus] = useState<CompassStatus>("idle");
  const [source, setSource] = useState<CompassSource>("none");
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const sawEventRef = useRef(false);
  const sawAbsoluteRef = useRef(false);
  const sourceRef = useRef<CompassSource>("none");
  const fusionRef = useRef<AbsOrientationSensor | null>(null);

  const setSourceBoth = (s: CompassSource) => {
    sourceRef.current = s;
    setSource(s);
  };

  /** Feed a raw absolute heading (deg clockwise from north) into the spring. */
  const feedHeading = useCallback((h: number) => {
    if (Number.isNaN(h)) return;
    sawEventRef.current = true;
    const prev = targetRef.current;
    const delta = (((h - prev) % 360) + 540) % 360 - 180;
    targetRef.current = prev + delta;
  }, []);

  /* ---------------------------- legacy event engine ---------------------------- */

  const handleAny = useCallback(
    (e: DeviceOrientationEvent) => {
      if (sourceRef.current === "fusion") return; // fusion owns the dial
      const anyE = e as unknown as {
        webkitCompassHeading?: number;
        webkitCompassAccuracy?: number;
      };
      let h: number | null = null;
      if (typeof anyE.webkitCompassHeading === "number") {
        h = anyE.webkitCompassHeading;
        if (typeof anyE.webkitCompassAccuracy === "number") {
          setAccuracy(anyE.webkitCompassAccuracy);
        }
      } else if (e.alpha !== null) {
        h = (360 - e.alpha + screenAngle()) % 360;
      }
      if (h !== null) feedHeading(h);
    },
    [feedHeading]
  );

  const handleAbsolute = useCallback(
    (e: DeviceOrientationEvent) => {
      sawAbsoluteRef.current = true;
      handleAny(e);
    },
    [handleAny]
  );

  const handlePlain = useCallback(
    (e: DeviceOrientationEvent) => {
      if ((e as unknown as { absolute?: boolean }).absolute === true) {
        sawAbsoluteRef.current = true;
        handleAny(e);
        return;
      }
      // Relative alpha on a device that already spoke absolute → junk, ignore.
      if (sawAbsoluteRef.current) return;
      handleAny(e);
    },
    [handleAny]
  );

  const attach = useCallback(() => {
    window.addEventListener("deviceorientationabsolute", handleAbsolute, true);
    window.addEventListener("deviceorientation", handlePlain, true);
  }, [handleAbsolute, handlePlain]);

  const detach = useCallback(() => {
    window.removeEventListener("deviceorientationabsolute", handleAbsolute, true);
    window.removeEventListener("deviceorientation", handlePlain, true);
  }, [handleAbsolute, handlePlain]);

  /* ---------------------- Generic Sensor fusion (Android) ---------------------- */

  const tryFusionSensor = useCallback((): boolean => {
    const Ctor = (
      window as unknown as {
        AbsoluteOrientationSensor?: new (opts?: {
          frequency?: number;
          referenceFrame?: string;
        }) => AbsOrientationSensor;
      }
    ).AbsoluteOrientationSensor;
    if (!Ctor) return false;
    try {
      const sensor = new Ctor({ frequency: 60, referenceFrame: "device" });
      sensor.onreading = () => {
        const q = sensor.quaternion;
        if (!q) return;
        const [x, y, z, w] = q;
        // Android azimuth (rotation around -Z) from the unit quaternion,
        // equivalent to SensorManager.getOrientation(R)[0].
        const azimuth = Math.atan2(2 * (x * y - w * z), 1 - 2 * (x * x + z * z));
        const h = ((azimuth * 180) / Math.PI + screenAngle() + 360) % 360;
        feedHeading(h);
      };
      sensor.onerror = () => {
        try {
          fusionRef.current?.stop();
        } catch {
          /* ignore */
        }
        fusionRef.current = null;
        if (sourceRef.current === "fusion") setSourceBoth("events");
      };
      sensor.start();
      fusionRef.current = sensor;
      setSourceBoth("fusion");
      return true;
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedHeading]);

  const startListening = useCallback(() => {
    const fusionOk = tryFusionSensor();
    attach();
    if (sourceRef.current === "none") setSourceBoth("events");
    setStatus("active");

    // Watchdog — if nothing streams, degrade gracefully toward manual mode.
    window.setTimeout(() => {
      if (sawEventRef.current) return;
      if (fusionOk) {
        // Fusion never delivered: kill it so the event engine owns the dial.
        try {
          fusionRef.current?.stop();
        } catch {
          /* ignore */
        }
        fusionRef.current = null;
        setSourceBoth("events");
      }
      window.setTimeout(() => {
        if (!sawEventRef.current) {
          setStatus((s) => (s === "active" ? "manual" : s));
        }
      }, 2500);
    }, 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attach, tryFusionSensor]);

  /* -------------------------------- lifecycle -------------------------------- */

  // Environment probe: no DeviceOrientationEvent → manual; Android-style → auto start.
  useEffect(() => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: unknown })
      .DeviceOrientationEvent;
    const hasFusion = "AbsoluteOrientationSensor" in window;
    if (!DOE && !hasFusion) {
      setStatus("manual");
      return;
    }
    const maybeIOS = DOE as { requestPermission?: unknown } | undefined;
    if (typeof maybeIOS?.requestPermission !== "function") {
      startListening();
    }
    // otherwise stay "idle" — the gate screen will request from a user gesture
  }, [startListening]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      detach();
      try {
        fusionRef.current?.stop();
      } catch {
        /* ignore */
      }
    },
    [detach]
  );

  // Critically-damped spring toward the target heading.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.064, (t - last) / 1000);
      last = t;
      const gap = targetRef.current - currentRef.current;
      if (Math.abs(gap) > 0.0004) {
        currentRef.current += gap * (1 - Math.exp(-dt * SPRING_RATE));
        setHeading(currentRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const requestAccess = useCallback(async (): Promise<"granted" | "denied"> => {
    const DOE = (
      window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }
    ).DeviceOrientationEvent;
    if (!DOE) {
      // No classic event API — try the fusion sensor directly (Android).
      startListening();
      return "granted";
    }
    try {
      if (typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res === "granted") {
          setAccuracy(null);
          startListening();
          return "granted";
        }
        setStatus("denied");
        return "denied";
      }
      startListening();
      return "granted";
    } catch {
      setStatus("denied");
      return "denied";
    }
  }, [startListening]);

  const nudge = useCallback((delta: number) => {
    targetRef.current += delta;
  }, []);

  const enterManual = useCallback(() => {
    setStatus("manual");
  }, []);

  return { heading, accuracy, status, source, requestAccess, nudge, enterManual };
}
