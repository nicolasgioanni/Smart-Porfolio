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

The default Home experience should read as very dark navy. Page backgrounds should be token-driven gradients, not full-page abstract wallpaper images. Atmospheric accents should stay subtle and belong behind the hero or major section transitions.

Supported themes:

- `navy`: default portfolio theme.
- `light`: light neutral theme with teal and warm accents.
- `dark`: neutral dark theme with teal and warm accents.

Theme selection is applied through `data-theme` on the document element. `default_theme` from `site_settings` is resolved to a supported value, with `navy` as the fallback.

The visible theme control lives in the header after the social links and remains available beside the mobile menu when desktop links collapse. Its icon is an accessible disclosure controlling a theme-aware glass panel ordered `Light`, `Navy`, then `Dark`. The panel is a labelled group of pressed-state buttons rather than an ARIA menu: native Tab navigation remains available, Escape dismisses and returns focus, pointer hover has a forgiving corridor, and selecting a theme keeps the panel open. The footer intentionally has no duplicate theme controls.

## Spacing And Radius

Spacing uses `--space-1` through `--space-16`. Reuse these tokens before adding new spacing.

Cards use a compact radius token. Larger radii are reserved for navigation, footer docks, and larger panel surfaces where the existing glass language requires them.

## Layout Primitives

Use the shared layout components for page and section hierarchy:

- `PageIntro` for route headers.
- `SectionHeader` for section eyebrow, title, description, and optional action link.
- `PageContainer` for detail routes.
- `FeaturedGrid` for project, research, and recommendation grids, including single-item layouts.

The Home header island should align to the page max-width and remain visually connected to the content grid. The Home profile overview uses one coordinated glass shell with an unchanged photo-and-identity rail and a recruiter-focused detail column. That column is ordered Headline, About, full-width Current Work, a paired Education and Selected Research row, then supporting links to the complete Experience and Research routes.

Headline and About remain open typography inside the outer surface. Current Work, Education, and Selected Research may use quiet internal panels with modest padding, a smaller radius than the shell, a restrained border, and slight tokenized surface contrast. Do not add timeline dots, vertical rails, repeated horizontal dividers, independent glass blur, strong shadows, or animated effects inside these panels.

On desktop, Current Work spans the detail column. Education and Selected Research share the following grid row at approximately 40/60 using `minmax(230px, 0.8fr) minmax(0, 1.2fr)` or an equivalent responsive proportion. Education communicates foundation; Selected Research communicates applied proof. Their content stays independently semantic and top-aligned without forcing visually wasteful equal heights. Supporting route links are text-style actions subordinate to the summaries.

Keep one strong `h1` for the profile name. The right-side headline is not another heading at the same level; About and panel labels use a logical subordinate heading structure. Generated organization, role, date, summary, education, research, URL, and logo values remain outside component code. Real marks are selected through existing CSV logo paths, and a missing mark leaves a clean text layout rather than producing a fake logo or initials badge. Selected Research shows only valid available links and never represents a missing URL with a disabled-looking action.

Home order should remain: profile overview, skills, experience, education, research, projects, then the global footer. Each top-level Home section occupies its own full-width row.

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
- Keep nested Home cards visually quiet. The outer section surface should provide the main structure; inner content cards should avoid competing shadows and heavy highlights.

## Buttons, Links, And Chips

- `GlassButton` is for clear commands and CTAs.
- `GlassLink` is for section-level text links.
- `GlassIconLink` is for external or social links.
- `GlassChip` is for metadata, skills, roles, and short facts.

External links must keep safe `target` and `rel` attributes.

### Hover Base 1

`hover-base-1` is the shared interaction treatment for every visible semantic link and button. Add the base class alongside the component class, then select the narrowest modifier that describes the control:

- `hover-base-1--inset` keeps the decorative surface inside a navigation or segmented-control edge.
- `hover-base-1--compact` uses the tighter shadow and inset intended for small icon and utility controls.
- `hover-base-1--inline` uses the card radius for inline text links.
- `hover-base-1--solid` layers a partially translucent interaction surface over an existing primary fill instead of replacing it.
- `hover-base-1--no-wave` suppresses only the moving sheen for controls whose visual content should remain unobscured; all other Hover Base 1 states remain intact.
- `hover-base-1--route` provides the server-rendered active-route fallback used by navigation.

Idle controls retain their component-owned background. Hover and keyboard focus use the theme's stronger surface, selected states use its quieter translucent companion, and selected controls temporarily return to the stronger treatment while hovered. Navy and Dark use their blue/indigo families; Light uses a neutral graphite family that matches its grayscale visual language. Selection is semantic: use `aria-current="page"` for routes, `aria-pressed="true"` for toggles, `aria-expanded="true"` for disclosure buttons, or `data-selected="true"` only when no native ARIA state expresses the UI state.

The `::before` surface and `::after` sheen are decorative, have `pointer-events: none`, and do not contribute to layout. The sheen loops only while a fine pointer remains hovered; use `hover-base-1--no-wave` when the sheen would cross important imagery, as it does on the header profile photo. Place a GlassLink arrow in an `aria-hidden="true"` child with class `glass-link__arrow`; Hover Base 1 owns the pseudo-elements. Disabled controls must use the native `disabled` attribute or `aria-disabled="true"` so lift, elevated shadow, and sheen are suppressed.

## Motion

Motion uses opacity and transform only. Do not animate layout properties or blur text. Respect `prefers-reduced-motion` by disabling reveal motion, compress animation, smooth scroll, and skeleton shimmer.

## Responsive Behavior

- Header remains compact and sticky with safe scroll margins.
- Desktop navigation collapses to accessible mobile navigation.
- Home and feature grids collapse cleanly to one column.
- The profile academic grid collapses before either panel becomes cramped; Selected Research appears before Education on narrow screens even though Education is first on desktop.
- Profile resource and supporting-link rows wrap without horizontal overflow, retain usable touch targets, and preserve bottom safe-area clearance.
- Buttons and labeled icon links become full-width where tap targets need more room.

## Skeletons

Skeletons should match the final layout shapes and contain no real content text. They are loading polish only; static content should still render from generated data.
