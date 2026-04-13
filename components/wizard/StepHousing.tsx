import type { UserInput } from "@/lib/types";
import BudgetDisplay from "@/components/ui/BudgetDisplay";
import { parseMoneyInput, validateMaxRent } from "@/lib/validation";

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
    description: "Studio, 1BR, or 2BR, just you",
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

// The neighborhood dataset only carries studio/1BR/2BR rents, so every
// roommate config must fit inside a 2BR:
//   • own-room    → 1 roommate (2BR, each person has their own room)
//   • shared-room → 1 roommate (1BR, one shared bedroom)
//                 → 3 roommates (2BR, two pairs sharing rooms)
// "2 roommates" (which implied a 3BR own-room) was removed because the
// dataset can't price a 3BR unit.
const ROOMMATE_OPTIONS_OWN_ROOM = [
  { value: 1, label: "1 roommate (2 people, 2BR)" },
];
const ROOMMATE_OPTIONS_SHARED_ROOM = [
  { value: 1, label: "1 roommate (2 people, 1BR shared)" },
  { value: 3, label: "3 roommates (4 people, 2BR shared)" },
];

export default function StepHousing({ input, onChange }: Props) {
  const showRoommates =
    input.livingArrangement === "own-room" ||
    input.livingArrangement === "shared-room";

  const rentError = validateMaxRent(input.maxRent, input.monthlyIncome);

  const roommateOptions =
    input.livingArrangement === "own-room"
      ? ROOMMATE_OPTIONS_OWN_ROOM
      : ROOMMATE_OPTIONS_SHARED_ROOM;

  const handleArrangementChange = (
    arrangement: UserInput["livingArrangement"]
  ) => {
    if (arrangement === "alone") {
      // Single can pick studio / 1BR / 2BR — keep whatever they had.
      onChange({
        livingArrangement: arrangement,
        roommates: 0,
      });
    } else if (arrangement === "couple") {
      onChange({
        livingArrangement: arrangement,
        roommates: 1,
        apartmentSize: input.apartmentSize === "studio" ? "1br" : input.apartmentSize,
      });
    } else if (arrangement === "own-room") {
      // own-room caps at 1 roommate (2BR) because we don't have 3BR data.
      onChange({ livingArrangement: arrangement, roommates: 1 });
    } else {
      // shared-room: keep current pick if it's still valid (1 or 3), else 1.
      const nextRoommates = input.roommates === 3 ? 3 : 1;
      onChange({ livingArrangement: arrangement, roommates: nextRoommates });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Housing
        </h2>
        <p className="text-white text-sm mt-1">
          How you plan to live and what you can spend.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-2">
          Living Arrangement
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ARRANGEMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleArrangementChange(opt.value)}
              className={`text-left py-3 px-4 rounded-lg transition-all ${
                input.livingArrangement === opt.value
                  ? "bg-white text-black"
                  : "border border-white/15 text-white hover:text-white hover:border-white/30"
              }`}
            >
              <div
                className={`text-sm font-semibold ${
                  input.livingArrangement === opt.value
                    ? "text-black"
                    : "text-white"
                }`}
              >
                {opt.label}
              </div>
              <div
                className={`text-xs mt-0.5 ${
                  input.livingArrangement === opt.value
                    ? "text-black/60"
                    : "text-white"
                }`}
              >
                {opt.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {input.livingArrangement === "alone" && (
        <div>
          <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-2">
            Apartment Size
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "studio" as const, label: "Studio" },
              { value: "1br" as const, label: "1 Bedroom" },
              { value: "2br" as const, label: "2 Bedroom" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ apartmentSize: opt.value })}
                className={`py-2.5 px-4 rounded-lg text-center text-sm font-medium transition-all ${
                  input.apartmentSize === opt.value
                    ? "bg-white text-black"
                    : "border border-white/15 text-white hover:text-white hover:border-white/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {input.livingArrangement === "couple" && (
        <div>
          <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-2">
            Apartment Size
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "1br" as const, label: "1 Bedroom" },
              { value: "2br" as const, label: "2 Bedroom" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ apartmentSize: opt.value })}
                className={`py-2.5 px-4 rounded-lg text-center text-sm font-medium transition-all ${
                  input.apartmentSize === opt.value
                    ? "bg-white text-black"
                    : "border border-white/15 text-white hover:text-white hover:border-white/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showRoommates && (
        <div>
          <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-2">
            How many roommates?
          </label>
          <div className="grid grid-cols-1 gap-2">
            {roommateOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ roommates: opt.value })}
                className={`py-2.5 px-4 rounded-lg text-center text-sm font-medium transition-all ${
                  input.roommates === opt.value
                    ? "bg-white text-black"
                    : "border border-white/15 text-white hover:text-white hover:border-white/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-2">
          {input.livingArrangement === "own-room" ||
          input.livingArrangement === "shared-room"
            ? "Maximum monthly rent (your share)"
            : "Maximum monthly rent"}
        </label>
        <div className="relative">
          <span className="absolute left-4 top-3 text-white pointer-events-none">$</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={input.maxRent ? input.maxRent.toLocaleString() : ""}
            onChange={(e) =>
              onChange({ maxRent: parseMoneyInput(e.target.value) })
            }
            placeholder="2,500"
            aria-invalid={rentError !== null}
            className={`w-full pl-8 pr-4 py-3 rounded-lg bg-white/5 border text-white placeholder:text-white/50 focus:outline-none focus:ring-1 transition-all ${
              rentError
                ? "border-red-400/60 focus:border-red-400 focus:ring-red-400/30"
                : "border-white/15 focus:border-white/40 focus:ring-white/20"
            }`}
          />
        </div>
        {rentError && (
          <p className="mt-1.5 text-xs text-red-300">{rentError}</p>
        )}
      </div>

      {/* Budget Priority */}
      <div>
        <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-2">
          How do you feel about spending up to your max?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([
            {
              value: "save" as const,
              label: "Save Money",
              desc: "Prioritize cheaper areas",
            },
            {
              value: "balanced" as const,
              label: "Balanced",
              desc: "Weigh cost with other factors",
            },
            {
              value: "spend" as const,
              label: "Best Fit",
              desc: "Willing to pay for the right spot",
            },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ budgetPriority: opt.value })}
              className={`py-3 px-3 rounded-lg text-center transition-all ${
                input.budgetPriority === opt.value
                  ? "bg-white text-black"
                  : "border border-white/15 text-white hover:text-white hover:border-white/30"
              }`}
            >
              <div
                className={`text-sm font-semibold ${
                  input.budgetPriority === opt.value
                    ? "text-black"
                    : "text-white"
                }`}
              >
                {opt.label}
              </div>
              <div
                className={`text-xs mt-0.5 ${
                  input.budgetPriority === opt.value
                    ? "text-black/60"
                    : "text-white"
                }`}
              >
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      <BudgetDisplay
        monthlyIncome={input.monthlyIncome}
        maxRent={input.maxRent}
        roommates={input.roommates}
        livingArrangement={input.livingArrangement}
      />
    </div>
  );
}
