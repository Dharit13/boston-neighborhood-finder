import type { Neighborhood } from "@/lib/types";
import neighborhoodsData from "@/public/data/neighborhoods.json";

const neighborhoods = neighborhoodsData as Neighborhood[];

/**
 * One compact line per neighborhood. ~6.5 KB / ~1.6k tokens for all 44.
 * Format: "Name (region) — studio $X–$Y/mo | safety S/100 | MBTA: ... | walk W — description"
 */
function buildCompactSummary(): string {
  return neighborhoods
    .map((n) => {
      const studio = `$${n.rent.studio[0]}–${n.rent.studio[1]}/mo`;
      const mbta = n.mbtaLines.join(",");
      const desc = n.description.length > 80
        ? n.description.slice(0, 80).trimEnd() + "…"
        : n.description;
      return `${n.name} (${n.region}) — studio ${studio} | safety ${n.safety}/100 | MBTA: ${mbta} | walk ${n.walkScore} — ${desc}`;
    })
    .join("\n");
}

export const COMPACT_SUMMARY: string = buildCompactSummary();

/** Nicknames → neighborhood id. Kept intentionally short. */
const NICKNAMES: Record<string, string> = {
  jp: "jamaica-plain",
  "jp.": "jamaica-plain",
  southie: "south-boston",
  eastie: "east-boston",
  "the fens": "fenway-kenmore",
  kenmore: "fenway-kenmore",
};

const byId = new Map<string, Neighborhood>(
  neighborhoods.map((n) => [n.id, n])
);

export function getFullRecord(id: string): Neighborhood | null {
  return byId.get(id) ?? null;
}

/**
 * Case-insensitive, word-boundary match against every neighborhood
 * name and the nickname map. Returns deduplicated results.
 */
export function findMentioned(question: string): Neighborhood[] {
  const found = new Map<string, Neighborhood>();
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Match by name
  for (const n of neighborhoods) {
    const re = new RegExp(`\\b${escape(n.name)}\\b`, "i");
    if (re.test(question)) {
      found.set(n.id, n);
    }
  }

  // Match by nickname
  for (const [nick, id] of Object.entries(NICKNAMES)) {
    const re = new RegExp(`\\b${escape(nick)}\\b`, "i");
    if (re.test(question)) {
      const n = byId.get(id);
      if (n) found.set(n.id, n);
    }
  }

  return Array.from(found.values());
}
