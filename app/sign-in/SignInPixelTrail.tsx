"use client";

import { PixelTrail } from "@/components/ui/pixel-trail";
import { useScreenSize } from "@/hooks/use-screen-size";

/**
 * Client wrapper so the sign-in Server Component can embed the same
 * gooey pixel-trail cursor effect the wizard uses. Pulled out of
 * page.tsx because PixelTrail depends on a client-only hook.
 */
export default function SignInPixelTrail() {
  const screenSize = useScreenSize();
  return (
    <PixelTrail
      pixelSize={screenSize.lessThan("md") ? 24 : 32}
      fadeDuration={0}
      delay={500}
      pixelClassName="bg-white/80"
    />
  );
}
