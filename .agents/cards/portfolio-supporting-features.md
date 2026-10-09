# Supporting portfolio features

Owns [recommendations](../../src/components/portfolio/recommendations/RecommendationsList.tsx), [resume panel](../../src/components/portfolio/resume/ResumePanel.tsx), and [skills showcase](../../src/components/portfolio/skills/PortfolioSkillShowcase.tsx). Reuse [PortfolioCard](../../src/components/portfolio/shared/PortfolioCard.tsx) and [recommendation selection](../../src/lib/content/selectRecommendationContent.ts).

Read [skills](../../docs/design/DESIGN_SYSTEM.md#skills) and [recommendations](../../docs/design/DESIGN_SYSTEM.md#recommendations). Validate with [recommendation tests](../../src/components/portfolio/recommendations/RecommendationsList.test.tsx): `npm run test -- src/components/portfolio/recommendations/RecommendationsList.test.tsx`.

Run `npm run test:priority` when content eligibility, expansion, or reusable portfolio primitives change; route modal behavior to the modal card.
