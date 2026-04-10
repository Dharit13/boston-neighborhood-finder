import type { UserInput, AgeGroup } from "@/lib/types";

interface Props {
  input: UserInput;
  onChange: (partial: Partial<UserInput>) => void;
}

const AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: "21-25", label: "21-25" },
  { value: "26-29", label: "26-29" },
  { value: "30-35", label: "30-35" },
];

export default function StepAboutYou({ input, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          About You
        </h2>
        <p className="text-white/50 text-sm mt-1">
          The basics so we can find the right fit.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">
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
                  : "border border-white/15 text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">
          Monthly Income (after tax)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-3 text-white/40 pointer-events-none">$</span>
          <input
            type="number"
            value={input.monthlyIncome || ""}
            onChange={(e) =>
              onChange({ monthlyIncome: parseInt(e.target.value) || 0 })
            }
            placeholder="5,000"
            className="w-full pl-8 pr-4 py-3 rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/25 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
          />
        </div>
      </div>

    </div>
  );
}
