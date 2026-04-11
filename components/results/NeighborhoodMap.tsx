"use client";

import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import { useEffect, useMemo, useState } from "react";
import type { TieredRecommendation, ScoredNeighborhood } from "@/lib/types";
import { GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMapsLoader";

interface Props {
  recommendations: TieredRecommendation[];
  allNeighborhoods: ScoredNeighborhood[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  officeAddress: string | null;
}

const BOSTON_CENTER = { lat: 42.3601, lng: -71.0589 };

const TIER_COLORS: Record<string, string> = {
  green: "#10b981",
  blue: "#3b82f6",
  orange: "#f59e0b",
};

// Modern teardrop pin shape (centered at 0,0, tip at bottom)
const PIN_PATH =
  "M 0,-24 C -8,-24 -14,-18 -14,-10 C -14,-2 0,8 0,8 C 0,8 14,-2 14,-10 C 14,-18 8,-24 0,-24 Z";

const mapStyle: google.maps.MapTypeStyle[] = [];

export default function NeighborhoodMap({
  recommendations,
  allNeighborhoods,
  selectedId,
  onSelect,
  officeAddress,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [officeHovered, setOfficeHovered] = useState(false);
  const [officeLoc, setOfficeLoc] = useState<{ lat: number; lng: number } | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Map recommendation id → { color, label } for quick lookup
  const recById = useMemo(() => {
    const map = new Map<string, { color: string; label: string }>();
    for (const rec of recommendations) {
      map.set(rec.neighborhood.neighborhood.id, {
        color: rec.color,
        label: rec.label,
      });
    }
    return map;
  }, [recommendations]);

  // Non-recommended neighborhoods (rendered as small neutral pins)
  const otherNeighborhoods = useMemo(
    () => allNeighborhoods.filter((n) => !recById.has(n.neighborhood.id)),
    [allNeighborhoods, recById]
  );

  useEffect(() => {
    if (!officeAddress || !isLoaded) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: officeAddress }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        setOfficeLoc({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [officeAddress, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="h-[450px] bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
        <p className="text-white">Loading map...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-white/10">
        <GoogleMap
          mapContainerStyle={{ height: "450px", width: "100%" }}
          center={BOSTON_CENTER}
          zoom={12}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: mapStyle,
          }}
        >
          {officeLoc && (
            <MarkerF
              position={officeLoc}
              onMouseOver={() => setOfficeHovered(true)}
              onMouseOut={() => setOfficeHovered(false)}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 0,
                labelOrigin: new google.maps.Point(0, 0),
              }}
              label={{
                text: "\uD83C\uDFE2",
                fontSize: "28px",
              }}
            >
              {officeHovered && (
                <InfoWindowF
                  position={officeLoc}
                  onCloseClick={() => setOfficeHovered(false)}
                >
                  <div className="p-1">
                    <p className="font-semibold text-sm text-gray-900">Your Work Location</p>
                    {officeAddress && (
                      <p className="text-xs text-gray-500 mt-0.5">{officeAddress}</p>
                    )}
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          )}

          {/* Non-recommended neighborhoods — small neutral dots, below recommended pins */}
          {otherNeighborhoods.map((n) => {
            const isSelected = n.neighborhood.id === selectedId;
            const isHovered = n.neighborhood.id === hoveredId;
            return (
              <MarkerF
                key={n.neighborhood.id}
                position={{
                  lat: n.neighborhood.centroid.lat,
                  lng: n.neighborhood.centroid.lng,
                }}
                onClick={() => onSelect(n.neighborhood.id)}
                onMouseOver={() => setHoveredId(n.neighborhood.id)}
                onMouseOut={() => setHoveredId(null)}
                zIndex={isSelected || isHovered ? 50 : 1}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isSelected ? 7 : 5,
                  fillColor: "#ef4444",
                  fillOpacity: isSelected ? 1 : 0.85,
                  strokeColor: "#ffffff",
                  strokeWeight: isSelected ? 2 : 1.5,
                }}
              >
                {isHovered && (
                  <InfoWindowF
                    position={{
                      lat: n.neighborhood.centroid.lat,
                      lng: n.neighborhood.centroid.lng,
                    }}
                    onCloseClick={() => setHoveredId(null)}
                  >
                    <div className="p-1 min-w-[180px]">
                      <h3 className="font-bold text-sm text-gray-900">
                        {n.neighborhood.name}
                      </h3>
                      {n.overBudget && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium text-white bg-red-500">
                          Out of budget
                        </span>
                      )}
                      <div className="mt-2 text-xs space-y-0.5 text-gray-700">
                        <div>
                          Match: <strong>{Math.round(n.matchScore)}%</strong>
                        </div>
                        <div>
                          Rent:{" "}
                          <strong>
                            ${n.perPersonRent.toLocaleString()}/mo
                          </strong>
                        </div>
                        {n.commuteMinutes !== null && (
                          <div>
                            Commute: <strong>{n.commuteMinutes} min</strong>
                          </div>
                        )}
                        <div>
                          Safety: <strong>{n.scores.safety}/100</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => onSelect(n.neighborhood.id)}
                        className="mt-2 text-xs text-blue-600 font-medium hover:underline"
                      >
                        View Details
                      </button>
                    </div>
                  </InfoWindowF>
                )}
              </MarkerF>
            );
          })}

          {recommendations.map((rec) => {
            const n = rec.neighborhood;
            const isSelected = n.neighborhood.id === selectedId;
            const isHovered = n.neighborhood.id === hoveredId;

            return (
              <MarkerF
                key={n.neighborhood.id}
                position={{
                  lat: n.neighborhood.centroid.lat,
                  lng: n.neighborhood.centroid.lng,
                }}
                onClick={() => onSelect(n.neighborhood.id)}
                onMouseOver={() => setHoveredId(n.neighborhood.id)}
                onMouseOut={() => setHoveredId(null)}
                zIndex={isSelected ? 200 : 100}
                icon={{
                  path: PIN_PATH,
                  scale: isSelected ? 1.5 : 1.2,
                  fillColor: TIER_COLORS[rec.color] || "#3b82f6",
                  fillOpacity: isSelected ? 1 : 0.9,
                  strokeColor: "#ffffff",
                  strokeWeight: isSelected ? 2.5 : 1.5,
                  anchor: new google.maps.Point(0, 8),
                }}
              >
                {isHovered && (
                  <InfoWindowF
                    position={{
                      lat: n.neighborhood.centroid.lat,
                      lng: n.neighborhood.centroid.lng,
                    }}
                    onCloseClick={() => setHoveredId(null)}
                  >
                    <div className="p-1 min-w-[180px]">
                      <h3 className="font-bold text-sm text-gray-900">
                        {n.neighborhood.name}
                      </h3>
                      <span
                        className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: TIER_COLORS[rec.color] }}
                      >
                        {rec.label}
                      </span>
                      <div className="mt-2 text-xs space-y-0.5 text-gray-700">
                        <div>
                          Match: <strong>{Math.round(n.matchScore)}%</strong>
                        </div>
                        <div>
                          Rent:{" "}
                          <strong>
                            ${n.perPersonRent.toLocaleString()}/mo
                          </strong>
                        </div>
                        {n.commuteMinutes !== null && (
                          <div>
                            Commute:{" "}
                            <strong>{n.commuteMinutes} min</strong>
                          </div>
                        )}
                        <div>
                          Safety: <strong>{n.scores.safety}/100</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => onSelect(n.neighborhood.id)}
                        className="mt-2 text-xs text-blue-600 font-medium hover:underline"
                      >
                        View Details
                      </button>
                    </div>
                  </InfoWindowF>
                )}
              </MarkerF>
            );
          })}
        </GoogleMap>
      </div>
    </div>
  );
}
