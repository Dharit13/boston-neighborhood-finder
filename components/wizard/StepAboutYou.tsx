import type { UserInput, AgeGroup } from "@/lib/types";

interface Props {
  input: UserInput;
  onChange: (partial: Partial<UserInput>) => void;
}

const AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: "18-24", label: "18-24" },
  { value: "25-30", label: "25-30" },
  { value: "31-40", label: "31-40" },
  { value: "41-50", label: "41-50" },
  { value: "50+", label: "50+" },
];

export default function StepAboutYou({ input, onChange }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">About You</h2>
      <p className="text-gray-600">
        Tell us a bit about yourself so we can find the right neighborhood.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Age Group
        </label>
        <select
          value={input.ageGroup}
          onChange={(e) => onChange({ ageGroup: e.target.value as AgeGroup })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {AGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Monthly Income (after tax)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2 text-gray-500">$</span>
          <input
            type="number"
            value={input.monthlyIncome || ""}
            onChange={(e) =>
              onChange({ monthlyIncome: parseInt(e.target.value) || 0 })
            }
            placeholder="5000"
            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Do you have a car?
        </label>
        <div className="flex gap-4">
          <button
            onClick={() => onChange({ hasCar: false })}
            className={`flex-1 py-2 rounded-lg border text-center ${
              !input.hasCar
                ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            No
          </button>
          <button
            onClick={() => onChange({ hasCar: true })}
            className={`flex-1 py-2 rounded-lg border text-center ${
              input.hasCar
                ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
