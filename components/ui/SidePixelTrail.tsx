"use client";

import { useId } from "react";
import { PixelTrail } from "@/components/ui/pixel-trail";
import { GooeyFilter } from "@/components/ui/gooey-filter";
import { useScreenSize } from "@/hooks/use-screen-size";

interface Props {
  /**
   * Width of the central content panel in rem. The trail renders in two
   * vertical strips flanking the center: each strip is
   * `calc(50% - centerWidthRem/2 rem)` wide.
   */
  centerWidthRem: number;
  /**
   * Use `fixed` instead of `absolute` so the strips stay in the viewport
   * on long, scrollable pages (e.g. /results). Default: false.
   */
  fixed?: boolean;
}

/**
 * Cursor pixel-trail effect rendered as two side strips around a centered
 * content column. Used on the wizard, results, and sign-in pages so the
 * sparkle effect lives in the page margins instead of behind the panels.
 *
 * Hidden below `md` because there are no side margins to fill on mobile.
 */
export function SidePixelTrail({ centerWidthRem, fixed = false }: Props) {
  const screenSize = useScreenSize();
  // useId() returns ":r0:" / "«r0»" style strings whose colons are invalid
  // in CSS url() selectors — sanitize so we get a clean filter id.
  const filterId = `pixel-trail-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const pixelSize = screenSize.lessThan("md") ? 24 : 32;
  const stripWidth = `calc(50% - ${centerWidthRem / 2}rem)`;
  const positionClass = fixed ? "fixed" : "absolute";

  return (
    <>
      <GooeyFilter id={filterId} strength={5} />
      <div
        className={`${positionClass} inset-y-0 left-0 hidden md:block z-[1]`}
        style={{ width: stripWidth, filter: `url(#${filterId})` }}
      >
        <PixelTrail
          pixelSize={pixelSize}
          fadeDuration={0}
          delay={500}
          pixelClassName="bg-white/80"
        />
      </div>
      <div
        className={`${positionClass} inset-y-0 right-0 hidden md:block z-[1]`}
        style={{ width: stripWidth, filter: `url(#${filterId})` }}
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
