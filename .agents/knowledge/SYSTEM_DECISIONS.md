# System decisions

This compact reference links to authoritative product documentation; update it when a durable decision changes.

| Decision | Contract | Authority |
| --- | --- | --- |
| Rendering | Static-first pages; browser code enhances interaction and never fetches portfolio content. | [Architecture](../../docs/architecture/ARCHITECTURE.md) |
| Content | Templates support local work; production uses one validated workbook snapshot and public-safe generated JSON. | [Content pipeline](../../docs/content/CONTENT_PIPELINE.md) |
| Ownership | Features own domain UI, selectors, loaders and styles; routes compose, shared components and libraries stay neutral. Enforced import directions allow Home to selected features and Projects to Skills. | [Project structure](../../docs/architecture/PROJECT_STRUCTURE.md#application-composition) |
| UI | Reuse shared theme transition, modal, navigation and loading primitives. Keep solid semantic surfaces and reduced-motion fallbacks. | [Design system](../../docs/design/DESIGN_SYSTEM.md), [Accessibility](../../docs/design/ACCESSIBILITY.md) |
| Media | Projects records remain workbook-owned; Research uses existing resolvers and captions. The reviewed transcript remains an integrity asset without an interface link. | [Project showcase](../../docs/content/PROJECT_SHOWCASE.md), [Research media](../../docs/content/RESEARCH_MEDIA.md) |
| Contact | Static pages and Pages Functions have separate trust boundaries. Shared offline validation does not replace endpoint validation or abuse controls. | [Contact system](../../docs/security/CONTACT_SYSTEM.md) |
| Deployment | Verify the exact static artifact; `main` is production and `develop` preview. Tracked branch policy is distinct from observed live settings. | [Deployment](../../docs/operations/DEPLOYMENT.md) |
| Regressions | Unit, integration, browser, and Linux-only skeleton visual contracts protect distinct behavior. | [Testing](../../docs/quality/TESTING.md) |
