"use client";

import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from "@react-google-maps/api";
import { useEffect, useState } from "react";
import type { TieredRecommendation } from "@/lib/types";

interface Props {
  recommendations: TieredRecommendation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  officeAddress: string | null;
}

const BOSTON_CENTER = { lat: 42.3601, lng: -71.0589 };

const TIER_COLORS: Record<string, string> = {
  green: "#16a34a",
  blue: "#2563eb",
  orange: "#ea580c",
};

export default function NeighborhoodMap({
  recommendations,
  selectedId,
  onSelect,
  officeAddress,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [officeLoc, setOfficeLoc] = useState<{ lat: number; lng: number } | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // Geocode the office address to get a pin location
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
      <div className="h-[450px] bg-gray-100 rounded-xl flex items-center justify-center">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Recommended Neighborhoods
      </h2>
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
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
          }}
        >
          {/* Office location pin */}
          {officeLoc && (
            <MarkerF
              position={officeLoc}
              icon={{
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 7,
                fillColor: "#dc2626",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
                labelOrigin: new google.maps.Point(0, -12),
              }}
              label={{
                text: "Your Office",
                color: "#dc2626",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            />
          )}

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
                label={{
                  text: n.neighborhood.name.split(" - ").pop() || n.neighborhood.name,
                  color: "#1f2937",
                  fontSize: "12px",
                  fontWeight: isSelected ? "bold" : "normal",
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isSelected ? 16 : 12,
                  fillColor: TIER_COLORS[rec.color] || "#2563eb",
                  fillOpacity: isSelected ? 1 : 0.85,
                  strokeColor: isSelected ? "#1e3a5f" : "#ffffff",
                  strokeWeight: isSelected ? 3 : 2,
                  labelOrigin: new google.maps.Point(0, -20),
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
                        <div>Match: <strong>{Math.round(n.matchScore)}%</strong></div>
                        <div>Rent: <strong>${n.perPersonRent.toLocaleString()}/mo</strong></div>
                        {n.commuteMinutes !== null && (
                          <div>Commute: <strong>{n.commuteMinutes} min</strong></div>
                        )}
                        <div>Safety: <strong>{n.scores.safety}/100</strong></div>
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
