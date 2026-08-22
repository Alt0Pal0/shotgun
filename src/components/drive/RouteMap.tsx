"use client";
import { useEffect, useRef, useState } from "react";

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  tone?: "positive" | "improvement" | "neutral";
}
export interface RouteMapProps {
  coordinates: [number, number][];
  markers?: MapMarker[];
  current?: { lat: number; lng: number } | null;
  heightClass?: string;
  ariaLabel?: string;
  stale?: boolean;
}

/**
 * Route display. Uses the Google Maps JavaScript API when a browser key is configured; otherwise renders an offline
 * SVG polyline so the route is still visible (and tests never need Google). Google is display-only: never a data source.
 */
export function RouteMap(props: RouteMapProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (key && process.env.NEXT_PUBLIC_MAP_MODE !== "svg") return <GoogleRouteMap {...props} apiKey={key} />;
  return <SvgRouteMap {...props} />;
}

function bounds(coords: [number, number][], extra: { lat: number; lng: number }[] = []) {
  const pts = [...coords.map(([lng, lat]) => ({ lat, lng })), ...extra];
  if (!pts.length) return null;
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const padLat = Math.max((maxLat - minLat) * 0.1, 0.0005),
    padLng = Math.max((maxLng - minLng) * 0.1, 0.0005);
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
}

export function SvgRouteMap({
  coordinates,
  markers = [],
  current,
  heightClass = "h-56",
  ariaLabel = "Route map",
  stale,
}: RouteMapProps) {
  const b = bounds(coordinates, [...markers, ...(current ? [current] : [])]);
  const W = 400,
    H = 240;
  const project = (lat: number, lng: number) =>
    b ? [((lng - b.minLng) / (b.maxLng - b.minLng)) * W, H - ((lat - b.minLat) / (b.maxLat - b.minLat)) * H] : [0, 0];
  const path = coordinates
    .map(([lng, lat]) =>
      project(lat, lng)
        .map((n) => n.toFixed(1))
        .join(","),
    )
    .join(" ");
  return (
    <figure
      className={`relative w-full overflow-hidden rounded-xl border border-border bg-[#0e1630] ${heightClass}`}
      data-testid="route-map"
      data-map-mode="svg"
      data-points={coordinates.length}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-full w-full">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1c2747" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {coordinates.length > 1 && (
          <polyline
            points={path}
            fill="none"
            stroke="#2ee6c5"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {coordinates.length > 0 &&
          (() => {
            const [x, y] = project(coordinates[0][1], coordinates[0][0]);
            return <circle cx={x} cy={y} r="5" fill="#8b7cf6" />;
          })()}
        {coordinates.length > 1 &&
          (() => {
            const [x, y] = project(coordinates.at(-1)![1], coordinates.at(-1)![0]);
            return <circle cx={x} cy={y} r="5" fill="#f5b301" />;
          })()}
        {markers.map((m, i) => {
          const [x, y] = project(m.lat, m.lng);
          const c = m.tone === "positive" ? "#2ecc8f" : m.tone === "improvement" ? "#ff5c7a" : "#9aa6c7";
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="6" fill={c} stroke="#0b1120" strokeWidth="2" />
              <title>{m.label}</title>
            </g>
          );
        })}
        {current &&
          (() => {
            const [x, y] = project(current.lat, current.lng);
            return (
              <g>
                <circle cx={x} cy={y} r="10" fill="#2ee6c5" opacity="0.3" />
                <circle cx={x} cy={y} r="5" fill="#2ee6c5" stroke="#0b1120" strokeWidth="2" />
              </g>
            );
          })()}
      </svg>
      {!coordinates.length && !current && (
        <figcaption className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          Route unavailable
        </figcaption>
      )}
      {stale && <span className="absolute right-2 top-2 chip bg-amber/20 text-amber">Route may be incomplete</span>}
      <span className="absolute bottom-1 right-2 text-[10px] text-muted">Offline map</span>
    </figure>
  );
}

function GoogleRouteMap({
  coordinates,
  markers = [],
  current,
  heightClass = "h-56",
  ariaLabel = "Route map",
  stale,
  apiKey,
}: RouteMapProps & { apiKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const markerRefs = useRef<google.maps.Marker[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
        setOptions({ key: apiKey, v: "weekly" });
        const { Map } = await importLibrary("maps");
        await importLibrary("marker");
        if (cancelled || !ref.current) return;
        if (!mapRef.current)
          mapRef.current = new Map(ref.current, {
            disableDefaultUI: true,
            zoomControl: true,
            backgroundColor: "#0e1630",
            mapId: "ldp",
          });
        const map = mapRef.current;
        lineRef.current?.setMap(null);
        markerRefs.current.forEach((m) => m.setMap(null));
        markerRefs.current = [];
        const path = coordinates.map(([lng, lat]) => ({ lat, lng }));
        if (path.length > 1) {
          lineRef.current = new google.maps.Polyline({ path, strokeColor: "#2ee6c5", strokeWeight: 4, map });
        }
        for (const m of [
          ...markers.map((m) => ({ position: { lat: m.lat, lng: m.lng }, title: m.label })),
          ...(current ? [{ position: current, title: "Latest location" }] : []),
        ]) {
          markerRefs.current.push(new google.maps.Marker({ ...m, map }));
        }
        const b = new google.maps.LatLngBounds();
        path.forEach((p) => b.extend(p));
        markers.forEach((m) => b.extend({ lat: m.lat, lng: m.lng }));
        if (current) b.extend(current);
        if (!b.isEmpty()) map.fitBounds(b, 32);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, coordinates, markers, current]);

  if (failed)
    return (
      <SvgRouteMap
        coordinates={coordinates}
        markers={markers}
        current={current}
        heightClass={heightClass}
        ariaLabel={ariaLabel}
        stale={stale}
      />
    );
  return (
    <figure
      className={`relative w-full overflow-hidden rounded-xl border border-border ${heightClass}`}
      data-testid="route-map"
      data-map-mode="google"
    >
      <div ref={ref} role="img" aria-label={ariaLabel} className="h-full w-full" />
      {stale && <span className="absolute right-2 top-2 chip bg-amber/20 text-amber">Route may be incomplete</span>}
    </figure>
  );
}
