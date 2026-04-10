# Zillow Average Rent By Neighborhood Name (April 9, 2026)

This file corrects the earlier listing-count export and uses Zillow's rental-market metric instead:

- Metric used: Zillow `Rental Market Trends` `Average Rent`
- Source type: Zillow housing market / home-values pages
- Mapping method: neighborhood name mapped either to a representative Zillow ZIP page or a direct Zillow municipality page

Notes:
- Most Boston and square-level neighborhood rows use representative ZIP proxies because many Zillow neighborhood pages showed `Average Rent: --`.
- Municipality rows such as Brookline, Everett, Malden, Medford, Chelsea, Revere, Quincy, Watertown, Waltham, and Newton use Zillow municipality-level rental market pages directly.
- Multi-ZIP neighborhoods use a simple arithmetic mean of the listed ZIP average rents because no weighting rule was provided.
- The Zillow rental metric date in this file is February 28, 2026.
- `Milton` is intentionally left blank because Zillow's Milton page still reported `Average Rent: --`, and no proxy was imputed.

This file now covers the full 44-row neighborhood list, with 43 numeric Zillow average-rent values and 1 explicit Zillow-unavailable row.
