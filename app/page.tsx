import { Suspense } from "react";
import WizardContainer from "@/components/wizard/WizardContainer";

export default function Home() {
  return (
    <Suspense>
      <WizardContainer />
    </Suspense>
  );
}
