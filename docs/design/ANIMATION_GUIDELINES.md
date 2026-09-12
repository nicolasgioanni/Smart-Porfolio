# Animation guidelines

Motion is restrained, legible, and tied to comprehension or state. It must not distract from portfolio evidence.

## Preferred properties

Animate `transform` and `opacity` first. Experience disclosure, recommendation disclosure, footer grid rows, and the small header island are explicit bounded exceptions. Do not introduce layout animation elsewhere without documenting why it communicates state better than an immediate change.

## Reduced motion

Always respect `prefers-reduced-motion`. Disable or simplify entrance motion, scroll effects, disclosure transitions, and decorative travel for motion-sensitive users. Skeletons are static. State, content, focus, and controls must remain available.

## Page entrance

Every resolved route enters through the shared `.site-main > .page-container` boundary. Fade the complete page body from zero opacity while it settles upward over `8px` for `280ms` with `cubic-bezier(0.16, 1, 0.3, 1)`. The header and footer are siblings of `main` and must not participate. Route skeletons use their separate `.skeleton-page` root and remain visible without this entrance; the animation starts only when resolved content replaces the loading fallback.

Keep this effect CSS-only and limited to opacity and transform. Do not add route state, a client wrapper, layout animation, scale, blur, or a persistent `will-change`. `prefers-reduced-motion: reduce` removes the animation and leaves the body fully visible. The page entrance is independent of `enable_scroll_motion`, which controls optional scroll-triggered reveals rather than route loading.

## Form validation feedback

After each invalid Next or Review attempt, shake each invalid control and its validation message for `180ms` with `ease-in-out`, two iterations, and no more than `2px` of horizontal travel in either direction. Replay the shake for every invalid attempt even when the validation text has not changed. Under `prefers-reduced-motion: reduce`, disable the shake while preserving the error message, red field treatment, and focus behavior.

## Contact notifications

The contact body portal enters from 8 pixels above with a 200ms opacity/transform animation. Cards use 10-pixel peeks and small 1.00/0.98/0.96 scales, expanding into measured separate rows through 200ms transforms. Dismissal fades and travels up 8 pixels over 200ms. Reserve stack geometry immediately; do not animate the contact form or surrounding page to accommodate notifications. Reduced motion disables these animations and removes dismissed cards immediately. Independent notification countdowns pause during hover, focus, touch-expanded reading, and document hiding. The verification well separately reserves widget/status/recovery space so provider lifecycle changes never move the surrounding gate.

## Home role rotation

The desktop Home role uses a fixed-height, overflow-hidden window sized for the widest configured role so neither the line nor surrounding layout shifts. Server rendering and initial hydration show the first configured engineer role. Its hard clipping edge keeps text sharp. Do not animate `filter` or text blur.

Show each role for `3400ms`, then transition for `640ms` over `8px` with `cubic-bezier(0.22, 1, 0.36, 1)`. The vertical flip rotates through `70deg`: outgoing text tilts upward and fades, while incoming text starts below at the opposing angle, settles upright, and fades in.

For the configured engineer sequence, animate only the right-aligned prefix while one persistent suffix remains stationary. Transitions between an engineer role and the alternate role flip the complete line. Visual animation layers remain outside the accessibility tree, while one stable non-live role label is exposed.

Above the collapsed-navigation breakpoint, this approved prefix and 3D whole-line behavior remains unchanged. At `max-width: 980px`, CSS selects a mobile-safe visual branch with exactly one sharp role-label layer. It fades the current label out for `320ms`, swaps text only while fully transparent, and fades the same label node back in for `320ms`. The mobile label uses no mask, perspective, 3D transform, backface composition, or persistent `will-change`.

Do not substitute typing, letter-by-letter, bounce, large-scale, spinning-carousel, bright-pill, or blur effects. A static-headline fallback never schedules rotation. Reduced motion schedules no timers and shows the first role statically. Role rotation is independent of the scroll-reveal setting.

## Recommendation expansion

