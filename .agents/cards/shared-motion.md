# Motion

Owns [scroll reveal](../../src/components/motion/ScrollReveal.tsx), [motion preference](../../src/components/motion/useReducedMotionPreference.ts), and [motion styles](../../src/styles/motion.css). Motion enhances a static page and has a reduced-motion fallback.

Read [motion and reduced motion](../../docs/design/ACCESSIBILITY.md#motion-and-reduced-motion) and [preferred properties](../../docs/design/ANIMATION_GUIDELINES.md#preferred-properties). Validate with [motion tests](../../src/components/motion/motion.test.tsx): `npm run test -- src/components/motion/motion.test.tsx`.

Run `npm run test:priority` when a shared motion primitive, preference, or painted state changes. Use the skeleton card for held-navigation transitions.
