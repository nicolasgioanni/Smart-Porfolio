# Performance budget

## Runtime strategy

The portfolio is a static export with two isolated Cloudflare Pages Functions for contact verification and delivery. Portfolio routes render from static HTML and generated content without runtime workbook requests.

Keep `output: "export"` unless product and hosting requirements change through a documented architecture review.

## Content fetching

Do not fetch portfolio content from the browser or a request-time route. Generate content before build and render from the validated snapshot.

Security tests should continue proving there are no Next.js API routes, route handlers, server actions, or runtime portfolio fetches, and that Function routing invokes only the two documented contact paths.

## JavaScript budget

Prefer server components for static content. Isolate client behavior to a clear interaction or browser API.

Current intentional client features include:

- desktop route indication and mobile navigation;
- theme disclosure, system color-scheme following, and local manual-override persistence;
- header and footer state;
- profile image preview;
- role rotation and optional scroll reveals;
- experience depth switching and chapter expansion;
- skills dialogs and recommendation expansion;
- independent Project visual tabs over static image and diagram content;
- contact verification and submission.

Avoid large client-only trees or framework additions when native browser and React behavior already meets the requirement. Compare the Next.js route table after adding a dependency or converting a server component.

## Animation budget

Keep motion CSS-first. Do not add an animation library to the core experience without a measured need.

- Prefer opacity and transform.
- Keep documented layout transitions bounded to the header, experience disclosure, recommendation disclosure, and footer.
- Do not blur text.
- Do not add continuous scroll interpolation.
- Respect reduced motion for every new effect.

## Assets

Optimize raster images before adding them to `public/`. Match encoded dimensions to their real display role, prefer WebP or AVIF when browser support and transparency needs permit, and avoid multi-megabyte source images for small UI marks.

Reserve image dimensions to avoid layout shift. Keep the shared page background CSS and token driven rather than adding full-page wallpaper downloads.

Project artwork is stored as five optimized WebP files totaling about 287 KiB. Supporting images, including native fallbacks, use lazy loading to prevent React from preloading hidden gallery images on unrelated routes.

Every public asset is anonymously retrievable. Asset privacy is a security requirement, not a performance technique.

## Surface rendering

Use opaque semantic surface tiers for cards, navigation, footer, dialogs, and section panels. Do not introduce `backdrop-filter`, CSS gradients, decorative overlays, glow shadows, or mask fades. The legacy `enable_glass_effects` setting must leave the same readable opaque hierarchy when disabled.

## Skeleton loading

Skeletons support route transitions and deferred UI. They do not replace static delivery.

- Match final layout dimensions.
- Keep body placeholders free of real or fake prose and controls. The transparent, `aria-hidden` canonical route-header ink is the only copy-shaped exception and exists solely to derive intrinsic line geometry.
- Keep skeletons static; never add shimmer.
- Do not introduce an artificial delay.

## Contact runtime

Keep Function requests narrow and time-bounded. Preserve the 15-second request-body read deadline, body limits, no-store responses, bounded Turnstile, DNS, and Resend work, one fresh Turnstile token per new logical message, at most one same-operation Siteverify retry for transient failure, and at most two sequential Resend requests per accepted submission. Turnstile and DNS deadlines must include capped response-body reads (16 KiB and 64 KiB); status-only provider bodies must be canceled without delaying the Function response. Render the visible gate before contact fields and do not load a second widget during Send.

Edge rate limiting is an operator control. It does not justify heavier application processing or replace server validation.

## Build and deployment

Production candidates accept one complete workbook snapshot through the bounded download policy and build from the existing generated snapshot. Deploy jobs verify and upload the tested artifact without regenerating content or rebuilding.

Exact-candidate no-op behavior avoids the expensive quality and deployment pipeline only after the new source has been downloaded, parsed, validated, and normalized and both its semantic content hash and commit SHA have been compared with the active manifest.

## Measurement

After a major visual or dependency change:

1. Run `npm run build`.
2. Record the Next.js route table and first-load JavaScript values in review notes.
3. Compare affected routes with the previous result.
4. Inspect new or changed public asset sizes.
5. Test the production export rather than judging development-server behavior.

## Static export payload gate

`npm run test:quality:payload` measures the existing generated `out/` and `.next/` directories against the reviewed baseline in `scripts/quality/payloadBaseline.json`. It covers every public route, checks that published initial chunks match their build sources, measures route HTML and initial JavaScript gzip sizes, requires shared framework chunks, and enforces role-specific Research media limits. It also rejects Research-only media and project markers outside the Research route.

Run it only after `npm run build:generated`. The baseline records the review environment and permits the documented slack; do not raise it to turn an unexplained output increase green. Investigate the route, chunk, or asset that exceeded its reviewed bound first.

### Projects baseline provenance

The reviewed /projects HTML baseline is 19,625 gzip bytes from the preserved product shape at f6334b93309bd0ba355937113cc4bf7ca31b6b59, measured with Node 22.23.3 and Next 16.3.4. It retains the approved preview, badge, attribution, footer, and visual-switcher markup; this correction is not a performance optimization or a visual-baseline change. The reconciled Node 22.23.3 and Next 16.4.0 build measures 19,739 bytes, leaving its 114-byte dependency-era change visible while remaining below the unchanged 20% route slack ceiling. Every other reviewed route and asset threshold remains unchanged.

The gate does not measure Lighthouse or Core Web Vitals. Do not claim a measured performance result without recording the tool, route, environment, and date.

See [Performance checklist](PERFORMANCE_CHECKLIST.md), [Design system](../design/DESIGN_SYSTEM.md), and [Testing](TESTING.md).
