import { calculateBudgetTiers, getActiveTiers } from "@/lib/budget";
import type { UserInput } from "@/lib/types";

interface Props {
  monthlyIncome: number;
  maxRent: number;
  roommates: number;
  livingArrangement?: UserInput["livingArrangement"];
}

const TIER_CONFIG = {
  saver: { label: "Budget Saver", sublabel: "45% of income", color: "emerald" },
  balanced: { label: "Balanced", sublabel: "60% of income", color: "blue" },
  stretched: { label: "At Your Max", sublabel: "Your limit", color: "amber" },
} as const;

export default function BudgetDisplay({
  monthlyIncome,
  maxRent,
  roommates,
  livingArrangement,
}: Props) {
  if (!monthlyIncome || !maxRent) return null;

  const tiers = calculateBudgetTiers(monthlyIncome, maxRent);
  const activeTiers = getActiveTiers(monthlyIncome, maxRent);

  const colorClasses: Record<string, string> = {
    emerald: "border-emerald-500 bg-emerald-500/30 text-emerald-300",
    blue: "border-blue-500 bg-blue-500/30 text-blue-300",
    amber: "border-amber-500 bg-amber-500/30 text-amber-300",
  };

  const isRoommateSplit =
    livingArrangement === "own-room" || livingArrangement === "shared-room";

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold text-white uppercase tracking-widest">
        Your budget tiers{" "}
        {isRoommateSplit && roommates > 0
          ? `(per person with ${roommates} roommate${roommates > 1 ? "s" : ""})`
          : ""}
      </p>
      {(
        Object.entries(TIER_CONFIG) as [
          keyof typeof TIER_CONFIG,
          (typeof TIER_CONFIG)[keyof typeof TIER_CONFIG]
        ][]
      ).map(([key, config]) => {
        if (!activeTiers.includes(key)) return null;
        const perPerson = tiers[key];
        return (
          <div
            key={key}
            className={`p-3 rounded-lg border ${colorClasses[config.color]}`}
          >
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium text-sm">{config.label}</span>
                <span className="text-xs ml-2 opacity-80">
                  ({config.sublabel})
                </span>
              </div>
              <span className="font-bold">${perPerson.toLocaleString()}/mo</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
