import { calculateBudgetTiers, calculatePerPersonBudget, getActiveTiers } from "@/lib/budget";

interface Props {
  monthlyIncome: number;
  maxRent: number;
  roommates: number;
}

const TIER_CONFIG = {
  saver: { label: "Budget Saver", sublabel: "45% of income", color: "green" },
  balanced: { label: "Balanced", sublabel: "60% of income", color: "blue" },
  stretched: { label: "At Your Max", sublabel: "Your limit", color: "orange" },
} as const;

export default function BudgetDisplay({
  monthlyIncome,
  maxRent,
  roommates,
}: Props) {
  if (!monthlyIncome || !maxRent) return null;

  const tiers = calculateBudgetTiers(monthlyIncome, maxRent);
  const activeTiers = getActiveTiers(monthlyIncome, maxRent);

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">
        Your budget tiers {roommates > 0 ? `(per person with ${roommates} roommate${roommates > 1 ? "s" : ""})` : ""}:
      </p>
      {(Object.entries(TIER_CONFIG) as [keyof typeof TIER_CONFIG, typeof TIER_CONFIG[keyof typeof TIER_CONFIG]][]).map(
        ([key, config]) => {
          if (!activeTiers.includes(key)) return null;
          const totalBudget = tiers[key];
          const perPerson = calculatePerPersonBudget(totalBudget, roommates);
          const colorClasses = {
            green: "bg-green-50 border-green-200 text-green-800",
            blue: "bg-blue-50 border-blue-200 text-blue-800",
            orange: "bg-orange-50 border-orange-200 text-orange-800",
          };
          return (
            <div
              key={key}
              className={`p-3 rounded-lg border ${colorClasses[config.color]}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{config.label}</span>
                  <span className="text-sm ml-2 opacity-75">
                    ({config.sublabel})
                  </span>
                </div>
                <span className="font-bold text-lg">
                  ${perPerson.toLocaleString()}/mo
                </span>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}
