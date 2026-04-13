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
    color: "border-amber-500/60 bg-amber-500/15",
    selectedColor: "border-amber-400 bg-amber-500/40 shadow-amber-500/20",
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
    color: "border-blue-500/60 bg-blue-500/15",
    selectedColor: "border-blue-400 bg-blue-500/40 shadow-blue-500/20",
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
    color: "border-emerald-500/60 bg-emerald-500/15",
    selectedColor: "border-emerald-400 bg-emerald-500/40 shadow-emerald-500/20",
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
    color: "border-rose-500/60 bg-rose-500/15",
    selectedColor: "border-rose-400 bg-rose-500/40 shadow-rose-500/20",
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
    color: "border-cyan-500/60 bg-cyan-500/15",
    selectedColor: "border-cyan-400 bg-cyan-500/40 shadow-cyan-500/20",
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
    color: "border-yellow-500/60 bg-yellow-500/15",
    selectedColor: "border-yellow-400 bg-yellow-500/40 shadow-yellow-500/20",
    sliders: {
      nightlifeVsQuiet: 5,
      urbanVsSuburban: 4,
      trendyVsFamily: 5,
      communityVsPrivacy: 2,
      budgetVsConvenience: 2,
    },
  },
];

function averageSliders(vibes: typeof VIBE_OPTIONS): SliderValues {
  if (vibes.length === 0) {
    return { nightlifeVsQuiet: 3, urbanVsSuburban: 3, trendyVsFamily: 3, communityVsPrivacy: 3, budgetVsConvenience: 3 };
  }
  const sum = { nightlifeVsQuiet: 0, urbanVsSuburban: 0, trendyVsFamily: 0, communityVsPrivacy: 0, budgetVsConvenience: 0 };
  for (const v of vibes) {
    sum.nightlifeVsQuiet += v.sliders.nightlifeVsQuiet;
    sum.urbanVsSuburban += v.sliders.urbanVsSuburban;
    sum.trendyVsFamily += v.sliders.trendyVsFamily;
    sum.communityVsPrivacy += v.sliders.communityVsPrivacy;
    sum.budgetVsConvenience += v.sliders.budgetVsConvenience;
  }
  const n = vibes.length;
  // Keep precise floats — rounding loses the signal when 2 of 3 vibes
  // lean the same way (e.g. urban 1+1+3 → 1.67, not rounded to 2).
  return {
    nightlifeVsQuiet: sum.nightlifeVsQuiet / n,
    urbanVsSuburban: sum.urbanVsSuburban / n,
    trendyVsFamily: sum.trendyVsFamily / n,
    communityVsPrivacy: sum.communityVsPrivacy / n,
    budgetVsConvenience: sum.budgetVsConvenience / n,
  };
}

// Compute lifestyle strength from the original vibes, not the averaged sliders.
// For each vibe, measure its average deviation from center (3). Then take the
// max across all selected vibes so that 2 urban picks don't dilute the signal.
function computeVibeStrength(vibes: typeof VIBE_OPTIONS): number | undefined {
  if (vibes.length === 0) return undefined;
  if (vibes.length === 1) return undefined; // single vibe — let deriveWeights compute from sliders directly
  let maxStrength = 0;
  for (const v of vibes) {
    const devs = [
      Math.abs(v.sliders.nightlifeVsQuiet - 3),
      Math.abs(v.sliders.urbanVsSuburban - 3),
      Math.abs(v.sliders.trendyVsFamily - 3),
      Math.abs(v.sliders.communityVsPrivacy - 3),
    ];
    const avg = devs.reduce((a, b) => a + b, 0) / 4;
    maxStrength = Math.max(maxStrength, avg / 2);
  }
  return maxStrength;
}

export default function StepPreferences({ input, onChange }: Props) {
  const selected = input.selectedVibes ?? [];

  const toggleVibe = (label: string) => {
    const next = selected.includes(label)
      ? selected.filter((l) => l !== label)
      : [...selected, label];
    const matchedVibes = VIBE_OPTIONS.filter((v) => next.includes(v.label));
    onChange({
      selectedVibes: next,
      sliders: averageSliders(matchedVibes),
      vibeStrength: computeVibeStrength(matchedVibes),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Pick Your Vibe
        </h2>
        <p className="text-white text-sm mt-1">
          Select one or more that feel like home to you. We&apos;ll blend your picks for better matches.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {VIBE_OPTIONS.map((vibe) => {
          const isSelected = selected.includes(vibe.label);
          return (
            <button
              key={vibe.label}
              onClick={() => toggleVibe(vibe.label)}
              className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? `${vibe.selectedColor} shadow-lg ring-2 ring-white/70 scale-[1.02]`
                  : "border-white/10 bg-white/[0.03] opacity-60 hover:opacity-90 hover:border-white/25 hover:bg-white/[0.06]"
              }`}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <svg className="w-3 h-3 text-black" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                  </svg>
                </span>
              )}
              <span className={`text-2xl transition-all ${isSelected ? "" : "grayscale"}`}>
                {vibe.emoji}
              </span>
              <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-white/70"}`}>
                {vibe.label}
              </span>
              <span className={`text-xs leading-relaxed ${isSelected ? "text-white" : "text-white/60"}`}>
                {vibe.description}
              </span>
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-white text-center">
          We&apos;ll blend neighborhoods matching{" "}
          <span className="text-white font-medium">
            {selected.join(" + ")}
          </span>
          .
        </p>
      )}

      {/* Dealbreakers */}
      <div className="pt-5 border-t border-white/10">
        <p className="text-xs font-semibold text-white uppercase tracking-widest mb-2">
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
            <span className="text-sm text-white group-hover:text-white transition-colors">
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
            <span className="text-sm text-white group-hover:text-white transition-colors">
              I have a car — need easy parking
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
