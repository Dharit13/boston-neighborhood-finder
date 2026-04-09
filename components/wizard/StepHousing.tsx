import type { UserInput } from "@/lib/types";
import BudgetDisplay from "@/components/ui/BudgetDisplay";

interface Props {
  input: UserInput;
  onChange: (partial: Partial<UserInput>) => void;
}

const ARRANGEMENT_OPTIONS: {
  value: UserInput["livingArrangement"];
  label: string;
  description: string;
}[] = [
  {
    value: "alone",
    label: "Single",
    description: "Studio or 1BR, just you",
  },
  {
    value: "couple",
    label: "With Partner",
    description: "Sharing a bedroom as a couple",
  },
  {
    value: "own-room",
    label: "Roommates (own room)",
    description: "Each person gets their own bedroom",
  },
  {
    value: "shared-room",
    label: "Roommates (shared room)",
    description: "Sharing a bedroom to save on rent",
  },
];

const ROOMMATE_OPTIONS = [
  { value: 1, label: "1 roommate (2 people total)" },
  { value: 2, label: "2 roommates (3 people total)" },
  { value: 3, label: "3+ roommates (4 people total)" },
];

export default function StepHousing({ input, onChange }: Props) {
  const showRoommates =
    input.livingArrangement === "own-room" ||
    input.livingArrangement === "shared-room";

  const handleArrangementChange = (
    arrangement: UserInput["livingArrangement"]
  ) => {
    if (arrangement === "alone") {
      onChange({ livingArrangement: arrangement, roommates: 0 });
    } else if (arrangement === "couple") {
      onChange({ livingArrangement: arrangement, roommates: 1 });
    } else {
      onChange({
        livingArrangement: arrangement,
        roommates: input.roommates > 0 ? input.roommates : 1,
      });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Housing</h2>
      <p className="text-gray-600">
        Help us understand your housing situation and budget.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Living Arrangement
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ARRANGEMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleArrangementChange(opt.value)}
              className={`text-left py-3 px-4 rounded-lg border ${
                input.livingArrangement === opt.value
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-medium text-sm">{opt.label}</div>
              <div className="text-xs mt-0.5 opacity-75">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>

      {showRoommates && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How many roommates?
          </label>
          <div className="grid grid-cols-1 gap-2">
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
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Maximum monthly rent you&apos;re willing to pay (your share)
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
          This is your personal max — we&apos;ll also show cheaper options.
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
