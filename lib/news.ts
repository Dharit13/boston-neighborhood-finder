import { XMLParser } from "fast-xml-parser";
import type { NewsItem } from "./types";

const MAX_ITEMS = 8;

interface RawItem {
  title?: string | { "#cdata"?: string };
  link?: string;
  source?: string | { "#cdata"?: string };
  pubDate?: string;
}

function textOf(value: string | { "#cdata"?: string } | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value["#cdata"] ?? "";
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function toIsoDate(pubDate: string | undefined): string {
  if (!pubDate) return new Date(0).toISOString();
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return new Date(0).toISOString();
  return d.toISOString();
}

export function parseRss(xml: string): NewsItem[] {
  if (!xml) return [];
  let parsed: unknown;
  try {
    const parser = new XMLParser({
      ignoreAttributes: true,
      cdataPropName: "#cdata",
    });
    parsed = parser.parse(xml);
  } catch {
    return [];
  }

  const channel = (
    parsed as { rss?: { channel?: { item?: RawItem | RawItem[] } } }
  )?.rss?.channel;
  if (!channel) return [];

  const rawItems = Array.isArray(channel.item)
    ? channel.item
    : channel.item
    ? [channel.item]
    : [];

  const items: NewsItem[] = [];
  for (const raw of rawItems) {
    const title = stripHtml(textOf(raw.title));
    const url = (raw.link ?? "").trim();
    if (!title || !url) continue;

    const sourceText = stripHtml(textOf(raw.source));
    const source = sourceText || hostnameOf(url);

    items.push({
      title,
      url,
      source,
      publishedAt: toIsoDate(raw.pubDate),
    });
  }

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return items.slice(0, MAX_ITEMS);
}
