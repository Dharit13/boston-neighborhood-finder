import { NextResponse } from "next/server";
import { parseYahooRss } from "@/lib/news";

const YAHOO_RSS_URL = "https://news.search.yahoo.com/rss?p=Boston";
const REVALIDATE_SECONDS = 900; // 15 min

export async function GET() {
  try {
    const res = await fetch(YAHOO_RSS_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "neighborhood-finder/1.0" },
    });
    if (!res.ok) {
      console.error(`[api/news] upstream status ${res.status}`);
      return NextResponse.json({ error: "unavailable" });
    }
    const xml = await res.text();
    const items = parseYahooRss(xml);
    return NextResponse.json(items);
  } catch (err) {
    console.error("[api/news] fetch failed", err);
    return NextResponse.json({ error: "unavailable" });
  }
}
