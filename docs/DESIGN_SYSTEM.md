# Design System

## Direction

The portfolio uses a refined liquid glass visual language. The goal is premium and readable, not decorative noise. Glass effects are limited to cards, blobs, navigation, and panels.

## Color tokens

Core tokens live in `src/styles/tokens.css`.

- Background: very dark navy through `--color-background`, `--color-navy-950`, and `--color-navy-900`.
- Elevated surfaces: `--color-background-elevated`, `--color-glass-surface`, and `--color-glass-surface-strong`.
- Text: `--color-text-primary`, `--color-text-secondary`, `--color-ink`, `--color-muted`, and `--color-subtle`.
- Accent: restrained light navy/cool blue through `--color-navy-accent-soft`, `--color-accent`, and `--color-accent-strong`.
- Lines and surfaces: `--color-glass-border`, `--color-glass-border-strong`, `--color-line`, and related glass aliases.

The page background should remain one consistent very dark navy. Lighter navy accent glows are allowed only behind the hero, major section transitions, recommendations, or footer, and should stay subtle enough that text remains the dominant visual signal.

## Spacing tokens

Spacing uses `--space-1` through `--space-16`. Components should compose these tokens instead of hard-coded one-off spacing.

## Typography tokens

- Body font: `--font-sans`.
- Display font: `--font-display`.
- Headings use tight letter spacing and strong weight.
- Body content prioritizes readable line height and muted contrast.

## Glass surfaces

Use `GlassSurface` for page sections and panels. Use `GlassCard` for content cards. Use `GlassBlob` for navigation and footer islands.

Glass rules:

- Keep blur bounded.
- Use borders and highlights for shape definition.
- Do not put low-contrast text over busy backgrounds.
- Reduce blur on mobile through CSS tokens.
- Do not make every card blue; color should come from the shared surface and text tokens.

## Blob components

`BlobHeader` and `BlobFooter` use floating glass islands instead of full-width bars. They should remain compact and readable on mobile.

## Buttons, links, and chips

- `GlassButton` is for primary and secondary calls to action.
- `GlassLink` is for inline section links.
- `GlassIconLink` is for social or external link groups.
- `GlassChip` is for skills, types, roles, and compact metadata.

## Cards and timeline styles

- `ResearchCard` highlights role, organization, summary, impact, skills, and links.
- `ProjectCard` separates summary from problem, solution, impact, and stack.
- `ExperienceTimeline` uses a vertical line and item markers for professional chronology.
- `ResumeSection` and `ResumePanel` provide structured resume blocks.

## Skeleton styles

Skeletons use the same glass surfaces, radius tokens, and grid shapes as final content. They contain no real content text and use subtle shimmer only when reduced motion is not requested.

## Motion rules

Motion is powered by IntersectionObserver plus CSS classes when `enable_scroll_motion=true`. It animates opacity and transform only. Scroll motion must not blur text or content. Layout properties are not animated.

## Responsive behavior

- Header collapses to accessible mobile navigation below desktop width.
- Home grid collapses to a single column on smaller screens.
- Glass blur is reduced on mobile.
- Buttons and link groups become full-width where that improves tap targets.

## Reduced motion behavior

`prefers-reduced-motion: reduce` disables reveal motion, compress animation, smooth scroll, and skeleton shimmer.
