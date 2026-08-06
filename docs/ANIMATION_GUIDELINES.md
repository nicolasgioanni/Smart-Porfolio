# Animation Guidelines

## Principles

Motion should feel premium, restrained, and professional. It should support comprehension rather than distract from the portfolio content.

## Preferred properties

Animate `transform` and `opacity` first. Avoid animating layout properties such as width, height, top, left, margin, and padding.

## Reduced motion

Always respect `prefers-reduced-motion`. Disable or simplify shimmer, entrance motion, and scroll-linked effects for motion-sensitive users.

## Hover Base 1

Hover Base 1 uses a single low-opacity diagonal sheen that travels left-to-right over `1600ms`. It loops only while a control is genuinely hovered and is limited to devices matching both `(hover: hover)` and `(pointer: fine)`; it never runs for touch-only input. Apply `hover-base-1--no-wave` to imagery or other controls where the sheen would obscure meaningful visual content. The surface lift is limited to one pixel, pressing removes the lift immediately, and state colors remain available without motion.

The persistent desktop route indicator moves only after a pathname commits in the preserved layout. Its `420ms` FLIP animation uses the dedicated symmetric `cubic-bezier(0.65, 0, 0.35, 1)` route easing so it departs gently, accelerates through the middle, and settles softly at the destination. It may animate only `transform` and opacity; resizing and first-page hydration snap directly to the final geometry. Interrupted navigation continues from the current visual position. Under `prefers-reduced-motion`, disable the sheen, lift, arrow travel, and route-indicator travel while preserving the hover, focus, and selected surfaces.

## Scroll motion

The header's expanded-to-compact morph is state-driven rather than continuously scroll-linked: scroll input only changes its state after the existing direction and distance thresholds are crossed. All header pieces share the centralized `460ms` restrained ease-out token, which keeps the transition coordinated and only slightly slower than before. Keep its property list explicit, confine metric changes to the small header island, and do not introduce request-animation-frame interpolation or a scroll-progress animation. Reduced-motion users receive the final header state without the transition.

The header theme disclosure fades and settles over `200ms` using only `opacity` and `transform`. Its padded popover shell bridges the visual trigger-to-panel gap and adds a small spatial grace area; a single cancellable `240ms` leave delay prevents accidental dismissal without installing a continuous pointer-tracking loop. Re-entry cancels the pending close. While the disclosure is open, the header retains whichever expanded or compact geometry it had when opening so the trigger never slides away from the pointer. Theme selection updates colors in place and does not dismiss the panel. Reduced-motion users retain the same open/closed visibility and selected colors without the settle transform or transition.

Use `IntersectionObserver` as the reliable baseline for future scroll reveals. Avoid page-wide scroll-timeline effects unless they have a clear readability benefit and a simple fallback.

Scroll motion must not blur text or content. Use opacity and transform for reveal/compress effects, and do not animate `filter` for scrolling sections.

The `enable_scroll_motion` setting gates reveal and section motion. When it is false, content should render statically without entrance or compression effects.

## Glass and blur

Keep backdrop blur subtle. Avoid heavy blur on large full-screen surfaces. Use glass effects on cards, navigation, and small panels where readability remains strong. Do not use blur as a scroll reveal effect.

## Future liquid glass direction

Use layered translucent surfaces, fine borders, soft highlights, and restrained shadows. Avoid novelty effects that make the portfolio feel like a demo instead of a professional site.
