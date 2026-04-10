import { NextResponse } from "next/server";
import { parseRss } from "@/lib/news";

const NEWS_RSS_URL =
  "https://news.google.com/rss/search?q=Boston&hl=en-US&gl=US&ceid=US:en";
const REVALIDATE_SECONDS = 900; // 15 min

export async function GET() {
  try {
    const res = await fetch(NEWS_RSS_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "neighborhood-finder/1.0" },
    });
    if (!res.ok) {
      console.error(`[api/news] upstream status ${res.status}`);
      return NextResponse.json({ error: "unavailable" });
    }
    const xml = await res.text();
    const items = parseRss(xml);
    return NextResponse.json(items);
  } catch (err) {
    console.error("[api/news] fetch failed", err);
    return NextResponse.json({ error: "unavailable" });
  }
}
