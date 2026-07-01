# Design System

## Direction

The portfolio uses a restrained glass visual language for navigation, section surfaces, cards, and resume panels. The design should feel polished and evidence-focused: clear hierarchy, compact controls, readable content, and no decorative UI that competes with the work.

## Typography

Type is centralized in `src/styles/tokens.css`.

- `--font-sans` is the Inter stack from `next/font`.
- `--font-display` aliases the same family for consistent rendering.
- Font sizes use rem-based tokens with media-query adjustments.
- Do not scale font size with viewport units.
- Letter spacing is `0`; rely on weight, size, and spacing for hierarchy.

Use `hero-title` only for the Home hero. Use `page-title` for route intros, `section-heading` for section titles, and card title classes inside compact surfaces.

## Color And Themes

Theme tokens live in `src/styles/tokens.css`. Component styles should use semantic tokens, not hard-coded colors.

Supported themes:

- `navy`: default portfolio theme.
- `light`: light neutral theme with teal and warm accents.
- `dark`: neutral dark theme with teal and warm accents.

Theme selection is applied through `data-theme` on the document element. `default_theme` from `site_settings` is resolved to a supported value, with `navy` as the fallback.

## Spacing And Radius

Spacing uses `--space-1` through `--space-16`. Reuse these tokens before adding new spacing.

Cards use a compact radius token. Larger radii are reserved for navigation, footer docks, and larger panel surfaces where the existing glass language requires them.

## Layout Primitives

Use the shared layout components for page and section hierarchy:

- `PageIntro` for route headers.
- `SectionHeader` for section eyebrow, title, description, and optional action link.
- `PageContainer` for detail routes.
- `FeaturedGrid` for project, research, and recommendation grids, including single-item layouts.

Home order should remain: hero, skills, experience, research, projects, recommendations when available, education, resume/contact.

## Portfolio Cards

Use `PortfolioCard` for content cards and resume blocks. Variants are semantic:

- `summary`: normal overview card.
- `detail`: full evidence card.
- `compact`: dense cards such as skill groups.
- `cta`: call-to-action panels.
- `media`: cards with primary media.
- `timeline`: experience timeline entries.

Avoid one-off card spacing when an existing variant can express the layout.

## Glass Surfaces

Use `GlassSurface` for large section surfaces, `GlassCard` through `PortfolioCard` for content cards, and `GlassBlob` for header and footer docks.

Glass rules:

- Keep blur bounded to surfaces.
- Use borders and highlights for shape definition.
- Keep text over quiet backgrounds.
- Reduce blur on mobile through tokens.
- Keep detail pages readable if motion or glass effects are disabled.

## Buttons, Links, And Chips

- `GlassButton` is for clear commands and CTAs.
- `GlassLink` is for section-level text links.
- `GlassIconLink` is for external or social links.
- `GlassChip` is for metadata, skills, roles, and short facts.

External links must keep safe `target` and `rel` attributes.

## Motion

Motion uses opacity and transform only. Do not animate layout properties or blur text. Respect `prefers-reduced-motion` by disabling reveal motion, compress animation, smooth scroll, and skeleton shimmer.

## Responsive Behavior

- Header remains compact and sticky with safe scroll margins.
- Desktop navigation collapses to accessible mobile navigation.
- Home and feature grids collapse cleanly to one column.
- Buttons and labeled icon links become full-width where tap targets need more room.

## Skeletons

Skeletons should match the final layout shapes and contain no real content text. They are loading polish only; static content should still render from generated data.