Recommendation quotes display four lines while collapsed by default. Within a multi-card Home row, a card with a taller header may use three lines so collapsed cards remain level. Single-card Home rows and detail cards remain at four lines.

Overflowing quotes use a hard clipped viewport with a visible `Show more` control rather than a faded final line. `Show more` and `Show less` animate the clipped viewport over `520ms` and lightly fade the quote over `320ms`, both with `cubic-bezier(0.22, 1, 0.36, 1)`. Desktop detail cards remain outside grid flow throughout both directions of that transition, and cached compact heights are refreshed only after the viewport has fully settled closed.

The button retains `aria-expanded` and `aria-controls`; quote text is not duplicated into a live region. Above `980px`, a selected Home card may protrude beyond its fixed panel while an invisible reserve keeps later sections in normal document flow. On the detail route, the expanded card becomes an opaque overlay while every collapsed grid slot retains its measured height, so later recommendation rows do not move. Recalculate overlap during expansion and dim only cards physically covered by the overlay to approximately `0.58` opacity; add trailing reserve only when a bottom-row overlay would otherwise cover the footer.

At `max-width: 980px`, remove fixed-slot, overlay, reserve, and overlap-dimming behavior so the recommendation card and containing surface grow together in natural flow. Reduced motion applies open, closed, and overlap states immediately without height or opacity transitions.

## Hover Base 1

Hover Base 1 uses a solid semantic state layer for hover, focus, and selection. It may lift a control by one pixel on a genuine fine-pointer hover, but it does not animate a decorative sheen or highlight.

Surface lift is limited to one pixel, pressing removes the lift, and state colors remain available without motion.

The persistent desktop route indicator moves after pathname commit. Its `420ms` FLIP animation uses `cubic-bezier(0.65, 0, 0.35, 1)` and may animate only transform and opacity. During the bounded `480ms` route-settlement window, geometry changes retarget from the indicator's current presentation rectangle using the remaining time. Resizing outside the window and first hydration snap to final geometry. Rapid route changes begin a new bounded transition from the current position.

Reduced motion disables lift, arrow travel, and route-indicator travel while preserving hover, focus, pressed, expanded, and selected surfaces.

## Header and theme disclosure

Above `980px`, header expansion and compaction are state-driven, not continuously scroll-linked. Scroll input changes state only after the implemented direction and distance thresholds. Header pieces share the centralized `460ms` transition token. Keep the property list explicit and confined to the header island. At `max-width: 980px`, the header becomes a fixed bottom dock, remains expanded, and disables scroll and pointer geometry transitions.

The theme disclosure fades and settles over `200ms` with opacity and transform. Its shell provides pointer grace, and one cancellable `240ms` leave delay prevents accidental dismissal. Re-entry cancels the close. The header holds its current geometry while the disclosure is open so the trigger does not move away from the pointer. The panel settles below its trigger on desktop and above it in the mobile dock.

Theme selection updates colors without closing the panel. After hydration, an eligible palette change uses the shared `160ms` native View Transition fade with `cubic-bezier(0.2, 0, 0, 1)`: the previous snapshot stays still and the new snapshot changes only opacity. The snapshot layer never receives pointer events; after a verified fine-pointer selection, the disclosure ignores exactly one synthetic pointer leave and clears stale handling on completion or interruption, while genuine outside-pointer dismissal remains available throughout. It has no transform, blur, gradient, layout animation, per-element transition, timer, or persistent compositing hint. The synchronous head selection and the first hydrated reconciliation remain immediate to prevent a theme flash. Reduced motion, hidden documents, unsupported browsers, failed transitions, and unchanged palettes also update immediately while preserving selection, focus, and system-following behavior.

## Modal dialogs

Shared modal entry and exit use opacity plus a small consumer-configurable translation or scale over `180ms`. `src/styles/dialog.css` owns the lifecycle selectors so profile, skill, and media consumers do not duplicate timing or open-and-close state. Consumers may adjust geometry and the two entry-transform custom properties, but they must not add independent lifecycle timers.

