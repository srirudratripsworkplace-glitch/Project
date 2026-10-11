# SEO audit for Sri Rudra Trips

## Executive summary
This project is a Vite + React single-page travel website for Sri Rudra Trips, with the public homepage acting as the main landing page. Earlier audit findings included incomplete metadata, missing crawler files, and a brand naming inconsistency between `Srirudra Trips` and the intended business name `Sri Rudra Trips`.

## Findings before changes
- The homepage had a title and meta description, but not a canonical URL and not a full set of social-sharing tags.
- The page metadata used a different business name spelling and did not consistently match the official name.
- There was no `public/sitemap.xml` file, so search engines had no standard sitemap to discover the site.
- There was no `public/robots.txt`, so crawler guidance was absent.
- The site is a client-rendered React app. Important page content is loaded after JavaScript runs instead of being fully present in the initial HTML response.
- The Vercel config only rewrites `/admin` to the SPA entry point and does not add homepage canonicalization or URL handling beyond that route.
- The initial social-sharing and favicon assets did not use the actual logo shown in the site header.

## Fixes implemented
- Updated the homepage metadata in `index.html` with a business-accurate title, description, canonical URL, language metadata, Open Graph tags, Twitter tags, and theme-color metadata.
- Added `public/robots.txt` to allow public crawlers and point them at the official sitemap.
- Added `public/sitemap.xml` with the canonical homepage URL only.
- Added static brand assets to support social previews and favicon use.
- Replaced the generic favicon with a 192×192 crop from the actual header logo, published at `/favicon.png`, and published the full logo at `/brand-logo.jpeg` for social metadata and structured data.
- Updated the page title and description around UK sightseeing trips, holidays and destinations already represented on the site, with the `Srirudra Trips` spelling variant included naturally.
- Added `WebSite` structured data with `alternateName: Srirudra Trips`, linked to a `TravelAgency` entity using the existing public contact details and logo.
- Added a Vercel host redirect from `www.srirudratrips.co.uk` to the canonical `https://srirudratrips.co.uk/` domain.
- Normalized the site brand name to `Sri Rudra Trips` in the main business config and user-facing copy that relates to the brand.
- Added a JSON-LD `TravelAgency` and `WebSite` schema block to the homepage to help search engines understand the business.

## Remaining limitations
- The homepage content is still rendered client-side in a React SPA, which means most of the visible content is not present in the raw HTML at first load. This is common for Vite/React marketing sites, but it is a small crawlability limitation compared with server-rendered frameworks.
- There are no dedicated destination or service landing pages beyond the single homepage. This is acceptable for a compact brochure-style site, but it limits deeper local SEO expansion opportunities.
- The site does not currently publish additional structured business data such as verified addresses, social profiles, or operating hours beyond the details already present in the codebase.

## Priority action checklist
1. Deploy the canonical-host redirect and confirm production redirects `www.srirudratrips.co.uk` to `https://srirudratrips.co.uk/`.
2. Submit the sitemap to Google Search Console and request indexing for the homepage.
3. Verify the homepage is indexed and that the title and description match Search Console live results.
4. Add or claim a Google Business Profile if the business is eligible and the location/verification details are available.
5. Expand the site with genuine destination/service pages only if new content is verified and useful to travellers.
6. Monitor Search Console indexing coverage and fix any crawl or page experience issues as they appear.

## Notes
This project follows legitimate, Google-compliant SEO practices without claiming guaranteed rankings or indexing outcomes. Search visibility should improve over time when the site is consistently indexed, the metadata remains accurate, and the site is supported by valid business information and content.
