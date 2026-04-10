"use client";

/**
 * Adapted from Fancy Components by Daniel Petho
 * Source: https://github.com/danielpetho/fancy (https://fancycomponents.dev)
 * License: MIT
 */

import React, { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";

import { cn } from "@/lib/utils";
import { useDimensions } from "@/components/hooks/use-debounced-dimensions";

interface PixelTrailProps {
  pixelSize: number;
  fadeDuration?: number;
  delay?: number;
  className?: string;
  pixelClassName?: string;
}

const PixelTrail: React.FC<PixelTrailProps> = ({
  pixelSize = 20,
  fadeDuration = 500,
  delay = 0,
  className,
  pixelClassName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions(containerRef);
  const trailId = useId();

  // Listen on window instead of capturing mousemove on our own element. The
  // trail sits inside a `filter: url()` wrapper that spans the viewport; if
  // we set `pointer-events-auto` here we'd swallow clicks on anything
  // underneath (e.g. the user menu avatar) even though z-index math would
  // suggest otherwise. Window listener + `pointer-events-none` on the div
  // lets the effect follow the cursor without blocking UI hit testing.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / pixelSize);
      const y = Math.floor((e.clientY - rect.top) / pixelSize);
      const pixelElement = document.getElementById(
        `${trailId}-pixel-${x}-${y}`
      );
      if (pixelElement) {
        const animatePixel = (pixelElement as unknown as { __animatePixel?: () => void }).__animatePixel;
        if (animatePixel) animatePixel();
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [pixelSize, trailId]);

  const columns = useMemo(
    () => Math.ceil(dimensions.width / pixelSize),
    [dimensions.width, pixelSize]
  );
  const rows = useMemo(
    () => Math.ceil(dimensions.height / pixelSize),
    [dimensions.height, pixelSize]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 w-full h-full pointer-events-none",
        className
      )}
    >
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <PixelDot
              key={`${colIndex}-${rowIndex}`}
              id={`${trailId}-pixel-${colIndex}-${rowIndex}`}
              size={pixelSize}
              fadeDuration={fadeDuration}
              delay={delay}
              className={pixelClassName}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface PixelDotProps {
  id: string;
  size: number;
  fadeDuration: number;
  delay: number;
  className?: string;
}

const PixelDot: React.FC<PixelDotProps> = React.memo(
  ({ id, size, fadeDuration, delay, className }) => {
    const controls = useAnimationControls();

    const animatePixel = useCallback(() => {
      controls.start({
        opacity: [1, 0],
        transition: { duration: fadeDuration / 1000, delay: delay / 1000 },
      });
    }, [controls, fadeDuration, delay]);

    const ref = useCallback(
      (node: HTMLDivElement | null) => {
        if (node) {
          (node as unknown as { __animatePixel: () => void }).__animatePixel = animatePixel;
        }
      },
      [animatePixel]
    );

    return (
      <motion.div
        id={id}
        ref={ref}
        className={cn("cursor-pointer-none", className)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
        initial={{ opacity: 0 }}
        animate={controls}
        exit={{ opacity: 0 }}
      />
    );
  }
);

PixelDot.displayName = "PixelDot";
export { PixelTrail };
