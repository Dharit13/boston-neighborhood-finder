"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepAboutYou from "./StepAboutYou";
import StepHousing from "./StepHousing";
import StepCommute from "./StepCommute";
import StepPreferences from "./StepPreferences";
import type { UserInput, AgeGroup, OfficeDays, MbtaLine, SliderValues } from "@/lib/types";

const STEP_LABELS = ["About You", "Housing", "Commute", "Preferences"];

const DEFAULT_SLIDERS: SliderValues = {
  nightlifeVsQuiet: 3,
  urbanVsSuburban: 3,
  trendyVsFamily: 3,
  communityVsPrivacy: 3,
  budgetVsConvenience: 3,
};

export default function WizardContainer() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<UserInput>({
    ageGroup: "25-30",
    monthlyIncome: 0,
    hasCar: false,
    roommates: 0,
    maxRent: 0,
    officeDays: 0 as OfficeDays,
    officeAddress: null,
    mbtaPreference: [],
    sliders: DEFAULT_SLIDERS,
  });

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
        return input.monthlyIncome > 0;
      case 1:
        return input.maxRent > 0;
      case 2:
        return input.officeDays <= 2 || !!input.officeAddress;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i <= step
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`ml-2 text-sm hidden sm:inline ${
                i <= step ? "text-blue-600 font-medium" : "text-gray-400"
              }`}
            >
              {label}
            </span>
            {i < 3 && (
              <div
                className={`w-8 sm:w-16 h-0.5 mx-2 ${
                  i < step ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {step === 0 && <StepAboutYou input={input} onChange={updateInput} />}
        {step === 1 && <StepHousing input={input} onChange={updateInput} />}
        {step === 2 && <StepCommute input={input} onChange={updateInput} />}
        {step === 3 && <StepPreferences input={input} onChange={updateInput} />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={prev}
          disabled={step === 0}
          className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-30 hover:bg-gray-50"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            onClick={next}
            disabled={!canProceed()}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-30 hover:bg-blue-700"
          >
            Next
          </button>
        ) : (
          <button
            onClick={submit}
            className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            Find My Neighborhood
          </button>
        )}
      </div>
    </div>
  );
}
