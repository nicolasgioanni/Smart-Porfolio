# Animation guidelines

Motion is restrained, legible, and tied to comprehension or state. It must not distract from portfolio evidence.

## Preferred properties

Animate `transform` and `opacity` first. Recommendation disclosure, footer grid rows, and the small header island are explicit bounded exceptions. Do not introduce layout animation elsewhere without documenting why it communicates state better than an immediate change.

## Reduced motion

Always respect `prefers-reduced-motion`. Disable or simplify shimmer, entrance motion, scroll effects, disclosure transitions, and decorative travel for motion-sensitive users. State, content, focus, and controls must remain available.

## Home role rotation

The desktop Home role uses a fixed-height, overflow-hidden window sized for the widest configured role so neither the line nor surrounding layout shifts. Server rendering and initial hydration show the first configured engineer role. A subtle CSS mask may soften the desktop window edges, but text stays sharp. Do not animate `filter`, backdrop blur, or text blur.

Show each role for `3400ms`, then transition for `640ms` over `8px` with `cubic-bezier(0.22, 1, 0.36, 1)`. The vertical flip rotates through `70deg`: outgoing text tilts upward and fades, while incoming text starts below at the opposing angle, settles upright, and fades in.

For the configured engineer sequence, animate only the right-aligned prefix while one persistent suffix remains stationary. Transitions between an engineer role and the alternate role flip the complete line. Visual animation layers remain outside the accessibility tree, while one stable non-live role label is exposed.

Above the collapsed-navigation breakpoint, this approved prefix and 3D whole-line behavior remains unchanged. At `max-width: 980px`, CSS selects a mobile-safe visual branch with exactly one sharp role-label layer. It fades the current label out for `320ms`, swaps text only while fully transparent, and fades the same label node back in for `320ms`. The mobile label uses no mask, perspective, 3D transform, backface composition, or persistent `will-change`.

Do not substitute typing, letter-by-letter, bounce, large-scale, spinning-carousel, bright-pill, or blur effects. A static-headline fallback never schedules rotation. Reduced motion schedules no timers and shows the first role statically. Role rotation is independent of the scroll-reveal setting.

## Recommendation expansion

Recommendation quotes display four lines while collapsed by default. Within a multi-card Home row, a card with a taller header may use three lines so collapsed cards remain level. Single-card Home rows and detail cards remain at four lines.

Overflowing quotes use a true alpha mask over the lower half of the final visible line. `Show more` and `Show less` animate the clipped viewport over `520ms` and lightly fade the quote over `320ms`, both with `cubic-bezier(0.22, 1, 0.36, 1)`.

The button retains `aria-expanded` and `aria-controls`; quote text is not duplicated into a live region. Above `980px`, only the selected Home card protrudes beyond the fixed desktop panel and an invisible reserve keeps later rows and the footer in normal document flow. At `max-width: 980px`, the fixed-panel sizing and reserve are removed so the recommendation card and containing surface grow together in natural flow. Reduced motion applies the open or closed state immediately.

## Hover Base 1

Hover Base 1 uses one low-opacity diagonal sheen that travels left to right over `1600ms`. It loops only while a control is genuinely hovered on a device matching `(hover: hover)` and `(pointer: fine)`. It never runs for touch-only input.

Use `hover-base-1--no-wave` where the sheen would obscure meaningful imagery. Surface lift is limited to one pixel, pressing removes the lift, and state colors remain available without motion.

The persistent desktop route indicator moves after pathname commit. Its `420ms` FLIP animation uses `cubic-bezier(0.65, 0, 0.35, 1)` and may animate only transform and opacity. During the bounded `480ms` route-settlement window, geometry changes retarget from the indicator's current presentation rectangle using the remaining time. Resizing outside the window and first hydration snap to final geometry. Rapid route changes begin a new bounded transition from the current position.

Reduced motion disables sheen, lift, arrow travel, and route-indicator travel while preserving hover, focus, pressed, expanded, and selected surfaces.

## Header and theme disclosure

Above `980px`, header expansion and compaction are state-driven, not continuously scroll-linked. Scroll input changes state only after the implemented direction and distance thresholds. Header pieces share the centralized `460ms` transition token. Keep the property list explicit and confined to the header island. At `max-width: 980px`, the header becomes a fixed bottom dock, remains expanded, and disables scroll and pointer geometry transitions.

The theme disclosure fades and settles over `200ms` with opacity and transform. Its shell provides pointer grace, and one cancellable `240ms` leave delay prevents accidental dismissal. Re-entry cancels the close. The header holds its current geometry while the disclosure is open so the trigger does not move away from the pointer. The panel settles below its trigger on desktop and above it in the mobile dock.

Theme selection updates colors without closing the panel. Reduced motion preserves visibility and selection without settle transitions.

## Mobile navigation rail

At `max-width: 980px`, route links remain in one native horizontal rail. After each pathname loads, automatic motion waits exactly `3000ms`. If the rail overflows and has not been touched, it returns to the Home edge over `420ms`, then drifts at approximately `20px` per second and reverses at each boundary. Links are never cloned or reordered, and the motion has no live announcement.

Pointer, swipe, wheel, keyboard, or focus interaction inside the rail permanently stops automatic motion for the current pathname. A new pathname enables the initial idle behavior again. Pause while the document is hidden, and cancel timers and animation frames when the mobile breakpoint exits or the component unmounts. Reduced motion disables the automatic return and drift while preserving manual horizontal scrolling. Edge fades reflect the current overflow boundary without animating content opacity.

## Scroll reveal

Use `IntersectionObserver` as the baseline for reveal and compression behavior. Do not introduce page-wide scroll-timeline effects without a clear readability benefit and static fallback.

Scroll motion must not blur text. The `enable_scroll_motion` setting gates scroll reveals and section motion. When false, those elements render immediately. It does not disable role rotation; the operating-system reduced-motion preference does.

## Footer disclosure

The footer expands into reserved normal-flow space. Each pathname owns a fresh compact disclosure, and automatic expansion requires new user scroll intent on that route plus a fully visible runway activation band. Observer callbacks, loading-layout changes, scroll restoration, and programmatic scrolling must not initiate the transition. The transition may animate width, padding, grid-row height, opacity, and a small vertical translation over roughly `420ms`. It must not animate blur or scale, change total document length, block native scrolling, or hide focused details. Reduced motion applies compact or expanded state immediately.

## Glass and blur

Keep backdrop blur subtle and bounded to surfaces. Do not use blur as a reveal, route transition, or full-screen motion effect.

## Visual constraint

Use layered translucent surfaces, fine borders, soft highlights, and restrained shadows. Avoid novelty effects that make the interface feel like a visual-effects demonstration.

## Related guidance

- [Design system](DESIGN_SYSTEM.md)
- [Accessibility](ACCESSIBILITY.md)
- [Skeleton loading guidelines](SKELETON_LOADING_GUIDELINES.md)
