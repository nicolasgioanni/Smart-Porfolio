# Supporting portfolio features

Owns [recommendations](../../src/features/recommendations/components/RecommendationsList.tsx), [resume panel](../../src/features/resume/components/ResumePanel.tsx), and [skills showcase](../../src/features/skills/components/PortfolioSkillShowcase.tsx). Reuse [PortfolioCard](../../src/components/portfolio/shared/PortfolioCard.tsx) and [recommendation selection](../../src/features/recommendations/content/selectRecommendationContent.ts).

Read [skills](../../docs/design/DESIGN_SYSTEM.md#skills) and [recommendations](../../docs/design/DESIGN_SYSTEM.md#recommendations). Validate with [recommendation tests](../../src/features/recommendations/components/RecommendationsList.test.tsx): `npm run test -- src/features/recommendations/components/RecommendationsList.test.tsx`.

Run `npm run test:priority` when content eligibility, expansion, or reusable portfolio primitives change; route modal behavior to the modal card.
