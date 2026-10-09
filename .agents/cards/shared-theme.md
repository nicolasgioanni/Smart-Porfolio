# Theme and appearance

Owns [theme controls](../../src/components/theme/ThemeSwitcher.tsx), [theme transition writes](../../src/lib/theme/themeTransition.ts), and [semantic tokens](../../src/styles/tokens.css). Every hydrated `data-theme` write goes through the transition helper; components consume tokens rather than locally chosen palette values.

Read [theme composition](../../docs/architecture/ARCHITECTURE.md#theme-and-visual-composition) and [themes](../../docs/design/DESIGN_SYSTEM.md#themes). Validate with [transition tests](../../src/lib/theme/themeTransition.test.ts) and [theme-switcher tests](../../src/components/theme/ThemeSwitcher.test.tsx): `npm run test -- src/lib/theme/themeTransition.test.ts src/components/theme/ThemeSwitcher.test.tsx`.

Run `npm run test:navigation` when the theme disclosure moves with navigation and `npm run test:priority` for preference or palette changes. Keep immediate reduced-motion and unsupported-browser fallbacks.
