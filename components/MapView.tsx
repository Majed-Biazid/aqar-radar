"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polygon, useMap } from "react-leaflet";
import { useEffect } from "react";
import L, { type LatLngExpression, type LatLngBoundsLiteral } from "leaflet";
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

export default function MapView({ listings, hoveredId, onHover, onOpen, selectedDistrictIds }: Props) {
  const districtById = new Map(DISTRICTS.map((d) => [d.id, d]));

  function idFromListing(l: Listing): string | null {
    for (const d of DISTRICTS) {
      if (l.url.includes(`/${d.city}/حي-${d.slug}/`)) return d.id;
    }
    return null;
  }

  return (
    <div className="relative h-full min-h-[500px] rounded-[4px] overflow-hidden border" style={{ borderColor: "var(--hairline)" }}>
      <MapContainer
        center={DAMMAM_CENTER as LatLngExpression}
        zoom={11}
        scrollWheelZoom
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
          const rings = coords.flat().map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
          const isSelected = selectedDistrictIds.includes(d.id);
          return (
            <Polygon
              key={d.id}
              positions={rings as LatLngExpression[][]}
              pathOptions={{
                color: isSelected ? "#C8553D" : "#2B3A5C",
                weight: isSelected ? 1.8 : 1,
                opacity: isSelected ? 0.7 : 0.35,
                fillColor: isSelected ? "#C8553D" : "#2B3A5C",
                fillOpacity: isSelected ? 0.08 : 0.04,
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
          // Pin color: gray=gone, sage=price-dropped, terracotta=seller-labeled-new, stone=default
          const color = l.status === "gone"
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
      </MapContainer>

      <div
        className="absolute bottom-2 start-2 z-[400] font-mono text-[10px] px-2 py-1 rounded"
        style={{ background: "rgba(232,220,192,0.92)", color: "var(--ink)" }}
      >
        pins are district-approximate · aqar.fm doesn't expose exact coords
      </div>
    </div>
  );
}

/**
 * Smart map: auto-fit bounds to whichever districts are currently selected.
 * - 0 selected → zoom out to show everything
 * - 1 selected → zoom tight to that district
 * - N selected → fit bounds to contain all their centers
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
      // Nothing selected: show region-wide
      map.setView([26.37, 50.12], 11, { animate: true });
      return;
    }
    if (selected.length === 1) {
      // Single district: zoom in close to it
      const d = selected[0];
      map.setView(d.center as LatLngExpression, 14, { animate: true });
      return;
    }
    // Multiple: fit to bounds of their centers (padded) + any polygon extents
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
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true });
  }, [selectedIds.join(","), listings.length, map]);

  return null;
}
