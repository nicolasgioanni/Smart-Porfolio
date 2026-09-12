---
name: portfolio-interface-contracts
description: Modify Smart Portfolio components, themes, motion, dialogs, or accessibility while preserving shared interaction and rendering contracts.
---

# Portfolio interface contracts

Use this skill for visible components, CSS, responsive behavior, theme handling, motion, dialogs, and accessibility.

Read [Design system](../../../docs/design/DESIGN_SYSTEM.md), [Accessibility](../../../docs/design/ACCESSIBILITY.md), and [Animation guidelines](../../../docs/design/ANIMATION_GUIDELINES.md). Search for an existing component, selector, validation pattern, and test helper before adding one.

All hydrated `data-theme` writes go through `src/lib/theme/themeTransition.ts`. Initial preference reconciliation is immediate; eligible later changes use its shared `160ms` opacity-only native View Transition. Keep the existing immediate fallbacks for reduced motion, hidden documents, unsupported transitions, failed transitions, and unchanged palettes.

Use `src/components/overlay/ModalDialog.tsx` for modal previews and evidence dialogs. Preserve its accessible name, close control, focus lifecycle, Escape, backdrop isolation, scroll lock, and reduced-motion behavior. Follow the existing Research media resolvers and previews; do not create a parallel asset or dialog path.

Keep surfaces solid and semantic. Do not add gradients, glow, backdrop blur, decorative overlays, or component-local transition systems. Add browser coverage when scrolling, focus, responsive geometry, or browser paint is part of the contract.

For Research media, preserve `ResearchGraphicalAbstractPreview`, `ResearchVideoPreview`, and the `researchVideos.ts` resolver paths. Sanitize contributed PNGs with `scripts/stripPngMetadata.mjs`; do not raise its decoded-image, dimension, or canvas ceilings without a documented security review. Preserve the `researchVideoAssets.test.ts` byte locks, its 16 MiB video and 64 KiB-per-text-asset read ceilings, native media controls, accessible transcript, and paused timeline handoff. Read [Research media](../../../docs/content/RESEARCH_MEDIA.md) when published media changes.
