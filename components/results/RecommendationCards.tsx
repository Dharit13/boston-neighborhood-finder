import type { TieredRecommendation, MbtaLine } from "@/lib/types";

const MBTA_COLORS: Record<MbtaLine, string> = {
  red: "bg-red-500",
  green: "bg-green-600",
  blue: "bg-blue-600",
  orange: "bg-orange-500",
  silver: "bg-gray-400",
  bus: "bg-yellow-500",
  ferry: "bg-cyan-500",
};

interface Props {
  recommendations: TieredRecommendation[];
  onSelect: (id: string) => void;
}

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string }> = {
  green: {
    bg: "bg-green-50",
    border: "border-green-200 hover:border-green-400",
    badge: "bg-green-100 text-green-800",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200 hover:border-blue-400",
    badge: "bg-blue-100 text-blue-800",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200 hover:border-orange-400",
    badge: "bg-orange-100 text-orange-800",
  },
};

export default function RecommendationCards({
  recommendations,
  onSelect,
}: Props) {
  if (recommendations.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Our Top Picks for You
      </h2>
      <div className={`grid gap-4 ${
        recommendations.length === 1
          ? "grid-cols-1 max-w-md"
          : recommendations.length === 2
          ? "grid-cols-1 sm:grid-cols-2"
          : "grid-cols-1 sm:grid-cols-3"
      }`}>
        {recommendations.map((rec) => {
          const colors = COLOR_MAP[rec.color] || COLOR_MAP.blue;
          const n = rec.neighborhood;
          return (
            <button
              key={n.neighborhood.id}
              onClick={() => onSelect(n.neighborhood.id)}
              className={`text-left p-5 rounded-xl border-2 ${colors.border} ${colors.bg} transition-all`}
            >
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors.badge} mb-2`}
              >
                {rec.label}
              </span>
              <h3 className="text-xl font-bold text-gray-900">
                {n.neighborhood.name}
              </h3>
              <div className="mt-3 space-y-1 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Match Score</span>
                  <span className="font-semibold">
                    {Math.round(n.matchScore)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rent (per person)</span>
                  <span className="font-semibold">
                    ${n.perPersonRent.toLocaleString()}/mo
                  </span>
                </div>
                {n.commuteMinutes !== null && (
                  <div className="flex justify-between">
                    <span>Commute</span>
                    <span className="font-semibold">
                      {n.commuteMinutes} min
                      {n.commuteRoute && (
                        <span className="font-normal text-gray-500 ml-1">
                          ({n.commuteRoute})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Safety</span>
                  <span className="font-semibold">{n.scores.safety}/100</span>
                </div>
                {/* Transit — stations and bus routes */}
                <div className="pt-1 border-t border-gray-200 mt-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Transit
                  </span>
                  {/* T Stations */}
                  {n.neighborhood.mbtaStations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {n.neighborhood.mbtaStations
                        .filter((s) => s.line !== "ferry")
                        .map((s) => (
                          <span
                            key={`${s.line}-${s.name}`}
                            className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-1.5 py-0.5"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${MBTA_COLORS[s.line]}`}
                            />
                            {s.name}
                          </span>
                        ))}
                    </div>
                  )}
                  {/* Bus Routes */}
                  {n.neighborhood.busRoutes.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${MBTA_COLORS.bus}`} />
                        Bus {n.neighborhood.busRoutes.join(", ")}
                      </span>
                    </div>
                  )}
                  {/* Ferry */}
                  {n.neighborhood.mbtaStations
                    .filter((s) => s.line === "ferry")
                    .map((s) => (
                      <div key={s.name} className="text-xs text-gray-500 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${MBTA_COLORS.ferry}`} />
                          {s.name}
                        </span>
                      </div>
                    ))}
                </div>
                {/* Walking */}
                {n.commuteRoute && n.commuteRoute.includes("walk") && (
                  <div className="flex justify-between">
                    <span>Walk</span>
                    <span className="font-semibold text-xs">
                      {n.commuteRoute.match(/(\d+)\s*min\s*walk/)?.[0] || "Available"}
                    </span>
                  </div>
                )}
              </div>
              {rec.tradeoffVsPrev && (
                <p className="mt-3 text-xs text-gray-500 italic">
                  vs previous: {rec.tradeoffVsPrev}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
