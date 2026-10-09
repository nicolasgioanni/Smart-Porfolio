# Contact browser experience

Owns [ContactForm](../../src/components/contact/ContactForm.tsx), [browser validation](../../src/lib/contact/validation.ts), and [contact styles](../../src/styles/contact.css). The static route collects and validates UI state; it does not take over Function trust-boundary enforcement.

Read [route and upfront verification](../../docs/security/CONTACT_SYSTEM.md#route-and-upfront-verification) and [three wizard steps](../../docs/security/CONTACT_SYSTEM.md#three-wizard-steps). Reuse the shared validation module and contact step transition.

Validate with [route coverage](../../src/app/contact/contact.test.tsx), [form validation](../../src/components/contact/contactFormValidation.test.ts), and [browser contact coverage](../../tests/e2e/contact.spec.ts). Run `npm run test:e2e:contact` for user-flow changes; route endpoint or migration changes to the Functions and D1 card.
