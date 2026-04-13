import type { TieredRecommendation, MbtaLine, UserInput } from "@/lib/types";

const MBTA_COLORS: Record<MbtaLine, string> = {
  red: "#da291c",
  green: "#00843d",
  blue: "#003da5",
  orange: "#ed8b00",
  silver: "#7c878e",
  bus: "#f5b400",
  ferry: "#00b4d8",
};

interface Props {
  recommendations: TieredRecommendation[];
  onSelect: (id: string) => void;
  livingArrangement: UserInput["livingArrangement"];
}

const COLOR_MAP: Record<string, { border: string; badge: string }> = {
  green: {
    border: "border-emerald-500 hover:border-emerald-400",
    badge: "bg-emerald-600 text-white",
  },
  blue: {
    border: "border-blue-500 hover:border-blue-400",
    badge: "bg-blue-600 text-white",
  },
  orange: {
    border: "border-amber-500 hover:border-amber-400",
    badge: "bg-amber-600 text-white",
  },
};

export default function RecommendationCards({
  recommendations,
  onSelect,
  livingArrangement,
}: Props) {
  if (recommendations.length === 0) return null;

  const rentLabel =
    livingArrangement === "own-room" || livingArrangement === "shared-room"
      ? "Rent (per person)"
      : "Rent";

  return (
    <div>
      <div
        className={`grid gap-4 ${
          recommendations.length === 1
            ? "grid-cols-1 max-w-md"
            : recommendations.length === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {recommendations.map((rec) => {
          const colors = COLOR_MAP[rec.color] || COLOR_MAP.blue;
          const n = rec.neighborhood;
          return (
            <button
              key={n.neighborhood.id}
              onClick={() => onSelect(n.neighborhood.id)}
              className={`text-left p-5 rounded-xl border-2 ${colors.border} bg-white/10 backdrop-blur-xl transition-all hover:bg-white/15`}
            >
              <span
                className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${colors.badge} mb-3`}
              >
                {rec.label}
              </span>
              <h3 className="text-xl font-bold text-white">
                {n.neighborhood.name}
              </h3>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-white">Match Score</span>
                  <span className="font-semibold text-white">
                    {Math.round(n.matchScore)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white">{rentLabel}</span>
                  <span className="font-semibold text-white">
                    ${n.perPersonRent.toLocaleString()}/mo
                  </span>
                </div>
                {n.commuteMinutes !== null && (
                  <div className="flex justify-between">
                    <span className="text-white">Commute</span>
                    <span className="font-semibold text-white">
                      {n.commuteMinutes} min
                      {n.commuteRoute && (
                        <span className="font-normal text-white ml-1">
                          ({n.commuteRoute})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white">Safety</span>
                  <span className="font-semibold text-white">
                    {n.scores.safety}/100
                  </span>
                </div>
                {/* Transit */}
                <div className="pt-2 border-t border-white/10 mt-2">
                  <span className="text-xs font-medium text-white uppercase tracking-wide">
                    Transit
                  </span>
                  {n.neighborhood.mbtaStations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {n.neighborhood.mbtaStations.map((s) => (
                          <span
                            key={`${s.line}-${s.name}`}
                            className="inline-flex items-center gap-1 text-xs bg-white/10 rounded px-1.5 py-0.5 text-white"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: MBTA_COLORS[s.line],
                              }}
                            />
                            {s.name}
                          </span>
                        ))}
                    </div>
                  )}
                  {n.neighborhood.busRoutes.length > 0 && (
                    <div className="text-xs text-white mt-1">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: MBTA_COLORS.bus }}
                        />
                        Bus {n.neighborhood.busRoutes.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {rec.tradeoffVsPrev && (
                <p className="mt-3 text-xs text-white italic">
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
