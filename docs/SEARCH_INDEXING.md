# Search indexing

This guide defines the production indexing contract for Smart Portfolio and the operator steps required after deployment. Search visibility is based on the canonical custom domain, not a Cloudflare-assigned or preview hostname.

## Site identity

The source-controlled identity is:

- Canonical origin: `https://nicolasmgioanni.dev`
- Canonical homepage: `https://nicolasmgioanni.dev/`
- Preferred site name: `Nicolas Gioanni`
- Alternate site names, in order: `Nicolas Gioanni Portfolio`, `nicolasmgioanni.dev`
- Language: `en-US`
- Open Graph locale: `en_US`

The workbook, request headers, deployment variables, and runtime hostnames do not control this identity. Preview and `pages.dev` deployments therefore continue to declare URLs on `nicolasmgioanni.dev` as canonical.

## Route policy

The central route registry classifies every visitor page into exactly one indexing group. The indexable routes are:

1. `/`
2. `/experience`
3. `/research`
4. `/projects`
5. `/recommendations`
6. `/resume`
7. `/terms`
8. `/privacy`
9. `/security`

`/contact` is the only non-indexable visitor route. It remains crawlable and emits `noindex, follow`, allowing Google to read the directive and follow its links. It is deliberately absent from the sitemap but is not blocked by `robots.txt`. The directive is an indexing policy, not an access-control boundary.

New visitor routes must be added to the central registry and explicitly assigned to one of these groups. Metadata, sitemap generation, and regression tests consume that shared classification.

## Generated search files

The native Next.js metadata route in `src/app/robots.ts` generates `/robots.txt`. Its wildcard rule allows the site and disallows only:

- `/api/`
- `/content-version.json`
- `/artifact-integrity.json`

The file also advertises `https://nicolasmgioanni.dev/sitemap.xml`. It does not block `/contact`, page routes, or Next.js assets.

The native metadata route in `src/app/sitemap.ts` generates `/sitemap.xml` from the indexable route collection. It contains the nine absolute canonical URLs listed above and no contact, Function, metadata, asset, preview, `www`, query-string, or fragment URL. Entries intentionally omit priority, change frequency, and modification dates because the repository has no accurate per-route modification timestamp.

