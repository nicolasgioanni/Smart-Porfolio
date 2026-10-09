# Real project preview review

Five cards now use three authentic public-homepage captures, the supplied Clair desktop screenshot, and a native HTML/SVG LeetNotes workflow preview. The final polish adds a centered constant-width switcher, a reversible 520ms book flip, 180ms label crossfades, one rounded hover surface, top-right title-row badges, and aligned desktop header/media/footer rows. NotePal's collaborative attribution follows its footer actions.

Public captures preserve the pages observed on 2026-10-09, including Compliance's visible `System Offline` backend status. `Live site` describes the published website, not backend health. Existing desktop asset URLs remain stable; local narrow variants are selected through `<picture>`. Clair remains contained and uncropped. No screenshot UI was retouched.

The workbook update was limited to `Projects!Q6`, adding Clair's latest-release destination while preserving its source link. Before/after XLSX comparison confirmed that every other value and formula across all nine sheets was unchanged. The published workbook passed strict generation during the preview implementation. This polish changes no workbook values. Remote workbook exports remain local review artifacts and are not committed.

The [showcase guide](../../../content/PROJECT_SHOWCASE.md) owns the preview, destination, workbook, and provenance contracts. The earlier [gallery captures](../projects-gallery/README.md) remain historical evidence.

## Captures

These reviewed screenshots come from the static export at 1280px desktop and 320px mobile widths. Enhanced pages use Dark with reduced motion; no-JavaScript pages retain server-rendered Navy. Native disclosures are open, and keyboard focus is retained on Clair's diagram in the no-JavaScript captures.

- [Desktop previews](desktop.png)
- [Desktop workflows](workflow.png)
- [Mobile gallery](mobile.png)
- [Mobile LeetNotes detail](leetnotes-mobile.png)
- [No-JavaScript desktop](no-javascript.png)
- [No-JavaScript mobile](no-javascript-mobile.png)
- [Native WebKit preview](webkit-native-preview.png)
- [Native WebKit workflow](webkit-native-workflow.png)

An additional 21 local card captures were visually inspected: Navy, Light, and Dark at 320, 390, 720, 721, 980, 981, and 1280 CSS pixels. They show clear title/badge spacing, filled website frames, and centered controls. The full gallery captures verify paired action alignment and NotePal's additional footer line.

## Validation

Documentation, lint, types, 669 priority unit tests, and all 39 skeleton component/guidance/workflow checks passed. The priority browser selection passed 139 of 142 cases initially. Two new Projects cases exposed test-mechanics errors: pointer stability delayed the intended reversal boundary, and viewport coordinates included unrelated scrolling. Their corrected targeted runs passed with strict reversal continuity, outline opacity, and 3px frame-relative hover assertions. The existing Research video case timed out once and passed unchanged on its targeted rerun. Mobile Projects WebKit passed separately. The final ten-case Projects sweep passed nine cases immediately, including the new painted-preview check; its touch-target case passed on a focused rerun after replacing fractional bounding-box measurement with the strict integer layout-height check (`offsetHeight >= 44`).

The static build passed using validated template content. Its exported Projects route was checked with JavaScript enabled and disabled at desktop and mobile widths: five visible cards, correct external destinations and safe-link attributes, loaded responsive images, readable LeetNotes content, preserved NotePal attribution, functional native disclosures, and visible keyboard focus on the static preview and diagram links. No authenticated demo features or provider transactions were exercised.

Browser coverage exercises every requested width in all three themes, independent state, fixed button dimensions, stable surrounding geometry, inactive-face inertness, keyboard operation, negative outbound rotation, interrupted reversal, label crossfades, hover entry/exit, and immediate reduced motion. The 200% check uses a 640px effective layout width for a 1280px display; it is not a physical browser-zoom or device-Safari result.

WebKit's screenshot API painted a mirrored reverse face even in a minimal standalone CSS flip. Native-window capture of the same browser correctly showed both the preview and workflow; those two reviewed images above use the local development route at a 700px viewport with reduced motion. This matches the capture limitation described in [Playwright issue 21620](https://github.com/microsoft/playwright/issues/21620). Experimental workarounds were removed: production retains normal backface culling, face clipping, and interruption-safe CSS transforms. A separate Chromium pixel check protects the painted preview independently of state assertions; WebKit retains functional coverage and native-window evidence. These are desktop WebKit checks, not a physical iPhone result.

## Capture limits and Linux baselines

The current in-app-browser assets are native 1× captures. Desktop dimensions are 1280×800, 1272×795, and 1280×800; narrow dimensions are 480×360, 472×354, and 480×360 for Compliance, NotePal, and Tergion respectively. The registry records these actual dimensions. Requested exact-size desktop and 2× mobile replacements await authorization to use the external Playwright capture path; the current assets have not been upscaled or described as 2×.

The [Ubuntu capture](https://github.com/nicolasgioanni/Smart-Porfolio/actions/runs/37991162534) passed for consolidated implementation `c591e9c5d92270eddf6a04fdd4f829a9223271a3`. All 25 artifact images were byte-identical to the individually reviewed captures from `dbb5da97cdc125734a89160ad9d329468af26f35`; the original final artifact bytes were then copied into the baseline directory. Three Projects snapshots changed from the earlier PR baseline set, while the other 22 remained identical. The 25-image matrix, zero-difference threshold, direct alignment tests, and held-navigation transition checks remain intact. Capture success and this byte comparison are separate evidence from blocked PR CI.

PR #110 remains based on fixed revision `97ac2a6cb7371a335d0a2f55d71c3fe4bb0357a6`. Later-main conflicts and their blocked PR CI are deliberately left for separate integration work.
