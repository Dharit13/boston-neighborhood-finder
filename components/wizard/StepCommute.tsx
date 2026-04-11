import type { UserInput, OfficeDays, MbtaLine } from "@/lib/types";

interface Props {
  input: UserInput;
  onChange: (partial: Partial<UserInput>) => void;
}

const DISPLAY_OPTIONS = [
  { value: 0 as OfficeDays, label: "Fully Remote" },
  { value: 2 as OfficeDays, label: "1-2 days" },
  { value: 3 as OfficeDays, label: "3-4 days" },
  { value: 5 as OfficeDays, label: "5 days" },
];

const MBTA_LINES: { value: MbtaLine; label: string; color: string }[] = [
  { value: "red", label: "Red", color: "#da291c" },
  { value: "green", label: "Green", color: "#00843d" },
  { value: "blue", label: "Blue", color: "#003da5" },
  { value: "orange", label: "Orange", color: "#ed8b00" },
  { value: "silver", label: "Silver", color: "#7c878e" },
  { value: "bus", label: "Bus", color: "#f5b400" },
  { value: "ferry", label: "Ferry", color: "#00b4d8" },
];

export default function StepCommute({ input, onChange }: Props) {
  const showAddress = input.officeDays > 2;

  const toggleMbtaLine = (line: MbtaLine) => {
    const current = input.mbtaPreference;
    if (current.includes(line)) {
      onChange({ mbtaPreference: current.filter((l) => l !== line) });
    } else {
      onChange({ mbtaPreference: [...current, line] });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Your Commute
        </h2>
        <p className="text-white/50 text-sm mt-1">
          Where do you need to get to, and how often?
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">
          Office days per week
        </label>
        <div className="grid grid-cols-2 gap-3">
          {DISPLAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ officeDays: opt.value })}
              className={`py-3 px-4 rounded-lg text-sm font-medium text-center transition-all ${
                input.officeDays === opt.value
                  ? "bg-white text-black"
                  : "border border-white/15 text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showAddress && (
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">
            Office Address
          </label>
          <input
            type="text"
            value={input.officeAddress || ""}
            onChange={(e) => onChange({ officeAddress: e.target.value })}
            placeholder="e.g., 1 Kendall Square, Cambridge, MA"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/25 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
          />
          <p className="mt-2 text-xs text-white/30">
            We&apos;ll calculate transit commute times from each neighborhood.
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">
          Preferred MBTA Lines
        </label>
        <p className="text-xs text-white/30 mb-3">
          Select lines you prefer — we&apos;ll boost neighborhoods on those
          lines.
        </p>
        <div className="flex flex-wrap gap-2">
          {MBTA_LINES.map((line) => {
            const selected = input.mbtaPreference.includes(line.value);
            return (
              <button
                key={line.value}
                onClick={() => toggleMbtaLine(line.value)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                  selected
                    ? "bg-white text-black"
                    : "border border-white/15 text-white/60 hover:text-white hover:border-white/30"
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: line.color }}
                />
                {line.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
