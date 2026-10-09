# System decisions

Linked implementation and product documents are authoritative for detail.

| Decision | Current contract | Authority |
| --- | --- | --- |
| Rendering | Portfolio pages are static-first. Browser code enhances interaction and does not fetch portfolio content. | [Architecture](../../docs/architecture/ARCHITECTURE.md) |
| Content | Checked-in templates support local/PR work. Production uses one validated workbook snapshot to generate public-safe JSON. | [Content pipeline](../../docs/content/CONTENT_PIPELINE.md) |
| UI primitives | Reuse navigation, modal, theme-transition, content, loading, and detail-disclosure primitives. Research fullscreen keeps its video through container fullscreen or the shared modal. `DetailDisclosureList`/`useDetailDisclosure` keep one evidence row active; desktop overlays an opaque panel, smaller viewports use normal flow. | [Project structure](../../docs/architecture/PROJECT_STRUCTURE.md), [Design system](../../docs/design/DESIGN_SYSTEM.md), [Accessibility](../../docs/design/ACCESSIBILITY.md) |
| Project visuals | Workbook records stay authoritative; local Concept artwork and static HTML/SVG workflows add accessible tabs. | [Project showcase](../../docs/content/PROJECT_SHOWCASE.md) |
| Module direction | `src/lib` does not import presentation/feature modules; `src/components` receives content through app/library boundaries, never generated snapshots, Functions, or scripts. ESLint checks direct alias and relative imports. | [Project structure](../../docs/architecture/PROJECT_STRUCTURE.md) |
| Appearance | Solid semantic surface tiers; blur only in Research video controls with opaque fallback. Theme writes use the transition helper; motion has reduced-motion fallback. | [Design system](../../docs/design/DESIGN_SYSTEM.md) |
| Contact | Static pages and Pages Functions have separate trust boundaries. Endpoint changes require validation, abuse controls, and documented runtime configuration. | [Contact system](../../docs/security/CONTACT_SYSTEM.md) |
| Deployment | A verified static artifact is built from an exact candidate and deployed only after its integrity checks. `main` is production and `develop` is preview. | [Deployment](../../docs/operations/DEPLOYMENT.md) |
| Regressions | Unit, integration, browser, and Linux-only skeleton visual contracts protect distinct behavior. Keep assertions strict and select the narrowest relevant command first. | [Testing](../../docs/quality/TESTING.md) |

When a durable decision changes, update this table and its linked authoritative document in the same change. Do not turn task history into permanent guidance.
