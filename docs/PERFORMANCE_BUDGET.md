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
- theme disclosure and local preference persistence;
- header and footer state;
- profile image preview;
- role rotation and optional scroll reveals;
- experience depth switching and chapter expansion;
- skills dialogs and recommendation expansion;
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

Every public asset is anonymously retrievable. Asset privacy is a security requirement, not a performance technique.

## Glass effects

Limit `backdrop-filter` to bounded cards, navigation, footer, dialogs, and section panels. Mobile tokens reduce blur. The `enable_glass_effects` setting must leave an opaque, readable surface when effects are disabled.

## Skeleton loading

Skeletons support route transitions and deferred UI. They do not replace static delivery.

- Match final layout dimensions.
- Contain no real text or fake controls.
- Disable shimmer under reduced motion.
- Do not introduce an artificial delay.

## Contact runtime

Keep Function requests narrow and time-bounded. Preserve body limits, no-store responses, bounded Turnstile, DNS, and Resend work, one Turnstile verification per contact session, and at most two sequential Resend requests per accepted submission.

Edge rate limiting is an operator control. It does not justify heavier application processing or replace server validation.

## Build and deployment

Production candidates fetch the workbook once and build from the existing generated snapshot. Deploy jobs verify and upload the tested artifact without regenerating content or rebuilding.

Semantic no-op behavior avoids the expensive quality and deployment pipeline only after the new source has been downloaded, parsed, validated, normalized, and compared with the active manifest.

## Measurement

After a major visual or dependency change:

1. Run `npm run build`.
2. Record the Next.js route table and first-load JavaScript values in review notes.
3. Compare affected routes with the previous result.
4. Inspect new or changed public asset sizes.
5. Test the production export rather than judging development-server behavior.

This repository does not enforce a numeric Lighthouse score or bundle threshold. Do not claim a measured performance result without recording the tool, route, environment, and date.

See [Performance checklist](PERFORMANCE_CHECKLIST.md), [Design system](DESIGN_SYSTEM.md), and [Testing](TESTING.md).
