# Modal and overlay

Owns [ModalDialog](../../src/components/overlay/ModalDialog.tsx) and its shared [dialog styles](../../src/styles/dialog.css). Consumers supply content and geometry; the modal owns focus, dismissal, scroll locking, portal behavior, and persistent in-place media behavior.

Read [shared dialogs](../../docs/design/ACCESSIBILITY.md#shared-dialogs) and [modal dialogs](../../docs/design/ANIMATION_GUIDELINES.md#modal-dialogs). Validate with [modal coverage](../../src/components/overlay/ModalDialog.test.tsx): `npm run test -- src/components/overlay/ModalDialog.test.tsx`.

Run `npm run test:e2e:research` when fullscreen or media handoff changes, and `npm run test:priority` for lifecycle changes. Do not create a parallel dialog implementation.
