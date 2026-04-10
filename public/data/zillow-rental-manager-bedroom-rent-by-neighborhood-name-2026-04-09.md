# Zillow Rental Manager Bedroom Rent By Neighborhood Name (April 9, 2026)

This file maps the 44-name neighborhood list to Zillow Rental Manager bedroom-specific averages.

- Metric used: Zillow Rental Manager `average rent for a studio apartment`, `one-bedroom apartment`, and `two-bedroom apartment`
- Source type: Zillow Rental Manager market-trends pages
- Mapping method: neighborhood name mapped either to a representative Zillow ZIP rental-market page or a Zillow municipality rental-market page

Notes:
- Neighborhoods that do not have a clean Zillow Rental Manager neighborhood page use the same ZIP proxy logic as the earlier Zillow exports.
- Multi-ZIP neighborhoods such as `Fenway/Kenmore`, `Financial District`, and `Downtown Crossing` use a simple arithmetic mean by bedroom type because no weighting rule was provided.
- Municipality rows such as `Brookline`, `Everett`, `Malden`, `Medford`, `Chelsea`, `Revere`, `Quincy`, `Milton`, `Watertown`, `Waltham`, and `Newton` come from Zillow municipality rental-market pages.
- Zillow blocks direct terminal scraping, so this file is a saved page-value extraction from the visible Zillow Rental Manager pages rather than a raw backend export.
- `West Roxbury` uses the FAQ bedroom values from Zillow's `02132` page; that page's all-beds header looked internally inconsistent, so the note is preserved in the CSV.
