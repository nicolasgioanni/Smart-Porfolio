# Projects gallery

Owns [Project list composition](../../src/features/projects/components/ProjectList.tsx), [visual tabs](../../src/features/projects/components/ProjectVisualTabs.tsx), and [local visual registry](../../src/features/projects/selectors/projectVisualRegistry.ts). Workbook records own membership, copy, order, and destinations; local visuals only present established records.

Read [workbook publication handoff](../../docs/content/PROJECT_SHOWCASE.md#workbook-publication-handoff) and [Projects gallery](../../docs/design/DESIGN_SYSTEM.md#projects-gallery). Validate with [showcase coverage](../../src/features/projects/components/ProjectShowcase.test.tsx) and [skill coverage](../../src/features/projects/components/ProjectSkillShowcase.test.tsx): `npm run test -- src/features/projects/components/ProjectShowcase.test.tsx src/features/projects/components/ProjectSkillShowcase.test.tsx`.

Run `npm run test:e2e:priority` for visual-tab or responsive interaction changes, and `npm run test:priority` for selection or resolver changes. Preserve the static no-JavaScript workflow disclosure.