Both files are produced as part of the generated static artifact. They are not edited by hand, and the deployment smoke check compares each deployed response with the already-verified local artifact. See [Deployment](DEPLOYMENT.md#exact-automated-smoke-scope) for that check.

## Page metadata

Every registered page receives an absolute self-referencing canonical URL. The homepage uses `https://nicolasmgioanni.dev/`; detail and legal pages use their own route URL; `/contact` uses `https://nicolasmgioanni.dev/contact`.

Indexable pages emit `index, follow`. Contact emits `noindex, follow`. Googlebot receives the same index decision plus `max-image-preview: large`, `max-snippet: -1`, and `max-video-preview: -1`.

All pages retain their configured title and description behavior and receive the source-controlled application, author, creator, and publisher identity. Open Graph uses the canonical page URL, `website` type, `en_US`, the preferred site name, and the existing profile image when configured. Twitter uses a summary card with the same page identity and available image.

## Homepage structured data

The exported homepage contains one server-rendered JSON-LD `@graph` with exactly one node of each type:

- `WebSite` identifies the canonical site, preferred and alternate names, language, description, and person responsible for the site.
- `ProfilePage` identifies the homepage and names the person as its main entity.
- `Person` uses validated public profile content, including only populated visible facts and existing HTTPS GitHub and LinkedIn profiles.

Stable canonical identifiers connect the three nodes. The person node can include the configured profile image, headline, biography, current organization, alumni institution, and public location only when those values are present in public content. It never treats email as a social profile and does not add reviews, ratings, unsupported dates, interaction counts, or private details.

The JSON-LD is serialized safely into the exported HTML without client-side rendering. Structured data helps search engines understand the page, but does not guarantee a rich result, indexing, or rankings.

## Post-deployment validation

Check these production URLs after the deployment completes:

- `https://nicolasmgioanni.dev/`
- `https://nicolasmgioanni.dev/robots.txt`
- `https://nicolasmgioanni.dev/sitemap.xml`
- `https://nicolasmgioanni.dev/experience`
- `https://nicolasmgioanni.dev/research`
- `https://nicolasmgioanni.dev/projects`
- `https://nicolasmgioanni.dev/recommendations`
- `https://nicolasmgioanni.dev/resume`
- `https://nicolasmgioanni.dev/terms`
- `https://nicolasmgioanni.dev/privacy`
- `https://nicolasmgioanni.dev/security`
- `https://nicolasmgioanni.dev/contact`

Confirm that the two generated search files return successful responses with their expected text or XML content. Confirm that the sitemap lists exactly nine URLs. In page source, verify each page's own canonical URL and robots directive, the homepage's single JSON-LD graph, and the absence of `pages.dev` canonical URLs or Google verification markup. Contact must remain crawlable while reporting `noindex, follow`.

Validate the live homepage with Google's [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema Markup Validator](https://validator.schema.org/). The latter is useful for schema types that do not produce a Google-specific rich result. Confirm one `WebSite`, one `ProfilePage`, one `Person`, valid canonical references, and no review or rating node.

## Search Console and Cloudflare DNS

Ownership uses a Google Search Console Domain property and an external DNS TXT record. No HTML verification file, metadata tag, analytics product, or source-code secret is required.

1. In [Google Search Console](https://search.google.com/search-console), add a **Domain** property with the value `nicolasmgioanni.dev`. Do not include `https://`, `www`, or a path.
2. Copy the complete TXT value that Search Console provides for DNS verification.
3. In the Cloudflare dashboard, open the `nicolasmgioanni.dev` zone, then **DNS** and **Records**. Select **Add record**, choose type **TXT**, use `@` for the root name, paste the exact Search Console value into **Content**, leave TTL on **Auto**, and save the record.
4. Allow DNS propagation, return to Search Console, and select **Verify**. If verification is not immediate, keep the record unchanged and retry later.
5. Leave the Search Console TXT record in DNS permanently. Removing it can cause ownership verification to be lost.

Google documents Domain properties and DNS-only verification in [Add a website property](https://support.google.com/webmasters/answer/34592), and Cloudflare documents the dashboard flow in [Manage DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/).

The unique TXT value remains external operational data. Do not commit it, a screenshot containing it, a verification file, or a verification meta tag to the repository.

## Sitemap submission and indexing requests

After the Domain property is verified:

1. Open the **Sitemaps** report for `nicolasmgioanni.dev`.
2. Submit `sitemap.xml`, which resolves to `https://nicolasmgioanni.dev/sitemap.xml`.
3. Confirm that Search Console fetches it successfully and discovers nine URLs. Investigate any fetch, parsing, hostname, or count discrepancy before requesting indexing.
4. Use **URL Inspection** for the canonical homepage and each indexable detail or legal URL. Run the live test, confirm that crawling is allowed and the declared canonical is correct, then select **Request indexing** when available.
5. Inspect `/contact` only to confirm its `noindex` state. Do not request indexing for it.

Submitting a sitemap and requesting indexing are discovery signals, not guarantees. Repeated requests do not make crawling faster. Google's [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) and [recrawl guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl) describe the current limits and behavior.

## Ongoing monitoring

Review Search Console after releases and periodically thereafter:

- **Sitemaps:** successful retrieval, the expected nine discovered URLs, and no stale or foreign sitemap.
- **Page indexing:** approved routes indexed or progressing normally, `/contact` excluded by `noindex`, and no unexpected robots, duplicate, redirect, or canonical-selection issue.
- **URL Inspection:** Google's selected canonical agrees with the declared `nicolasmgioanni.dev` URL and the last crawl sees current metadata.
- **Performance:** queries, impressions, clicks, and result presentation for useful trends; this reporting does not require site analytics or tracking.
- **Experience, Manual actions, Security issues, and crawl settings:** new problems that need investigation.

Google controls crawl scheduling, canonical selection, indexing, site-name display, result presentation, and rankings. A technically valid deployment improves discovery and clarity but guarantees none of those outcomes. Search Console itself is sufficient for this operating workflow; no analytics, tracking, cookies, or visitor profiling are required.
