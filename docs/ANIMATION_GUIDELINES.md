# Animation Guidelines

## Principles

Motion should feel premium, restrained, and professional. It should support comprehension rather than distract from the portfolio content.

## Preferred properties

Animate `transform` and `opacity` first. Avoid animating layout properties such as width, height, top, left, margin, and padding.

## Reduced motion

Always respect `prefers-reduced-motion`. Disable or simplify shimmer, entrance motion, and scroll-linked effects for motion-sensitive users.

## Scroll motion

Use `IntersectionObserver` as the reliable baseline for future scroll reveals. Avoid page-wide scroll-timeline effects unless they have a clear readability benefit and a simple fallback.

Scroll motion must not blur text or content. Use opacity and transform for reveal/compress effects, and do not animate `filter` for scrolling sections.

The `enable_scroll_motion` setting gates reveal and section motion. When it is false, content should render statically without entrance or compression effects.

## Glass and blur

Keep backdrop blur subtle. Avoid heavy blur on large full-screen surfaces. Use glass effects on cards, navigation, and small panels where readability remains strong. Do not use blur as a scroll reveal effect.

## Future liquid glass direction

Use layered translucent surfaces, fine borders, soft highlights, and restrained shadows. Avoid novelty effects that make the portfolio feel like a demo instead of a professional site.
