# Zillow Rental Snapshot (April 9, 2026)

This snapshot records which of the requested neighborhoods had a usable Zillow neighborhood rentals page during this pass.

Method:
- I used Zillow neighborhood apartment or rental pages that were readable through the crawler-backed browser tool.
- Direct terminal requests to Zillow were blocked by PerimeterX (`Access to this page has been denied`), so this is a page-level snapshot, not a raw terminal scrape.
- Counts in the CSV are the listing counts shown in Zillow page headers on April 9, 2026.

Interpretation:
- `REAL`: a direct Zillow neighborhood apartments or rentals page was found and looked usable.
- `IFFY`: Zillow only exposed a broader proxy page, a split neighborhood, or results that obviously overlapped another area.
- `BAD`: no clean Zillow page or even a reasonable ZIP proxy was confirmed.

Important caveats:
- Split neighborhoods like `Fenway/Kenmore` and `Chinatown / Leather District` are not clean one-to-one Zillow neighborhoods.
- `Seaport` and `Financial District` were the hardest Boston-core neighborhoods to isolate cleanly from Zillow in this pass.
- Several Cambridge square neighborhoods either lacked a clean Zillow neighborhood page or returned results that were too broad to trust.
- For the previously missing Dorchester and Cambridge square rows, ZIP-level Zillow apartment pages can be used as proxies, but they should be treated as neighborhood-adjacent rather than exact.
- Additional ZIP guidance improved the remaining Boston-core rows too: South Boston, Seaport, Fenway/Kenmore, Financial District, and Chinatown / Leather District now point to ZIP-based Zillow pages instead of weaker neighborhood proxies.
