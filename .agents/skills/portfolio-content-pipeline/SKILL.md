---
name: portfolio-content-pipeline
description: Safely change portfolio workbook inputs, local templates, generated content, or published assets without adding runtime content fetching.
---

# Portfolio content pipeline

Use this skill for source-workbook schema, template CSV, generation, content mapping, generated JSON, or published portfolio assets.

Read [system decisions](../../knowledge/SYSTEM_DECISIONS.md), then use the `content` card in the [agent map](../../../docs/development/AGENT_MAP.md#owner-cards). Start with its linked [pipeline](../../../docs/content/CONTENT_PIPELINE.md#generated-json) or [mapping](../../../docs/content/CONTENT_MAPPING.md#authoritative-implementation) section; open schemas only for changed fields. The workbook is an authoring surface, not a runtime dependency: validate and generate content at build time, then render the generated result.

Keep parser limits, header validation, normalization, semantic hashing, URL policy, and public-safe boundaries intact. Reuse the existing generation and resolver paths instead of adding component-level source access. Test a changed boundary with its closest parser or resolver contract, then generate content and run the relevant route checks.

For Projects, read [Project showcase handoff](../../../docs/content/PROJECT_SHOWCASE.md#workbook-publication-handoff). Keep the workbook authoritative for membership, copy, order, and destinations; local illustration and diagram registries must not insert missing project records. Include the canonical CSV import handoff when changing the lineup.

For Research media, read [publication and replacement checks](../../../docs/content/RESEARCH_MEDIA.md#publication-and-replacement-checks) and the shared interface skill before changing graphical or video assets.
