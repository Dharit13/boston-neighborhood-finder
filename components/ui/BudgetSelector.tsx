import { calculateBudgetTiers, getActiveTiers } from "@/lib/budget";
import type { UserInput, BudgetPriority } from "@/lib/types";

interface Props {
  monthlyIncome: number;
  maxRent: number;
  roommates: number;
  livingArrangement?: UserInput["livingArrangement"];
  budgetPriority: BudgetPriority;
  onChange: (partial: Partial<UserInput>) => void;
}

const TIER_OPTIONS: {
  tier: "saver" | "balanced" | "stretched";
  priority: BudgetPriority;
  label: string;
  desc: string;
  sublabel: string;
  color: string;
  selectedColor: string;
}[] = [
  {
    tier: "saver",
    priority: "save",
    label: "Save Money",
    desc: "Prioritize cheaper areas",
    sublabel: "45% of income",
    color: "border-emerald-500/40 text-emerald-300",
    selectedColor: "border-emerald-500 bg-emerald-500/30 text-emerald-300",
  },
  {
    tier: "balanced",
    priority: "balanced",
    label: "Balanced",
    desc: "What you'd normally pay",
    sublabel: "Your rent",
    color: "border-blue-500/40 text-blue-300",
    selectedColor: "border-blue-500 bg-blue-500/30 text-blue-300",
  },
  {
    tier: "stretched",
    priority: "spend",
    label: "Stretch Budget",
    desc: "Willing to spend more for the right spot",
    sublabel: "70% of income",
    color: "border-amber-500/40 text-amber-300",
    selectedColor: "border-amber-500 bg-amber-500/30 text-amber-300",
  },
];

export default function BudgetSelector({
  monthlyIncome,
  maxRent,
  roommates,
  livingArrangement,
  budgetPriority,
  onChange,
}: Props) {
  const hasBudgetData = monthlyIncome > 0 && maxRent > 0;
  const tiers = hasBudgetData
    ? calculateBudgetTiers(monthlyIncome, maxRent)
    : null;
  const activeTiers = hasBudgetData
    ? getActiveTiers(monthlyIncome, maxRent)
    : ["saver", "balanced", "stretched"];

  const isRoommateSplit =
    livingArrangement === "own-room" || livingArrangement === "shared-room";

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-white uppercase tracking-widest">
        Budget Priority
        {hasBudgetData && isRoommateSplit && roommates > 0
          ? ` (per person with ${roommates} roommate${roommates > 1 ? "s" : ""})`
          : ""}
      </label>
      <div className="grid grid-cols-3 gap-2">
        {TIER_OPTIONS.map((opt) => {
          if (!activeTiers.includes(opt.tier)) return null;
          const isSelected = budgetPriority === opt.priority;
          const amount = tiers ? tiers[opt.tier] : null;
          return (
            <button
              key={opt.priority}
              onClick={() => onChange({ budgetPriority: opt.priority })}
              className={`py-3 px-3 rounded-lg text-center transition-all border ${
                isSelected ? opt.selectedColor : opt.color
              }`}
            >
              <div className="text-sm font-semibold text-white">
                {opt.label}
              </div>
              {amount !== null && (
                <div className="text-lg font-bold mt-1">
                  ${amount.toLocaleString()}
                  <span className="text-xs font-normal opacity-80">/mo</span>
                </div>
              )}
              <div className="text-xs mt-0.5 text-white/70">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
