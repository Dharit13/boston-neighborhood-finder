import { parseYahooRss } from "@/lib/news";

const wrap = (items: string) => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Yahoo News Search</title>
    ${items}
  </channel>
</rss>`;

describe("parseYahooRss", () => {
  it("returns NewsItem[] for a well-formed feed", () => {
    const xml = wrap(`
      <item>
        <title>Boston mayor announces plan</title>
        <link>https://www.bostonglobe.com/2026/04/10/news/story</link>
        <source>Boston Globe</source>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      title: "Boston mayor announces plan",
      url: "https://www.bostonglobe.com/2026/04/10/news/story",
      source: "Boston Globe",
      publishedAt: new Date("Fri, 10 Apr 2026 12:00:00 GMT").toISOString(),
    });
  });

  it("caps results at 8 items", () => {
    const items = Array.from({ length: 12 }, (_, i) => `
      <item>
        <title>Headline ${i}</title>
        <link>https://example.com/${i}</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `).join("");
    const result = parseYahooRss(wrap(items));
    expect(result).toHaveLength(8);
  });

  it("drops items missing title or link", () => {
    const xml = wrap(`
      <item>
        <title>Has title</title>
        <link>https://example.com/a</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Missing link</title>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
      <item>
        <link>https://example.com/c</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Has title");
  });

  it("strips HTML tags from titles", () => {
    const xml = wrap(`
      <item>
        <title><![CDATA[<b>Bold</b> headline]]></title>
        <link>https://example.com/a</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result[0].title).toBe("Bold headline");
  });

  it("falls back to link hostname when source element is missing", () => {
    const xml = wrap(`
      <item>
        <title>Headline</title>
        <link>https://www.wbur.org/news/story</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result[0].source).toBe("www.wbur.org");
  });

  it("normalizes pubDate to ISO", () => {
    const xml = wrap(`
      <item>
        <title>Headline</title>
        <link>https://example.com/a</link>
        <pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>
      </item>
    `);
    const result = parseYahooRss(xml);
    expect(result[0].publishedAt).toBe("2026-04-10T12:00:00.000Z");
  });

  it("returns [] on malformed XML", () => {
    expect(parseYahooRss("<<<not xml>>>")).toEqual([]);
    expect(parseYahooRss("")).toEqual([]);
  });

  it("returns [] when channel has no items", () => {
    expect(parseYahooRss(wrap(""))).toEqual([]);
  });
});
