# System decisions

This is a compact routing reference. The linked implementation and product documents remain authoritative when detail matters.

| Decision | Current contract | Authority |
| --- | --- | --- |
| Rendering | Portfolio pages are static-first. Browser code enhances interaction and does not fetch portfolio content. | [Architecture](../../docs/architecture/ARCHITECTURE.md) |
| Content | Checked-in templates support local and pull-request work. Strict production candidates use one validated workbook snapshot, then generate public-safe JSON. | [Content pipeline](../../docs/content/CONTENT_PIPELINE.md) |
| UI primitives | Reuse shared navigation, modal, theme-transition, content, and loading primitives before adding variants. | [Project structure](../../docs/architecture/PROJECT_STRUCTURE.md) |
| Module direction | `src/lib` does not directly import presentation or feature modules; `src/components` receives content through application and library boundaries rather than generated snapshots, Functions, or scripts. ESLint checks alias and relative specifiers, not transitive reachability. | [Project structure](../../docs/architecture/PROJECT_STRUCTURE.md) |
| Appearance | Surfaces are solid semantic tiers. Theme writes use the shared transition helper; motion must have a reduced-motion fallback. | [Design system](../../docs/design/DESIGN_SYSTEM.md) |
| Contact | Static pages and isolated Pages Functions have separate trust boundaries. Endpoint changes require validation, abuse controls, and documented runtime configuration. | [Contact system](../../docs/security/CONTACT_SYSTEM.md) |
| Deployment | A verified static artifact is built from an exact candidate and deployed only after its integrity checks. `main` is production and `develop` is preview. | [Deployment](../../docs/operations/DEPLOYMENT.md) |
| Regressions | Unit, integration, browser, and Linux-only skeleton visual contracts protect distinct behavior. Keep assertions strict and select the narrowest relevant command first. | [Testing](../../docs/quality/TESTING.md) |

When a durable decision changes, update this table and its linked authoritative document in the same change. Do not turn task history into permanent guidance.
