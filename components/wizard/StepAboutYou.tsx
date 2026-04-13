import type { UserInput, AgeGroup } from "@/lib/types";
import { parseMoneyInput, validateMonthlyIncome } from "@/lib/validation";

interface Props {
  input: UserInput;
  onChange: (partial: Partial<UserInput>) => void;
}

const AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: "21-25", label: "21-25" },
  { value: "26-29", label: "26-29" },
  { value: "30-35", label: "30-35" },
  { value: "36-40", label: "36-40" },
];

export default function StepAboutYou({ input, onChange }: Props) {
  const incomeError = validateMonthlyIncome(input.monthlyIncome);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          About You
        </h2>
        <p className="text-white text-sm mt-1">
          The basics so we can find the right fit.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-2">
          Age Group
        </label>
        <div className="flex flex-wrap gap-2">
          {AGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ageGroup: opt.value })}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                input.ageGroup === opt.value
                  ? "bg-white text-black"
                  : "border border-white/15 text-white hover:text-white hover:border-white/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white uppercase tracking-widest mb-2">
          Monthly Household Income (after tax)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-3 text-white pointer-events-none">$</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={input.monthlyIncome ? input.monthlyIncome.toLocaleString() : ""}
            onChange={(e) =>
              onChange({ monthlyIncome: parseMoneyInput(e.target.value) })
            }
            placeholder="5,000"
            aria-invalid={incomeError !== null}
            className={`w-full pl-8 pr-4 py-3 rounded-lg bg-white/5 border text-white placeholder:text-white/50 focus:outline-none focus:ring-1 transition-all ${
              incomeError
                ? "border-red-400/60 focus:border-red-400 focus:ring-red-400/30"
                : "border-white/15 focus:border-white/40 focus:ring-white/20"
            }`}
          />
        </div>
        {incomeError && (
          <p className="mt-1.5 text-xs text-red-300">{incomeError}</p>
        )}
      </div>

    </div>
  );
}
