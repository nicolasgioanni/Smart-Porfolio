# migrations

Contact D1 migration history. Inspect the ordered D1 migrations, configuration, and reservation integration coverage before schema changes.

Start at `migrations/0001_contact_rate_reservations.sql` and inspect `scripts/d1Reservation.integration.test.ts`. Read the [portfolio-release-security](../skills/portfolio-release-security/SKILL.md) and [authority](../../docs/security/CONTACT_SYSTEM.md#configuration) for this contract. Run `npm run test:infrastructure` as applicable.

Consumers: contact-functions, release. Expand to contact-functions and release for query compatibility and deployment migration sequencing.
