import type { MbtaAlert, MbtaLine } from "./types";

const EXCLUDED_EFFECTS = new Set([
  "ELEVATOR_CLOSURE",
  "ESCALATOR_CLOSURE",
  "ACCESS_ISSUE",
  "FACILITY_ISSUE",
  "OTHER_EFFECT",
]);

const MAX_ALERTS = 10;

const LINE_TO_ROUTES: Record<MbtaLine, string[]> = {
  red: ["Red"],
  orange: ["Orange"],
  blue: ["Blue"],
  green: ["Green-B", "Green-C", "Green-D", "Green-E"],
  silver: ["741", "742", "743", "746", "749", "751"],
  bus: [],
  ferry: [],
};

/**
 * Map our internal MbtaLine values to MBTA v3 route IDs.
 * Skips `bus` and `ferry` (too broad without station-level filtering).
 */
export function mapLinesToRoutes(lines: MbtaLine[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    for (const route of LINE_TO_ROUTES[line] ?? []) {
      out.push(route);
    }
  }
  return out;
}

/**
 * Reverse: given a raw MBTA route ID, which of our MbtaLine values
 * does it belong to?
 */
function routeIdToLine(routeId: string): MbtaLine | null {
  for (const [line, routes] of Object.entries(LINE_TO_ROUTES) as [
    MbtaLine,
    string[]
  ][]) {
    if (routes.includes(routeId)) return line;
  }
  return null;
}

interface RawAlert {
  id?: string;
  type?: string;
  attributes?: {
    header?: string;
    description?: string | null;
    severity?: number;
    effect?: string;
    url?: string | null;
    informed_entity?: Array<{ route?: string }>;
  };
}

/**
 * Take the raw JSON:API response from MBTA, drop excluded effects,
 * map to MbtaAlert, reverse-map routes to requested MbtaLine values,
 * sort by severity desc, cap at MAX_ALERTS.
 */
export function filterAndNormalizeAlerts(
  rawResponse: unknown,
  requestedLines: MbtaLine[]
): MbtaAlert[] {
  const data = (rawResponse as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];

  const requestedSet = new Set(requestedLines);

  const normalized: MbtaAlert[] = [];
  for (const raw of data as RawAlert[]) {
    const attrs = raw.attributes;
    if (!attrs) continue;

    const effect = attrs.effect ?? "";
    if (EXCLUDED_EFFECTS.has(effect)) continue;

    const header = attrs.header ?? "";
    if (!header) continue;

    const informed = attrs.informed_entity ?? [];
    const touchedLines = new Set<MbtaLine>();
    for (const entity of informed) {
      if (!entity.route) continue;
      const line = routeIdToLine(entity.route);
      if (line && requestedSet.has(line)) touchedLines.add(line);
    }
    if (touchedLines.size === 0) continue;

    normalized.push({
      id: raw.id ?? "",
      header,
      description: attrs.description ?? header,
      severity: attrs.severity ?? 0,
      effect,
      routes: Array.from(touchedLines),
      url: attrs.url ?? null,
    });
  }

  normalized.sort((a, b) => b.severity - a.severity);
  return normalized.slice(0, MAX_ALERTS);
}
