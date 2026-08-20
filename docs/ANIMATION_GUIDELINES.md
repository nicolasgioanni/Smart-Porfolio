# Animation Guidelines

## Principles

Motion should feel premium, restrained, and professional. It should support comprehension rather than distract from the portfolio content.

## Preferred properties

Animate `transform` and `opacity` first. Avoid animating layout properties such as width, height, top, left, margin, and padding.

## Reduced motion

Always respect `prefers-reduced-motion`. Disable or simplify shimmer, entrance motion, and scroll-linked effects for motion-sensitive users.

## Home role swap

The Home role uses a fixed-height, overflow-hidden window sized for the widest configured role so neither the line nor the surrounding layout shifts. Server rendering and initial hydration show the first configured engineer role. A subtle top-and-bottom CSS mask may soften the window edges, but the text itself must remain sharp: do not animate or apply `filter`, backdrop blur, or text blur.

Show each role for `3400ms`, then transition for `640ms` over `8px` with `cubic-bezier(0.22, 1, 0.36, 1)`. The vertical flip rotates through `70deg`: outgoing text tilts upward and fades from fully visible to transparent, while incoming text starts below at the opposing angle, settles upright, and fades in. Keep the perspective shallow and the text sharp so the movement reads as a controlled mechanical flip rather than a carousel effect.

For `Software Engineer` → `AI Engineer` → `Security Engineer`, animate only the right-aligned prefix while one persistent `Engineer` suffix remains stationary. For `Security Engineer` → `Research Scientist` and `Research Scientist` → `Software Engineer`, flip and fade the entire role line. Keep the fixed prefix column and widest-role sizing so neither the suffix nor surrounding layout shifts. Keep all visual animation layers out of the accessibility tree and expose one stable, non-live role label.

Do not substitute typing, letter-by-letter, bounce, large-scale, spinning-carousel, bright-pill, or blur effects. Keep the approved flip limited to the small `70deg` vertical role transition. A static-headline fallback never schedules rotation. When `prefers-reduced-motion` is active, schedule no rotation timers and show the first role statically (`Software Engineer` for the default content). The role rotation is independent of the scroll-reveal setting so disabling entrance effects does not silently freeze the headline.

## Recommendation expansion

Recommendation quotes display four lines while collapsed. `Show more` and `Show less` animate the clipped viewport over `520ms` with `cubic-bezier(0.22, 1, 0.36, 1)` and lightly fade the quote and bottom edge treatment over `320ms` with the same easing. The native button retains `aria-expanded` and `aria-controls`; text is never duplicated into a live region. Only the selected recommendation card grows, while sibling cards remain at their natural heights and the containing section stays in normal document flow. Disable all expansion and fade transitions for `prefers-reduced-motion` while preserving the immediate open/closed state.

## Hover Base 1

Hover Base 1 uses a single low-opacity diagonal sheen that travels left-to-right over `1600ms`. It loops only while a control is genuinely hovered and is limited to devices matching both `(hover: hover)` and `(pointer: fine)`; it never runs for touch-only input. Apply `hover-base-1--no-wave` to imagery or other controls where the sheen would obscure meaningful visual content. The surface lift is limited to one pixel, pressing removes the lift immediately, and state colors remain available without motion.

The persistent desktop route indicator moves after a pathname commits in the preserved layout. Its `420ms` FLIP animation uses the dedicated symmetric `cubic-bezier(0.65, 0, 0.35, 1)` route easing so it departs gently, accelerates through the middle, and settles softly at the destination. It may animate only `transform` and opacity. During the fixed `480ms` route-settlement window, header/link geometry changes retarget from the indicator's current presentation rectangle using only the remaining time; this prevents the compact-to-expanded header morph from cancelling card-initiated navigation motion or extending it indefinitely. Resizing outside that window and first-page hydration snap directly to final geometry. Rapid route changes start a new bounded transition from the current visual position. Under `prefers-reduced-motion`, disable the sheen, lift, arrow travel, and route-indicator travel while preserving the hover, focus, and selected surfaces.

## Scroll motion

The header's expanded-to-compact morph is state-driven rather than continuously scroll-linked: scroll input only changes its state after the existing direction and distance thresholds are crossed. All header pieces share the centralized `460ms` restrained ease-out token, which keeps the transition coordinated and only slightly slower than before. Keep its property list explicit, confine metric changes to the small header island, and do not introduce request-animation-frame interpolation or a scroll-progress animation. Reduced-motion users receive the final header state without the transition.

The header theme disclosure fades and settles over `200ms` using only `opacity` and `transform`. Its padded popover shell bridges the visual trigger-to-panel gap and adds a small spatial grace area; a single cancellable `240ms` leave delay prevents accidental dismissal without installing a continuous pointer-tracking loop. Re-entry cancels the pending close. While the disclosure is open, the header retains whichever expanded or compact geometry it had when opening so the trigger never slides away from the pointer. Theme selection updates colors in place and does not dismiss the panel. Reduced-motion users retain the same open/closed visibility and selected colors without the settle transform or transition.

Use `IntersectionObserver` as the reliable baseline for future scroll reveals. Avoid page-wide scroll-timeline effects unless they have a clear readability benefit and a simple fallback.

Scroll motion must not blur text or content. Use opacity and transform for reveal/compress effects, and do not animate `filter` for scrolling sections.

The `enable_scroll_motion` setting gates scroll reveals and section motion. When it is false, those elements render without entrance or compression effects; it does not disable the Home role rotation.

## Glass and blur

Keep backdrop blur subtle. Avoid heavy blur on large full-screen surfaces. Use glass effects on cards, navigation, and small panels where readability remains strong. Do not use blur as a scroll reveal effect.

## Future liquid glass direction

Use layered translucent surfaces, fine borders, soft highlights, and restrained shadows. Avoid novelty effects that make the portfolio feel like a demo instead of a professional site.
