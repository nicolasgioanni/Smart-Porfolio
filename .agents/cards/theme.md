# theme

Theme preference, transition and palette tokens. Trace preference reconciliation and all hydrated writes through the shared transition helper.

Start at `src/lib/theme/themeTransition.ts` and inspect `src/lib/theme/themeTransition.test.ts`. Read the [portfolio-interface-contracts](../skills/portfolio-interface-contracts/SKILL.md) and [authority](../../docs/design/DESIGN_SYSTEM.md#themes) for this contract. Run `npm run test:navigation` as applicable.

Consumers: shared-ui. Palette, reduced-motion or transition changes require interface guidance and affected shared UI tests.
