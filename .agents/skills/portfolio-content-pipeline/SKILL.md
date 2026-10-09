---
name: portfolio-content-pipeline
description: Safely change portfolio workbook inputs, local templates, generated content, or published assets without adding runtime content fetching.
---

# Portfolio content pipeline

Use this skill for source-workbook schema, template CSV, generation, content mapping, generated JSON, or published portfolio assets.

Read [system decisions](../../knowledge/SYSTEM_DECISIONS.md), [Content pipeline](../../../docs/content/CONTENT_PIPELINE.md), and the relevant schema or mapping guide before editing. The workbook is an authoring surface, not a runtime dependency: validate and generate content at build time, then render the generated result.

Keep parser limits, header validation, normalization, semantic hashing, URL policy, and public-safe boundaries intact. Reuse the existing generation and resolver paths instead of adding component-level source access. Test a changed boundary with its closest parser or resolver contract, then generate content and run the relevant route checks.

For remote workbook transport, keep per-hop anonymous HTTPS destination validation, bounded manual redirects, deadlines, body budgets, and nonblocking cleanup together in the generator. Record implementation scope, including any DNS-resolution limitation, in the Content pipeline guide rather than implying unimplemented network protections.

For Projects, read [Project showcase](../../../docs/content/PROJECT_SHOWCASE.md). Keep the workbook authoritative for membership, copy, order, and destinations; local illustration and diagram registries must not insert missing project records. Include the canonical CSV import handoff when changing the lineup.

For Research media, read [Research media](../../../docs/content/RESEARCH_MEDIA.md) and the shared interface skill before changing graphical or video assets.
