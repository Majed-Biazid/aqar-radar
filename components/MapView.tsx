"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polygon, useMap } from "react-leaflet";
import { useEffect } from "react";
import L, { type LatLngExpression } from "leaflet";
import { DISTRICTS, DAMMAM_CENTER } from "@/lib/districts";
import { jitter, formatSAR } from "@/lib/normalize";
import type { Listing } from "@/lib/types";

type Props = {
  listings: Listing[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onOpen: (l: Listing) => void;
  selectedDistrictIds: string[];
};

export default function MapView({
  listings,
  hoveredId,
  onHover,
  onOpen,
  selectedDistrictIds,
}: Props) {
  const districtById = new Map(DISTRICTS.map((d) => [d.id, d]));

  function idFromListing(l: Listing): string | null {
    for (const d of DISTRICTS) {
      if (l.url.includes(`/${d.city}/حي-${d.slug}/`)) return d.id;
    }
    return null;
  }

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        minHeight: 500,
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--hairline-soft)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <MapContainer
        center={DAMMAM_CENTER as LatLngExpression}
        zoom={11}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <FitToSelection selectedIds={selectedDistrictIds} listings={listings} />

        {DISTRICTS.map((d) => {
          if (!d.polygon) return null;
          const coords = (d.polygon.type === "Polygon"
            ? [d.polygon.coordinates]
            : d.polygon.coordinates) as number[][][][];
          const rings = coords.flat().map((ring) =>
            ring.map(([lng, lat]) => [lat, lng] as [number, number]),
          );
          const isSelected = selectedDistrictIds.includes(d.id);
          return (
            <Polygon
              key={d.id}
              positions={rings as LatLngExpression[][]}
              pathOptions={{
                color: isSelected ? "#C8553D" : "#9B8B6F",
                weight: isSelected ? 2 : 1,
                opacity: isSelected ? 0.9 : 0.4,
                fillColor: isSelected ? "#C8553D" : "#9B8B6F",
                fillOpacity: isSelected ? 0.10 : 0.04,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          );
        })}

        {listings.map((l) => {
          const id = idFromListing(l);
          if (!id) return null;
          const d = districtById.get(id);
          if (!d) return null;
          const [dLat, dLng] = jitter(l.id);
          const pos: LatLngExpression = [d.center[0] + dLat, d.center[1] + dLng];
          const isHover = hoveredId === l.id;
          const color =
            l.status === "gone"
              ? "#4a4e57"
              : l.price_change && l.price_change.to < l.price_change.from
                ? "#7A9471"
                : l.is_new === 1
                  ? "#C8553D"
                  : "#9B8B6F";
          return (
            <CircleMarker
              key={l.id}
              center={pos}
              radius={isHover ? 11 : 6}
              pathOptions={{
                color: isHover ? "#2B3A5C" : color,
                weight: isHover ? 3 : 1.5,
                fillColor: color,
                fillOpacity: l.status === "gone" ? 0.35 : 0.85,
              }}
              eventHandlers={{
                mouseover: () => onHover(l.id),
                mouseout: () => onHover(null),
                click: () => onOpen(l),
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                <div className="font-mono text-[11px]">
                  {formatSAR(l.price_annual_sar)} /سنة · {l.district}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Custom zoom controls — must be inside MapContainer for useMap() */}
        <ZoomBar />
      </MapContainer>

      {/* Disclaimer pill */}
      <div
        className="absolute bottom-3 start-3 z-[400]"
        style={{
          background: "color-mix(in srgb, var(--bg-floating) 92%, transparent)",
          color: "var(--fg-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          padding: "6px 12px",
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--hairline-soft)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          maxWidth: "calc(100% - 24px)",
        }}
      >
        المواقع تقريبية على مستوى الحي
      </div>
    </div>
  );
}

function ZoomBar() {
  const map = useMap();
  return (
    <div
      className="absolute top-3 end-3 z-[400] flex flex-col"
      style={{
        gap: 4,
        background: "var(--bg-floating)",
        borderRadius: "var(--radius-md)",
        padding: 4,
        border: "1px solid var(--hairline-soft)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <button
        type="button"
        onClick={() => map.zoomIn()}
        aria-label="تكبير"
        className="inline-flex items-center justify-center transition-colors"
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-sm)",
          color: "var(--fg)",
          fontSize: 16,
          lineHeight: 1,
          background: "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-soft)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        aria-label="تصغير"
        className="inline-flex items-center justify-center transition-colors"
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-sm)",
          color: "var(--fg)",
          fontSize: 16,
          lineHeight: 1,
          background: "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-soft)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        −
      </button>
    </div>
  );
}

/**
 * Smart map: auto-fit bounds to whichever districts are currently selected.
 * - 0 selected → wide view of the Eastern Province corridor
 * - 1 selected → zoom tight to that district (use polygon if available)
 * - N selected → fit bounds containing all their centers + polygon extents
 */
function FitToSelection({
  selectedIds,
  listings,
}: {
  selectedIds: string[];
  listings: Listing[];
}) {
  const map = useMap();

  useEffect(() => {
    const selected = DISTRICTS.filter((d) => selectedIds.includes(d.id));

    if (selected.length === 0) {
      map.flyTo([26.37, 50.12], 11, { animate: true, duration: 0.6 });
      return;
    }

    if (selected.length === 1) {
      const d = selected[0];
      if (d.polygon) {
        const coords = (d.polygon.type === "Polygon"
          ? [d.polygon.coordinates]
          : d.polygon.coordinates) as number[][][][];
        const points: [number, number][] = [];
        for (const ring of coords.flat()) {
          for (const [lng, lat] of ring) points.push([lat, lng]);
        }
        if (points.length > 0) {
          map.flyToBounds(L.latLngBounds(points), {
            padding: [50, 50],
            maxZoom: 15,
            duration: 0.7,
          });
          return;
        }
      }
      map.flyTo(d.center as LatLngExpression, 14, { animate: true, duration: 0.6 });
      return;
    }

    const points: [number, number][] = selected.map((d) => d.center);
    for (const d of selected) {
      if (d.polygon) {
        const coords = (d.polygon.type === "Polygon"
          ? [d.polygon.coordinates]
          : d.polygon.coordinates) as number[][][][];
        for (const ring of coords.flat()) {
          for (const [lng, lat] of ring) points.push([lat, lng]);
        }
      }
    }
    if (points.length === 0) return;
    map.flyToBounds(L.latLngBounds(points), {
      padding: [60, 60],
      maxZoom: 14,
      duration: 0.7,
    });
  }, [selectedIds.join(","), listings.length, map]);

  return null;
}
