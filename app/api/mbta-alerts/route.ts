import { NextRequest, NextResponse } from "next/server";
import type { MbtaLine } from "@/lib/types";
import {
  mapLinesToRoutes,
  filterAndNormalizeAlerts,
} from "@/lib/mbtaAlerts";
import { requireUser } from "@/lib/auth";

const VALID_LINES: ReadonlySet<MbtaLine> = new Set<MbtaLine>([
  "red",
  "orange",
  "blue",
  "green",
  "silver",
  "bus",
  "ferry",
]);

const REVALIDATE_SECONDS = 180; // 3 min

export async function GET(request: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const linesParam = request.nextUrl.searchParams.get("lines") ?? "";
  const requestedLines = linesParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MbtaLine => VALID_LINES.has(s as MbtaLine));

  if (requestedLines.length === 0) {
    return NextResponse.json([]);
  }

  const routes = mapLinesToRoutes(requestedLines);
  if (routes.length === 0) {
    // Only bus/ferry requested — we don't query those.
    return NextResponse.json([]);
  }

  const params = new URLSearchParams();
  params.set("filter[route]", routes.join(","));
  params.set("filter[severity]", "3,4,5,6,7,8,9,10");
  params.set("filter[activity]", "BOARD,EXIT,RIDE");

  const url = `https://api-v3.mbta.com/alerts?${params.toString()}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/vnd.api+json" },
    });
    if (!res.ok) {
      console.error(`[api/mbta-alerts] upstream status ${res.status}`);
      return NextResponse.json({ error: "unavailable" });
    }
    const raw = await res.json();
    const alerts = filterAndNormalizeAlerts(raw, requestedLines);
    return NextResponse.json(alerts);
  } catch (err) {
    console.error("[api/mbta-alerts] fetch failed", err);
    return NextResponse.json({ error: "unavailable" });
  }
}
