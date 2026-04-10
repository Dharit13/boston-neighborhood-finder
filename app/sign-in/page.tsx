import { Suspense } from "react";
import SignInButtons from "./SignInButtons";
import SignInPixelTrail from "./SignInPixelTrail";
import UserCount from "./UserCount";
import { GooeyFilter } from "@/components/ui/gooey-filter";
import { getTotalUserCount } from "@/lib/userCount";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Sign-in cancelled.",
  oauth_failed: "Couldn't complete sign-in. Please try again.",
  missing_code: "Sign-in link was invalid. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? null : null;
  const count = await getTotalUserCount();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black">
      {/* Background image — matches wizard */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.aiscribbles.com/34fe5695dbc942628e3cad9744e8ae13.png?v=60d084"
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-70"
      />

      {/* Gooey pixel trail — same cursor effect as the wizard */}
      <GooeyFilter id="sign-in-gooey" strength={5} />
      <div
        className="absolute inset-0 z-[1]"
        style={{ filter: "url(#sign-in-gooey)" }}
      >
        <SignInPixelTrail />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Boston Neighbourhood Finder
              </h1>
              <p className="text-white/70 text-sm mt-2">Sign in to get started</p>
            </div>

            {errorMessage && (
              <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs text-center">
                {errorMessage}
              </div>
            )}

            <Suspense fallback={<div className="h-24" />}>
              <SignInButtons />
            </Suspense>

            <UserCount count={count} />

            <p className="text-[11px] text-white/40 text-center mt-6 leading-relaxed">
              We use your account only to prevent abuse of AI features.
              No profile data is stored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
