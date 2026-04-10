import { NextRequest, NextResponse } from "next/server";
import type { CommuteResult, CommuteStep } from "@/lib/types";
import { requireUser } from "@/lib/auth";

interface GoogleRoute {
  legs: Array<{
    duration: { value: number };
    steps: Array<{
      travel_mode: string;
      html_instructions: string;
      duration: { value: number };
      transit_details?: {
        line: {
          short_name?: string;
          name?: string;
          color?: string;
        };
      };
    }>;
  }>;
}

function parseRoute(route: GoogleRoute): { durationMinutes: number; routeSummary: string; steps: CommuteStep[] } {
  const leg = route.legs[0];
  const durationMinutes = Math.round(leg.duration.value / 60);

  const steps: CommuteStep[] = leg.steps.map(
    (step) => ({
      mode: step.travel_mode as "WALKING" | "TRANSIT",
      instruction: step.html_instructions.replace(/<[^>]*>/g, ""),
      durationMinutes: Math.round(step.duration.value / 60),
      transitLine: step.transit_details?.line?.short_name ||
        step.transit_details?.line?.name,
      transitColor: step.transit_details?.line?.color,
    })
  );

  const transitSteps = steps.filter(
    (s) => s.mode === "TRANSIT" && s.transitLine
  );
  const routeSummary =
    transitSteps.map((s) => s.transitLine).join(" → ") || "Walking";

  return { durationMinutes, routeSummary, steps };
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { originLat, originLng, destination } = await request.json();

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  // Set departure_time to next weekday 8:30 AM
  const now = new Date();
  const nextWeekday = new Date(now);
  nextWeekday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextWeekday.setHours(8, 30, 0, 0);
  const departureTime = Math.floor(nextWeekday.getTime() / 1000).toString();

  // Fetch both transit and walking routes in parallel
  const baseParams = new URLSearchParams({
    origin: `${originLat},${originLng}`,
    destination,
    key: apiKey,
  });

  const transitParams = new URLSearchParams(baseParams);
  transitParams.set("mode", "transit");
  transitParams.set("alternatives", "true");
  transitParams.set("departure_time", departureTime);

  const walkingParams = new URLSearchParams(baseParams);
  walkingParams.set("mode", "walking");

  const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
  const [transitRes, walkingRes] = await Promise.all([
    fetch(`${baseUrl}?${transitParams}`).then((r) => r.json()),
    fetch(`${baseUrl}?${walkingParams}`).then((r) => r.json()),
  ]);

  // Parse transit routes — prefer routes that actually use transit
  let transitRoute: ReturnType<typeof parseRoute> | null = null;
  if (transitRes.status === "OK" && transitRes.routes?.length) {
    // Find a route that uses actual transit (not just walking)
    for (const route of transitRes.routes) {
      const parsed = parseRoute(route);
      if (parsed.routeSummary !== "Walking") {
        if (!transitRoute || parsed.durationMinutes < transitRoute.durationMinutes) {
          transitRoute = parsed;
        }
      }
    }
    // If no transit route found, use the fastest one anyway
    if (!transitRoute) {
      const fastest = (transitRes.routes as GoogleRoute[]).reduce(
        (best, r) =>
          r.legs[0].duration.value < best.legs[0].duration.value ? r : best,
        transitRes.routes[0] as GoogleRoute
      );
      transitRoute = parseRoute(fastest);
    }
  }

  // Parse walking route
  let walkingMinutes: number | null = null;
  if (walkingRes.status === "OK" && walkingRes.routes?.length) {
    walkingMinutes = Math.round(
      walkingRes.routes[0].legs[0].duration.value / 60
    );
  }

  // No routes at all
  if (!transitRoute && walkingMinutes === null) {
    return NextResponse.json(
      { error: "No route found" },
      { status: 404 }
    );
  }

  // Always prefer transit route — people want to see connectivity,
  // not just the fastest option for one trip
  const primary = transitRoute || {
    durationMinutes: walkingMinutes!,
    routeSummary: "Walking only",
    steps: [
      {
        mode: "WALKING" as const,
        instruction: "Walk to destination",
        durationMinutes: walkingMinutes!,
      },
    ],
  };

  let routeSummary = primary.routeSummary;
  // Always append walk time if available
  if (walkingMinutes !== null) {
    if (primary.routeSummary === "Walking only" || primary.routeSummary === "Walking") {
      routeSummary = `${walkingMinutes} min walk`;
    } else {
      routeSummary = `${primary.routeSummary} · ${walkingMinutes} min walk`;
    }
  }

  const result: CommuteResult = {
    durationMinutes: primary.durationMinutes,
    routeSummary,
    steps: primary.steps,
  };

  return NextResponse.json(result);
}
