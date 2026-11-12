# Asset provenance

This register records externally sourced public assets that ship with the static portfolio. It supplements the content schema and does not grant publication permission by itself. Keep the source URL, publication status, derivative work, and review facts current whenever an asset changes.

## Organization marks

| Asset | Source and publication status | Stored derivative | Review facts |
| --- | --- | --- | --- |
| CDAO emblem | [DVIDS: Vector CDAO Logos](https://www.dvidshub.net/graphic/30039/vector-cdao-logos), credited to Alexander Payne and marked Public Domain by DVIDS. | `public/images/organizations/cdao_logo.webp` is an emblem-only, transparent WebP derived from the approved DVIDS raster preview; the wordmark was excluded. | Source page reviewed 2026-10-06. White preview background was converted to alpha and visible emblem pixels were normalized to the source navy to avoid a light edge halo. Output: 310 by 308 pixels, alpha channel present, SHA-256 `04199e39c807997ed456752408bb932d71047af3bf724ed82cfe331cd8cfe0a8`. |

All files under `public/` are anonymously retrievable. Before publishing another mark, verify its public status, use only the approved visual portion, document transformations here, and reference it through a safe root-relative content path.

## Project previews

Three published homepage captures retain their existing desktop `*-concept.webp` paths for workbook compatibility and add reviewed local `*-mobile.webp` variants for the narrow `4:3` frame. One supplied Clair desktop screenshot remains unchanged and intentionally has no narrow derivative. The typed registry records the exact current source dimensions and selects the narrow image with `<picture>` at `720px` and below; do not claim a device-pixel ratio the reviewed bytes do not provide. Their provenance, dimensions, limits, and display treatment are recorded in [Project showcase](PROJECT_SHOWCASE.md#provenance-and-editorial-boundaries). LeetNotes retains its separately captured raster fallback while its enhanced preview is repository-native HTML/SVG.
