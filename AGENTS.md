# Repository agent guidance

## Reuse before extension

- Search for an existing component, selector, validator, style primitive, and test helper before adding another implementation.
- Keep domain content in its owning feature while moving repeated behavior into a narrowly scoped shared module.
- Preserve static rendering and progressive enhancement; client code should add interaction rather than fetch portfolio content.

## Theme transitions

- Route every hydrated `data-theme` write through `src/lib/theme/themeTransition.ts`; do not add component-local color transitions or wildcard per-element transition rules.
- `ThemePreferenceScript` and the first hydrated preference reconciliation must remain immediate so the selected palette is in place before paint. Later eligible changes use only the shared native View Transition opacity fade.
- Keep the transition at `160ms`, opacity-only, and progressive. Reduced-motion, hidden-document, unsupported, failed, and unchanged-palette cases must update immediately without timers, transforms, blur, gradients, or layout animation.

## Dialogs and media

- Use `src/components/overlay/ModalDialog.tsx` for modal previews and evidence dialogs. Do not duplicate portal, focus-trap, Escape, backdrop, scroll-lock, reduced-motion, or focus-restoration logic.
- Give every dialog an accessible name, a visible close control, an intentional initial-focus target, and its originating trigger reference.
- Store published research media under `public/images/research/` and reference it with root-relative paths. Use intrinsic dimensions and `object-fit: contain` when the source aspect ratio must remain intact.
- Keep optional media absent rather than inventing a public asset. Disabled resources must use native disabled semantics and concise visible labels.

## Verification and documentation

- Add focused component tests for interaction state and Playwright coverage when behavior depends on scrolling, focus, responsive layout, or browser painting.
- Verify keyboard dismissal, focus containment and restoration, backdrop isolation, reduced motion, and all supported themes for new modal consumers.
- Run `npm run docs:check`, `npm run lint`, `npm run typecheck`, focused tests, the applicable browser suite, and `npm run build` before handoff.
- Update architecture, accessibility, design-system, testing, and content-pipeline documentation when their contracts change.
