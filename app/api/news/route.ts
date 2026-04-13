import { NextResponse } from "next/server";
import { parseRss } from "@/lib/news";
import { requireUser } from "@/lib/auth";
import type { NewsItem } from "@/lib/types";

const CATEGORIES = [
  { label: "General", q: "Boston" },
  { label: "Real Estate", q: "Boston real estate housing rent" },
  { label: "Transit", q: "Boston MBTA transit commute" },
  { label: "Safety", q: "Boston crime safety neighborhood" },
  { label: "Food & Culture", q: "Boston restaurants food culture events" },
  { label: "Development", q: "Boston development construction neighborhood" },
];

const REVALIDATE_SECONDS = 900; // 15 min
const ITEMS_PER_CATEGORY = 2;

function rssUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

/** Simple dedup: normalize title to lowercase alphanumeric and reject near-duplicates */
function dedup(items: (NewsItem & { category: string })[]): (NewsItem & { category: string })[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    // Also check if any existing key is a prefix (catches rephrased headlines)
    for (const s of seen) {
      if (key.startsWith(s.slice(0, 30)) || s.startsWith(key.slice(0, 30))) return false;
    }
    seen.add(key);
    return true;
  });
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  // Rotate which categories we fetch based on the current 15-min window
  const windowIndex = Math.floor(Date.now() / (REVALIDATE_SECONDS * 1000));
  const rotated = [...CATEGORIES.slice(windowIndex % CATEGORIES.length), ...CATEGORIES.slice(0, windowIndex % CATEGORIES.length)];
  // Always fetch top 4 categories from the rotated list
  const activeCats = rotated.slice(0, 4);

  try {
    const fetches = activeCats.map(async (cat) => {
      try {
        const res = await fetch(rssUrl(cat.q), {
          next: { revalidate: REVALIDATE_SECONDS },
          headers: { "User-Agent": "neighborhood-finder/1.0" },
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRss(xml)
          .slice(0, ITEMS_PER_CATEGORY)
          .map((item) => ({ ...item, category: cat.label }));
      } catch {
        return [];
      }
    });

    const results = await Promise.all(fetches);
    const all = dedup(results.flat());
    // Interleave: pick one from each category round-robin
    const byCategory = new Map<string, (NewsItem & { category: string })[]>();
    for (const item of all) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    const interleaved: (NewsItem & { category: string })[] = [];
    const iterators = [...byCategory.values()].map((arr) => arr[Symbol.iterator]());
    let added = true;
    while (added && interleaved.length < 8) {
      added = false;
      for (const iter of iterators) {
        if (interleaved.length >= 8) break;
        const next = iter.next();
        if (!next.done) {
          interleaved.push(next.value);
          added = true;
        }
      }
    }

    return NextResponse.json(interleaved);
  } catch (err) {
    console.error("[api/news] fetch failed", err);
    return NextResponse.json({ error: "unavailable" });
  }
}
