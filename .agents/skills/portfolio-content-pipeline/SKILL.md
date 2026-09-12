---
name: portfolio-content-pipeline
description: Safely change portfolio workbook inputs, local templates, generated content, or published assets without adding runtime content fetching.
---

# Portfolio content pipeline

Use this skill for source-workbook schema, template CSV, generation, content mapping, generated JSON, or published portfolio assets.

Read [system decisions](../../knowledge/SYSTEM_DECISIONS.md), [Content pipeline](../../../docs/content/CONTENT_PIPELINE.md), and the relevant schema or mapping guide before editing. The workbook is an authoring surface, not a runtime dependency: validate and generate content at build time, then render the generated result.

Keep parser limits, header validation, normalization, semantic hashing, URL policy, and public-safe boundaries intact. Reuse the existing generation and resolver paths instead of adding component-level source access. Test a changed boundary with its closest parser or resolver contract, then generate content and run the relevant route checks.

For Research media, read [Research media](../../../docs/content/RESEARCH_MEDIA.md) and the shared interface skill before changing graphical or video assets.
