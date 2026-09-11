# Repository agent guidance

## Reuse before extension

- Search for an existing component, selector, validator, style primitive, and test helper before adding another implementation.
- Keep domain content in its owning feature while moving repeated behavior into a narrowly scoped shared module.
- Preserve static rendering and progressive enhancement; client code should add interaction rather than fetch portfolio content.

## Theme transitions

- Route every hydrated `data-theme` write through `src/lib/theme/themeTransition.ts`; do not add component-local color transitions or wildcard per-element transition rules.
- `ThemePreferenceScript` and the first hydrated preference reconciliation must remain immediate so the selected palette is in place before paint. Later eligible changes use only the shared native View Transition opacity fade.
- Keep the transition at `160ms`, opacity-only, and progressive. Reduced-motion, hidden-document, unsupported, failed, and unchanged-palette cases must update immediately without timers, transforms, blur, gradients, or layout animation.

## Surface language

- Build hierarchy from semantic, solid surface tiers. Light needs distinct off-white, light-gray, and blue-gray layers; Dark needs distinct charcoal and slate layers; preserve the existing navy palette as its own tiered mode.
- Do not add CSS gradients, glow shadows, decorative highlights or overlays, backdrop blur, or CSS mask fades or soft clipping. Use restrained neutral shadows and one-pixel borders only when they clarify elevation or separation.
- Accent colors belong to meaningful controls and states, never to ambient page decoration. Preserve focus and validation rings. Purposeful hard `overflow` clipping may contain content without a fade; SVG `clipPath` is reserved only for intentional diagram or media geometry.

## Dialogs and media

- Use `src/components/overlay/ModalDialog.tsx` for modal previews and evidence dialogs. Do not duplicate portal, focus-trap, Escape, backdrop, scroll-lock, reduced-motion, or focus-restoration logic.
- Give every dialog an accessible name, a visible close control, an intentional initial-focus target, and its originating trigger reference.
- Store published research media under `public/images/research/` and reference it with root-relative paths. Use intrinsic dimensions and `object-fit: contain` when the source aspect ratio must remain intact.
- Sanitize contributed Research PNGs with `scripts/stripPngMetadata.mjs` before publication. Preserve retained chunks byte-for-byte; the shared parser and CLI enforce protected input, chunk, 64 MiB decoded-image, 16,384-pixel dimension, and 67,108,864-pixel canvas ceilings, while asset tests reject invalid IHDR, palette, critical-chunk, zlib, scanline, and image-data ordering semantics alongside embedded text, EXIF, or provenance chunks. Do not raise or bypass those ceilings without a documented security review.
- Resolve Research graphical abstracts through `src/lib/content/researchGraphicalAbstracts.ts`. A complete canonical path-and-alt pair overrides the curated asset for a known project; when both canonical fields are absent, one of the three approved project IDs may use its curated asset. Incomplete pairs are invalid upstream and must not be masked. Never read or render the temporary legacy Research `image` field.
- Render graphical abstracts through `ResearchGraphicalAbstractPreview` and the shared dialog primitive so thumbnail, keyboard, dismissal, focus-restoration, and full-size-preview behavior stay aligned.
- Resolve self-hosted Research video only through `src/lib/content/researchVideos.ts` and `ResearchVideoPreview`. Narrated video requires a reviewed synchronized WebVTT track and readable transcript with timestamped visual descriptions when meaningful visuals are not narrated, plus a same-origin download fallback; keep native captions, fullscreen, and picture-in-picture available. Pause and transfer the safe current timeline between inline and modal views without programmatic playback.
- Keep the CytoCV supplementary-video MP4, captions, and transcript byte-locked by `src/lib/media/researchVideoAssets.test.ts`; preserve its 16 MiB video and 64 KiB-per-text-asset read ceilings, and document any authorized replacement in `docs/RESEARCH_MEDIA.md` without inferring a media license from source code.
- Keep optional media absent rather than inventing a public asset. Disabled resources must use native disabled semantics and concise visible labels.

## Verification and documentation

- Add focused component tests for interaction state and Playwright coverage when behavior depends on scrolling, focus, responsive layout, or browser painting.
- Verify keyboard dismissal, focus containment and restoration, backdrop isolation, reduced motion, and all supported themes for new modal consumers.
- Run `npm run docs:check`, `npm run lint`, `npm run typecheck`, focused tests, the applicable browser suite, and `npm run build` before handoff.
- Update architecture, accessibility, design-system, testing, and content-pipeline documentation when their contracts change.
