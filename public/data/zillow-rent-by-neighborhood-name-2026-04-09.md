# Zillow Rent Data Mapped By Neighborhood Name (April 9, 2026)

This file is the clean name-mapped version of the Zillow snapshot.

What changed:
- Each row is keyed by the neighborhood name you care about.
- When Zillow had a direct neighborhood page, that page count was used.
- When Zillow did not have a clean neighborhood page, I mapped the neighborhood name to the ZIP code(s) you provided and used the Zillow apartment count for those ZIP page(s).

How to read it:
- `zillow_listing_count_total` is the single count mapped to the neighborhood name.
- `mapping_type` tells you whether that count came from a direct neighborhood page or a ZIP-based mapping.
- `count_breakdown` preserves the individual ZIP counts when a neighborhood spans multiple ZIPs.

Important note:
- Multi-ZIP totals such as `Fenway/Kenmore` and `Financial District` are sums of the listed ZIP-page counts because you explicitly approved mapping by ZIP to neighborhood name.
