import type { UserInput, SliderValues } from "@/lib/types";

interface Props {
  input: UserInput;
  onChange: (partial: Partial<UserInput>) => void;
}

const VIBE_OPTIONS: {
  label: string;
  description: string;
  emoji: string;
  color: string;
  selectedColor: string;
  sliders: SliderValues;
}[] = [
  {
    label: "City Life",
    description:
      "Walkable urban core with restaurants, bars, and energy on your doorstep",
    emoji: "\ud83c\udf03",
    color: "border-amber-500/30 bg-amber-500/5",
    selectedColor: "border-amber-400 bg-amber-500/20 shadow-amber-500/10",
    sliders: {
      nightlifeVsQuiet: 1,
      urbanVsSuburban: 1,
      trendyVsFamily: 2,
      // Urban-core residents skew toward privacy/anonymity, not tight
      // community. Leaving this at 2 (community-leaning) used to boost
      // residential-but-less-urban neighborhoods (Somerville, JP) over
      // the actual city core (Downtown Crossing, Chinatown, West End).
      communityVsPrivacy: 4,
      budgetVsConvenience: 4,
    },
  },
  {
    label: "Young Professional",
    description:
      "Good mix of going out and getting work done, close to transit",
    emoji: "\ud83d\udcbc",
    color: "border-blue-500/30 bg-blue-500/5",
    selectedColor: "border-blue-400 bg-blue-500/20 shadow-blue-500/10",
    sliders: {
      nightlifeVsQuiet: 2,
      urbanVsSuburban: 2,
      trendyVsFamily: 2,
      communityVsPrivacy: 3,
      budgetVsConvenience: 3,
    },
  },
  {
    label: "Quiet & Cozy",
    description:
      "Calm residential streets, coffee shops over clubs, a slower pace",
    emoji: "\ud83c\udfe1",
    color: "border-emerald-500/30 bg-emerald-500/5",
    selectedColor: "border-emerald-400 bg-emerald-500/20 shadow-emerald-500/10",
    sliders: {
      nightlifeVsQuiet: 4,
      urbanVsSuburban: 4,
      trendyVsFamily: 4,
      communityVsPrivacy: 3,
      budgetVsConvenience: 2,
    },
  },
  {
    label: "Social Butterfly",
    description:
      "Maximum nightlife, events, and community \u2014 always something happening",
    emoji: "\ud83c\udf89",
    color: "border-rose-500/30 bg-rose-500/5",
    selectedColor: "border-rose-400 bg-rose-500/20 shadow-rose-500/10",
    sliders: {
      nightlifeVsQuiet: 1,
      urbanVsSuburban: 1,
      trendyVsFamily: 1,
      communityVsPrivacy: 1,
      budgetVsConvenience: 4,
    },
  },
  {
    label: "Commute First",
    description: "Prioritize a short, easy commute above all else",
    emoji: "\ud83d\ude87",
    color: "border-cyan-500/30 bg-cyan-500/5",
    selectedColor: "border-cyan-400 bg-cyan-500/20 shadow-cyan-500/10",
    sliders: {
      nightlifeVsQuiet: 3,
      urbanVsSuburban: 3,
      trendyVsFamily: 3,
      communityVsPrivacy: 3,
      budgetVsConvenience: 5,
    },
  },
  {
    label: "Family Friendly",
    description:
      "Safe, quiet neighborhoods with parks, schools, and strong community",
    emoji: "\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67",
    color: "border-yellow-500/30 bg-yellow-500/5",
    selectedColor: "border-yellow-400 bg-yellow-500/20 shadow-yellow-500/10",
    sliders: {
      nightlifeVsQuiet: 5,
      urbanVsSuburban: 4,
      trendyVsFamily: 5,
      communityVsPrivacy: 2,
      budgetVsConvenience: 2,
    },
  },
];

function slidersMatch(a: SliderValues, b: SliderValues): boolean {
  return (
    a.nightlifeVsQuiet === b.nightlifeVsQuiet &&
    a.urbanVsSuburban === b.urbanVsSuburban &&
    a.trendyVsFamily === b.trendyVsFamily &&
    a.communityVsPrivacy === b.communityVsPrivacy &&
    a.budgetVsConvenience === b.budgetVsConvenience
  );
}

export default function StepPreferences({ input, onChange }: Props) {
  const selectedVibe = VIBE_OPTIONS.find((v) =>
    slidersMatch(v.sliders, input.sliders)
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Pick Your Vibe
        </h2>
        <p className="text-white/50 text-sm mt-1">
          What kind of neighborhood feels like home to you?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {VIBE_OPTIONS.map((vibe) => {
          const isSelected = selectedVibe === vibe;
          return (
            <button
              key={vibe.label}
              onClick={() => onChange({ sliders: vibe.sliders })}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? `${vibe.selectedColor} shadow-lg`
                  : `${vibe.color} hover:bg-white/5`
              }`}
            >
              <span className="text-2xl">{vibe.emoji}</span>
              <span
                className={`text-sm font-semibold ${
                  isSelected ? "text-white" : "text-white/80"
                }`}
              >
                {vibe.label}
              </span>
              <span className="text-xs leading-relaxed text-white/40">
                {vibe.description}
              </span>
            </button>
          );
        })}
      </div>

      {selectedVibe && (
        <p className="text-xs text-white/30 text-center">
          We&apos;ll prioritize neighborhoods that match the{" "}
          <span className="text-white/60 font-medium">
            {selectedVibe.label}
          </span>{" "}
          lifestyle.
        </p>
      )}

      {/* Dealbreakers */}
      <div className="pt-5 border-t border-white/10">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-2">
          Dealbreakers
        </p>
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => onChange({ avoidCollegeArea: !input.avoidCollegeArea })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                input.avoidCollegeArea
                  ? "bg-white border-white"
                  : "bg-white/5 border-white/20 group-hover:border-white/40"
              }`}
            >
              {input.avoidCollegeArea && (
                <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                </svg>
              )}
            </div>
            <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
              Avoid college/university areas
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChange({ needsParking: !input.needsParking })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                input.needsParking
                  ? "bg-white border-white"
                  : "bg-white/5 border-white/20 group-hover:border-white/40"
              }`}
            >
              {input.needsParking && (
                <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                </svg>
              )}
            </div>
            <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
              I have a car — need easy parking
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
