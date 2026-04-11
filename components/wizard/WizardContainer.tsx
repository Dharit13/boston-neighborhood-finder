"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepAboutYou from "./StepAboutYou";
import StepHousing from "./StepHousing";
import StepCommute from "./StepCommute";
import StepPreferences from "./StepPreferences";
import { SidePixelTrail } from "@/components/ui/SidePixelTrail";
import { isMonthlyIncomeValid, isMaxRentValid } from "@/lib/validation";
import type { UserInput, OfficeDays, SliderValues, BudgetPriority } from "@/lib/types";

const STEPS = [
  { label: "You", icon: "01" },
  { label: "Housing", icon: "02" },
  { label: "Commute", icon: "03" },
  { label: "Vibe", icon: "04" },
];

const DEFAULT_SLIDERS: SliderValues = {
  nightlifeVsQuiet: 3,
  urbanVsSuburban: 3,
  trendyVsFamily: 3,
  communityVsPrivacy: 3,
  budgetVsConvenience: 3,
};

const DEFAULT_INPUT: UserInput = {
  ageGroup: "26-29",
  monthlyIncome: 0,
  roommates: 0,
  livingArrangement: "alone" as const,
  apartmentSize: "studio" as const,
  maxRent: 0,
  budgetPriority: "balanced" as BudgetPriority,
  officeDays: 0 as OfficeDays,
  officeAddress: null,
  mbtaPreference: [],
  sliders: DEFAULT_SLIDERS,
  avoidCollegeArea: false,
  needsParking: false,
};

export default function WizardContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<UserInput>(DEFAULT_INPUT);

  useEffect(() => {
    // sessionStorage is a client-only external store; read once on mount to
    // rehydrate prior wizard progress. SSR renders with DEFAULT_INPUT to avoid
    // hydration mismatch.
    const stored = sessionStorage.getItem("wizardInput");
    if (stored) {
      try {
        const parsed: Partial<UserInput> = JSON.parse(stored);
        // Sanitize legacy roommate values. The "2 roommates" option was
        // removed because the dataset has no 3BR rent data — stale sessions
        // holding `roommates: 2` would silently fall back to 2BR / 3 and
        // under-price per-person rent. Clamp to the closest valid value for
        // the chosen arrangement.
        if (typeof parsed.roommates === "number") {
          if (parsed.livingArrangement === "own-room") {
            parsed.roommates = 1;
          } else if (parsed.livingArrangement === "shared-room") {
            parsed.roommates = parsed.roommates === 3 ? 3 : 1;
          }
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setInput((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
    const startStep = parseInt(searchParams.get("step") || "0");
    if (startStep >= 0 && startStep <= 3) {
      setStep(startStep);
    }
  }, [searchParams]);

  const updateInput = (partial: Partial<UserInput>) => {
    setInput((prev) => ({ ...prev, ...partial }));
  };

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = () => {
    sessionStorage.setItem("wizardInput", JSON.stringify(input));
    router.push("/results");
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return isMonthlyIncomeValid(input.monthlyIncome);
      case 1:
        return isMaxRentValid(input.maxRent, input.monthlyIncome);
      case 2:
        return input.officeDays <= 2 || !!input.officeAddress;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.aiscribbles.com/34fe5695dbc942628e3cad9744e8ae13.png?v=60d084"
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-70"
      />

      {/* Cursor pixel trail — side strips only, never behind the card */}
      <SidePixelTrail centerWidthRem={36} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-xl mx-auto px-4 py-4">
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Boston Neighbourhood Finder
          </h1>
          <p className="text-white/70 text-xs mt-1">
            Find your perfect neighborhood based on your budget, commute, and lifestyle.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all ${
                  i === step
                    ? "bg-white/15 text-white border border-white/20 backdrop-blur-sm"
                    : i < step
                    ? "text-white/70 hover:text-white cursor-pointer"
                    : "text-white/25 cursor-default"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i < step
                      ? "bg-white text-black"
                      : i === step
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/30"
                  }`}
                >
                  {i < step ? "\u2713" : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < 3 && (
                <div
                  className={`w-6 sm:w-10 h-px mx-1 ${
                    i < step ? "bg-white/40" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="p-6">
            {step === 0 && <StepAboutYou input={input} onChange={updateInput} />}
            {step === 1 && <StepHousing input={input} onChange={updateInput} />}
            {step === 2 && <StepCommute input={input} onChange={updateInput} />}
            {step === 3 && (
              <StepPreferences input={input} onChange={updateInput} />
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center px-6 py-4 border-t border-white/10 bg-white/[0.02]">
            <button
              onClick={prev}
              disabled={step === 0}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/50 border border-white/10 hover:text-white hover:border-white/25 disabled:opacity-0 disabled:pointer-events-none transition-all"
            >
              Back
            </button>
            {step < 3 ? (
              <button
                onClick={next}
                disabled={!canProceed()}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={submit}
                className="px-8 py-3 rounded-lg text-sm font-semibold bg-white text-black hover:bg-white/90 transition-all shadow-lg shadow-white/10"
              >
                Find My Neighborhood
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
