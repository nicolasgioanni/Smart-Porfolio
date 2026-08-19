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
- `SectionHeader` for section eyebrow, title, description, and an optional action link or compact button.
- `PageContainer` for detail routes.
- `FeaturedGrid` for project, research, and recommendation grids, including single-item layouts.

The Home header island should align to the page max-width and remain visually connected to the content grid. The Home profile overview uses one coordinated glass shell with a photo-and-identity rail and a recruiter-focused detail column. Center the photo-and-identity rail vertically against the taller detail column on desktop. That column is ordered greeting H1, animated role, About, full-width Current Work, then a paired Education and Research row.

The greeting and About remain open typography inside the outer surface. On desktop, use approximately 42–52px for the greeting and 28–34px for the role. Keep the greeting-to-role gap near 8px, role-to-About near 28px, About-to-Current Work near 32px, and Current Work-to-paired-cards near 28px. The role stays on one line and reserves space for its widest configured value.

Current Work, Education, and Research may use quiet internal panels with identical padding and header alignment, a smaller shared radius than the shell, a restrained border, and slight tokenized surface contrast. Current Work and Research place their route actions in overlaid header slots so the controls retain generous hit areas without increasing header height or creating extra apparent top padding. Do not add timeline dots, vertical rails, repeated horizontal dividers, independent glass blur, strong shadows, or animated panel effects.

On desktop, Current Work spans the detail column. Education and Research use `repeat(2, minmax(0, 1fr))` with stretched items, equal outer heights, and column-flex interiors. Apply `height: 100%` only to panels inside this paired grid so Current Work retains its intrinsic height and cannot overlap the row below. Pin Education's graduation label and Research's resource controls to matching bottom footer rows without adding filler content. `View experience` belongs at the top right of Current Work and `View research` at the top right of Research. Do not add an Education route action or a detached supporting-navigation row.

Keep `Hi, I’m {greetingName}` with no trailing period as the single Home `h1`; the full name in the portrait rail is non-heading text. About and panel labels use a logical subordinate heading structure, and the compact panel label is `Research`, not `Selected Research`. The compact Education facts read `Degree: Bachelor of Science in Computer Science` and `Concentration: Information Assurance & Cybersecurity`; the larger Home Education card uses the same degree wording. Generated organization, role, date, summary, education, research, URL, and logo values remain outside component code. Real marks are selected through existing CSV logo paths, and a missing mark leaves a clean text layout rather than producing a fake logo or initials badge. Compact Research uses the spreadsheet organization mark beside its title and, when configured, an Education-style Position, Contributions, and Labs definition list. Research rows without structured profile facts retain the legacy summary layout. Verified resources are links, while a spreadsheet pending resource may appear in this profile panel only as a clearly disabled unpublished control; standalone Home Research cards omit it.

Home order should remain: profile overview, experience, education, research, projects, six Skills category cards, recommendations, then the global footer. Each top-level Home section occupies its own full-width row. Projects and Research share a quiet three-card desktop rhythm; Skills uses two equal columns and three rows. Experience, Research, Projects, and Recommendations use consistently sized compact `View` buttons aligned to the top-right of their section headers. Enabled recommendation surfaces use an honest empty state when no rows are available.

Recommendation cards in each multi-card Home row share a measured collapsed minimum height, with a taller header receiving at most a one-line quote-preview reduction. The minimum height keeps collapsed borders and actions level without stretching siblings when one quote opens; only the selected card grows while the surrounding section pushes the footer normally. Single-card Home rows and detail cards retain four-line previews. Separate recommender metadata from the quote with a one-pixel inset divider. Use the standard body size for recommendation, Project, and Research explanatory copy, and keep LinkedIn/source actions at the same compact 36px geometry as Project and Research resource actions.

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

The footer dock is a normal-flow progressive disclosure. Its compact state uses the header's compact width and a single copyright/control row; a fixed-size trigger aligned with that row opens the dock when roughly 50% visible and closes it during upward retreat at roughly 15% visibility. This threshold hysteresis and stable trigger keep the changing footer height from causing flicker. The expanded state grows to the content width, adds a three-column identity/notices/resources layout, and becomes one column below 720px. State motion is limited to width, padding, grid-row height, opacity, and a slight vertical translation over roughly 420 ms. Never scale or animate blur on this transition. Under reduced motion, the disclosure changes immediately. Long resource URLs must wrap inside their column without horizontal overflow.

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

Home section route actions use compact `GlassButton` controls. Keep them top-aligned with their headings and visually smaller than primary page CTAs.

Home project cards mirror the quiet Research-card geometry: title, plain subtitle, product-focused summary, three compact icon skill badges, then bottom-aligned source/demo actions. Skill category cards form two equal columns and three rows on desktop, with six icon-and-label badges per card. Recommendation cards use plain identity metadata and a transparent idle expansion control that reveals its subtle button surface on hover or keyboard focus.

Inside the profile overview, use compact `SmartLink` actions for Current Work and Research headers. Their overlaid action slots preserve consistent heading geometry. They appear as unadorned text while idle, then reveal the shared subtle control surface, border, and focus treatment over their full hit area on hover or keyboard focus. They do not use a persistent underline. Verified Research resource links remain plain text with a brighter or underlined hover/focus state; pending resources use the same quiet footprint but remain visibly disabled, non-interactive, and free of hover motion. Resource controls do not use arrows, pills, glass-button styling, blur, or scale effects. Organization marks inside these panels render without an added frame, fill, or padding around the source logo.

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

Motion uses opacity and transform for decorative movement. The recommendation disclosure is the narrow exception: it animates its clipped `max-height` for an understandable open/close state and pairs that change with a subtle opacity fade. While collapsed overflow exists, a static alpha mask fades only the lower half of the final visible line to transparency; do not substitute blur or a card-colored overlay. Respect `prefers-reduced-motion` by disabling reveal motion, recommendation expansion transitions, compress animation, smooth scroll, and skeleton shimmer.

## Responsive Behavior

- Header remains compact and sticky with safe scroll margins.
- Desktop navigation collapses to accessible mobile navigation.
- Home and feature grids collapse cleanly to one column.
- The profile academic grid collapses below 720px; Education remains before Research in the stacked order.
- Profile resource links wrap without horizontal overflow, retain usable touch targets, and preserve bottom safe-area clearance.
- Buttons and labeled icon links become full-width where tap targets need more room.

## Skeletons

Skeletons should match the final layout shapes and contain no real content text. They are loading polish only; static content should still render from generated data.
