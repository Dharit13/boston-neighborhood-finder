"use client";

import { PixelTrail } from "@/components/ui/pixel-trail";
import { useScreenSize } from "@/hooks/use-screen-size";

/**
 * Client wrapper so the sign-in Server Component can embed the same
 * gooey pixel-trail cursor effect the wizard uses. Pulled out of
 * page.tsx because PixelTrail depends on a client-only hook.
 *
 * Rendered as two vertical strips flanking the sign-in card so the
 * cursor effect stays in the margins and never sparkles across the
 * glass panel itself. The card is `max-w-md` (28rem), so each strip
 * is `calc(50% - 14rem)` wide. Hidden below `md` where there are no
 * side margins to fill.
 */
export default function SignInPixelTrail() {
  const screenSize = useScreenSize();
  const pixelSize = screenSize.lessThan("md") ? 24 : 32;
  const stripWidth = "calc(50% - 14rem)";
  return (
    <>
      <div
        className="absolute inset-y-0 left-0 hidden md:block"
        style={{ width: stripWidth }}
      >
        <PixelTrail
          pixelSize={pixelSize}
          fadeDuration={0}
          delay={500}
          pixelClassName="bg-white/80"
        />
      </div>
      <div
        className="absolute inset-y-0 right-0 hidden md:block"
        style={{ width: stripWidth }}
      >
        <PixelTrail
          pixelSize={pixelSize}
          fadeDuration={0}
          delay={500}
          pixelClassName="bg-white/80"
        />
      </div>
    </>
  );
}
