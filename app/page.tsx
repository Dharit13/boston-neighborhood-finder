import WizardContainer from "@/components/wizard/WizardContainer";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Boston Neighbourhood Finder
          </h1>
          <p className="mt-2 text-gray-600">
            Find your perfect Boston-area neighborhood based on your budget,
            commute, and lifestyle.
          </p>
        </div>
      </div>
      <WizardContainer />
    </main>
  );
}
