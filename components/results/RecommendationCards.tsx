import type { TieredRecommendation } from "@/lib/types";

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
                <div className="flex justify-between items-center">
                  <span>Transit</span>
                  <span className="font-semibold text-xs">
                    {n.neighborhood.mbtaLines
                      .filter((l) => l !== "bus")
                      .map((l) => l === "red" ? "Red" : l === "green" ? "Green" : l === "blue" ? "Blue" : l === "orange" ? "Orange" : l === "silver" ? "Silver" : l === "ferry" ? "Ferry" : l)
                      .join(", ") || "Bus"}
                    {n.neighborhood.mbtaLines.includes("bus") && n.neighborhood.mbtaLines.some((l) => l !== "bus") ? " + Bus" : ""}
                  </span>
                </div>
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
