import type { UserInput, SliderValues } from "@/lib/types";
import TradeoffSlider from "@/components/ui/TradeoffSlider";

interface Props {
  input: UserInput;
  onChange: (partial: Partial<UserInput>) => void;
}

const SLIDER_CONFIG: {
  key: keyof SliderValues;
  left: string;
  right: string;
}[] = [
  {
    key: "nightlifeVsQuiet",
    left: "Nightlife & Dining",
    right: "Quiet & Residential",
  },
  {
    key: "urbanVsSuburban",
    left: "Urban & Walkable",
    right: "Spacious & Suburban",
  },
  {
    key: "trendyVsFamily",
    left: "Trendy & Young",
    right: "Established & Family-Friendly",
  },
  {
    key: "communityVsPrivacy",
    left: "Community & Social",
    right: "Privacy & Independence",
  },
  {
    key: "budgetVsConvenience",
    left: "Prioritize Budget",
    right: "Prioritize Convenience",
  },
];

export default function StepPreferences({ input, onChange }: Props) {
  const updateSlider = (key: keyof SliderValues, value: number) => {
    onChange({ sliders: { ...input.sliders, [key]: value } });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">What Matters to You</h2>
      <p className="text-gray-600">
        Slide each tradeoff to match your preferences. These shape how we rank
        neighborhoods for you.
      </p>

      <div className="space-y-8">
        {SLIDER_CONFIG.map((config) => (
          <TradeoffSlider
            key={config.key}
            leftLabel={config.left}
            rightLabel={config.right}
            value={input.sliders[config.key]}
            onChange={(v) => updateSlider(config.key, v)}
          />
        ))}
      </div>
    </div>
  );
}
