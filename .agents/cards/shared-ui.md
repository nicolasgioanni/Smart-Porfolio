# shared-ui

Neutral shared components, shell, styles and contact validation. Find an existing neutral primitive and its tests before adding shared behavior.

Start at `src/components/overlay/ModalDialog.tsx` and inspect `src/components/overlay/ModalDialog.test.tsx`. Read the [portfolio-interface-contracts](../skills/portfolio-interface-contracts/SKILL.md) and [authority](../../docs/design/DESIGN_SYSTEM.md#surface-primitives) for this contract. Run `npm run test:navigation` as applicable.

Consumers: home, experience, research, projects, recommendations, skills, legal, resume, contact-ui, routes-seo. Theme writes, dialogs or feature composition require the relevant theme or feature owner.
