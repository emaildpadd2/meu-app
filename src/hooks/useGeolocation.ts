import { useEffect, useState } from "react";

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
}

export interface GeoState {
  fix: GeoFix | null;
  error: string | null;
}

export function useGeolocation(): GeoState {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Location unavailable on this device");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null);
        setFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy ?? null,
          altitude: p.coords.altitude,
          speed: p.coords.speed,
        });
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { fix, error };
}