Research graphical-abstract thumbnails transition their shadow and transform for a two-pixel direct lift on fine-pointer hover and keyboard `:focus-visible`. Their palette-dependent border state remains immediate so palette changes stay within the shared page-level transition. The image stays contained and the surrounding research card does not inherit that lift. The enlarged abstract uses only the shared modal lifecycle.

Reduced motion removes the transition and entry transform while preserving portal rendering, focus containment, dismissal, scroll locking, and focus restoration.

## Mobile navigation rail

At `max-width: 980px`, route links followed by GitHub, LinkedIn, Email, and theme controls remain in one native horizontal rail. After each pathname loads, automatic motion waits exactly `3000ms`. If the rail overflows and has not been touched, it returns to the Home edge over `420ms`, then drifts at approximately `20px` per second and reverses at each boundary. Controls are never cloned or reordered, and the motion has no live announcement.

Pointer, swipe, wheel, keyboard, focus, or native scroll interaction inside the rail pauses automatic motion and restarts a `5000ms` inactivity delay. When that delay completes, drift resumes from the current scroll position and preserves its prior direction instead of returning Home. An open theme menu holds the pause; closing it starts a fresh inactivity delay. A new pathname restores the initial `3000ms` behavior. Pause countdowns while the document is hidden, and cancel timers and animation frames when the mobile breakpoint exits or the component unmounts. Reduced motion disables the automatic return and drift while preserving manual horizontal scrolling. Native hard clipping marks the rail boundary without altering content opacity.

## Scroll reveal

Use `IntersectionObserver` as the baseline for reveal and compression behavior. Do not introduce page-wide scroll-timeline effects without a clear readability benefit and static fallback.

Scroll motion must not blur text. The `enable_scroll_motion` setting gates scroll reveals and section motion. When false, those elements render immediately. It does not disable role rotation; the operating-system reduced-motion preference does.

## Experience and research disclosure

The shared audience lens translates over `260ms`; selected text changes immediately through `aria-pressed`. Switching views settles the new card copy with a short opacity and vertical-transform transition. Opening a chapter uses one bounded `300ms` grid-row transition, while its refraction line, copy, and chevron use opacity or transform. Only one chapter per card can be open, which bounds layout work. Fine-pointer card lift is decorative and never required to find content.

Card-wide elevation belongs exclusively to active fine-pointer hover. A disclosure keeps focus after it opens, so `:focus-within` may strengthen the card border but must not apply the large surface shadow or translation. Keyboard focus remains visible on the focused control without leaving a tall elevated rectangle around expanded content while the page scrolls.

Reduced motion removes audience, card, chapter, and chevron transitions while preserving selected and expanded state. The global scroll-motion setting controls only the optional staggered card entrance; user-triggered audience and disclosure behavior remains available regardless of that setting.

The priority browser gate covers Experience and Research detail controls and the Recommendations expansion flow at desktop, responsive, and reduced-motion states. See [Testing](../quality/TESTING.md#browser-experience-and-research-coverage) for the executable coverage boundary.

## Footer disclosure

The footer expands into reserved normal-flow space. Each pathname owns a fresh compact disclosure, and automatic expansion requires new user scroll intent on that route plus a fully visible runway activation band. Observer callbacks, loading-layout changes, scroll restoration, and programmatic scrolling must not initiate the transition. The transition may animate width, padding, grid-row height, opacity, and a small vertical translation over roughly `420ms`. It must not animate blur or scale, change total document length, block native scrolling, or hide focused details. Reduced motion applies compact or expanded state immediately.

## Surface constraints

Use opaque semantic surfaces. Do not use backdrop blur, gradients, glow shadows, decorative page overlays, or CSS mask fades for hierarchy or motion.

## Visual constraint

Use layered solid tiers, fine borders, and restrained neutral shadows. Accent colors belong only to meaningful controls and states. The sole clipping exception is intentional SVG `clipPath` media geometry.

## Related guidance

- [Design system](DESIGN_SYSTEM.md)
- [Accessibility](ACCESSIBILITY.md)
- [Skeleton loading guidelines](SKELETON_LOADING_GUIDELINES.md)
- [Testing](../quality/TESTING.md)
