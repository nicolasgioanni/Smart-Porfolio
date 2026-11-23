# Navigation and shell

Owns [site shell](../../src/components/layout/SiteShell.tsx), [main navigation](../../src/components/navigation/MainNavigation.tsx), and [mobile navigation](../../src/components/navigation/MobileNavigation.tsx). Reuse [navigation items](../../src/components/navigation/navigationItems.ts) and the route registry; desktop links and mobile rail stay one navigation contract.

Read [navigation accessibility](../../docs/design/ACCESSIBILITY.md#navigation) and [header and navigation](../../docs/design/DESIGN_SYSTEM.md#header-and-navigation). Validate with [navigation tests](../../src/components/navigation/navigation.test.tsx) and [mobile coverage](../../src/components/navigation/MobileNavigation.test.tsx).

Run `npm run test:e2e:navigation` for focus, scroll, responsive geometry, or fixed-rail changes. Route palette behavior to the theme card.
