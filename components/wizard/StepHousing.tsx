import type { UserInput } from "@/lib/types";
import BudgetDisplay from "@/components/ui/BudgetDisplay";

interface Props {
  input: UserInput;
  onChange: (partial: Partial<UserInput>) => void;
}

const ROOMMATE_OPTIONS = [
  { value: 0, label: "0 (living alone)" },
  { value: 1, label: "1 roommate" },
  { value: 2, label: "2 roommates" },
  { value: 3, label: "3+ roommates" },
];

export default function StepHousing({ input, onChange }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Housing</h2>
      <p className="text-gray-600">
        Help us understand your housing situation and budget.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Number of Roommates
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ROOMMATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ roommates: opt.value })}
              className={`py-2 px-3 rounded-lg border text-center text-sm ${
                input.roommates === opt.value
                  ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Maximum monthly rent you&apos;re willing to pay
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2 text-gray-500">$</span>
          <input
            type="number"
            value={input.maxRent || ""}
            onChange={(e) =>
              onChange({ maxRent: parseInt(e.target.value) || 0 })
            }
            placeholder="2500"
            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          This is the absolute max — we&apos;ll also show cheaper options.
        </p>
      </div>

      <BudgetDisplay
        monthlyIncome={input.monthlyIncome}
        maxRent={input.maxRent}
        roommates={input.roommates}
      />
    </div>
  );
}
