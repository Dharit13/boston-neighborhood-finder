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
  { value: "red", label: "Red Line", color: "bg-red-500" },
  { value: "green", label: "Green Line", color: "bg-green-600" },
  { value: "blue", label: "Blue Line", color: "bg-blue-600" },
  { value: "orange", label: "Orange Line", color: "bg-orange-500" },
  { value: "silver", label: "Silver Line", color: "bg-gray-400" },
  { value: "bus", label: "Bus", color: "bg-yellow-500" },
  { value: "ferry", label: "Ferry", color: "bg-cyan-500" },
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Commute</h2>
      <p className="text-gray-600">
        Tell us about your work commute so we can optimize your neighborhood.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          How many days do you go to the office?
        </label>
        <div className="grid grid-cols-2 gap-3">
          {DISPLAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ officeDays: opt.value })}
              className={`py-2 px-3 rounded-lg border text-center text-sm ${
                input.officeDays === opt.value
                  ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showAddress && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Office Address
          </label>
          <input
            type="text"
            value={input.officeAddress || ""}
            onChange={(e) => onChange({ officeAddress: e.target.value })}
            placeholder="e.g., 1 Kendall Square, Cambridge, MA"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            We&apos;ll calculate transit commute times from each neighborhood.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          MBTA Line Preference (optional)
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Select lines you prefer — we&apos;ll boost neighborhoods on those lines.
        </p>
        <div className="flex flex-wrap gap-2">
          {MBTA_LINES.map((line) => {
            const selected = input.mbtaPreference.includes(line.value);
            return (
              <button
                key={line.value}
                onClick={() => toggleMbtaLine(line.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                  selected
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-full ${line.color}`}
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
