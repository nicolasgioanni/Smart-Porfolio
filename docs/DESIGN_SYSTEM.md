# Design system

Smart Portfolio uses a restrained glass-inspired visual language to organize evidence without reducing readability. Semantic tokens, focused CSS files, and reusable React primitives keep Navy, Light, and Dark behavior aligned.

## Design goals

- Keep professional evidence more prominent than decorative effects.
- Use translucency, fine borders, and controlled highlights to define hierarchy.
- Preserve readable static content when JavaScript, motion, or glass effects are unavailable.
- Provide consistent keyboard focus, selected state, disabled state, and reduced-motion behavior.
- Keep Home concise while making deeper context available on focused routes and in accessible dialogs.

## Sources

| Concern | Primary source |
| --- | --- |
| Semantic tokens and themes | `src/styles/tokens.css` |
| Document and type defaults | `src/styles/base.css` |
| Shell, pages, header, and footer | `src/styles/layout.css` |
| Glass primitives and controls | `src/styles/glass.css` and `src/components/glass/` |
| Navigation and theme disclosure | `src/styles/navigation.css` and navigation components |
| Portfolio pages and cards | `src/styles/portfolio.css` and portfolio components |
| Interaction states | `src/styles/interactions.css` |
| Motion | `src/styles/motion.css` and motion components |
| Loading states | `src/styles/skeletons.css` and loading components |
| Contact experience | `src/styles/contact.css` and contact components |

`src/app/layout.tsx` imports these files in cascade order. Do not introduce a second global entry point that changes their order implicitly.

## Themes

The supported themes are `navy`, `light`, and `dark`.

| Theme | Role |
| --- | --- |
| Navy | Default cool dark presentation with blue-gray emphasis. |
| Light | High-lightness neutral presentation with graphite interactions. |
| Dark | Neutral dark presentation with restrained indigo emphasis. |

The generated `default_theme` setting selects the server-rendered value. `ThemePreferenceScript` applies a valid stored `portfolio-theme` preference before hydration. `ThemeSwitcher` presents Light, Navy, and Dark as a labelled button group and persists selection through `useThemePreference`.

Components must use semantic variables such as `--color-ink`, `--color-muted`, `--color-line`, and `--color-surface`. Do not read a palette-specific variable from a component rule when a semantic token expresses the role.

## Semantic tokens

`tokens.css` defines five main token groups:

- typography, line height, and font weight;
- spacing, container widths, and header offsets;
- radii and glass blur;
- transition timing and easing;
- semantic color, surface, shadow, gradient, and interaction values per theme.

Aliases such as `--color-canvas`, `--color-ink`, `--color-surface`, and `--color-line` let layout and component styles remain theme-independent. New theme values must define the complete semantic set rather than depending on another theme's cascade accidentally.

## Typography

Space Grotesk is loaded through `next/font` with Segoe UI and sans-serif fallbacks. The 16px root remains the conversion basis, while user-facing text follows a compact semantic ladder derived from the CytoCV interface.

| Use | Token | Size |
| --- | --- | --- |
| Eyebrow and step labels | `--font-size-eyebrow` | `0.6875rem` (11px) |
| Captions, validation errors, and utility footer text | `--font-size-caption` | `0.75rem` (12px) |
| Supporting metadata | `--font-size-small` | `0.8125rem` (13px) |
| Primary copy, navigation, and form controls | `--font-size-body` | `0.875rem` (14px) |
| Prominent copy and quotation emphasis | `--font-size-body-large`, `--font-size-quote` | `0.9375rem` (15px) |
| Feature leads | `--font-size-lead` | `1.0625rem` (17px) |
| Card headings | `--font-size-card-title` | `1.25rem` (20px) |
| Section headings | `--font-size-section-title` | `1.375rem` (22px) |
| Resume and compact flow titles | `--font-size-resume-title` | `1.625rem` (26px) |
| Route and form titles | `--font-size-page-title` | 24-26px, responsive |
| Home greeting | `--font-size-hero-title` | Fluid 30-44px |

Use four supported font weights: `--font-weight-regular` at 400, `--font-weight-medium` at 500, `--font-weight-semibold` and `--font-weight-bold` at 600, and `--font-weight-heavy` at 700. Do not introduce fractional intermediate weights.

Body copy uses normal or relaxed line height. Keep paragraph width and spacing readable instead of shrinking type to fit a card. Heading levels express document structure; visual size comes from classes and tokens. Decorative or icon-sized text must not replace a semantic text token for readable content.

## Spacing and radii

The spacing scale runs from `--space-1` at 0.25rem through `--space-16` at 4rem. Prefer these values for gaps, padding, and section rhythm.

Radii express component role:

- `--radius-card` for content cards and inline interaction surfaces;
- `--radius-panel` for section-level surfaces and dialogs;
- `--radius-dock` for header and footer islands;
- `--radius-pill` for chips and pill controls.

Do not create a unique radius or near-duplicate spacing value for one component without a layout reason.

## Layout

`--container-width` is 1180px. The desktop header has separate full and compact widths, while `--header-offset` and `--scroll-margin-top` keep sticky navigation from covering anchored content. Mobile uses `--mobile-dock-clearance` plus safe-area insets to reserve room below route content and anchored targets.

`PageContainer`, `PageIntro`, `SectionHeader`, and `FeaturedGrid` own common route geometry. Home uses full-width top-level rows inside `home-overview-grid`; detail routes use evidence-specific lists and timelines.

The implemented Home order is:

1. Profile overview
2. Experience
3. Education
4. Research
5. Projects
6. Skills
7. Recommendations when enabled
8. Global footer

Do not reorder these sections through CSS. Change `HomeOverview.tsx`, skeleton composition, tests, content mapping, and documentation together.

## Glass primitives

| Primitive | Use |
| --- | --- |
| `GlassSurface` | Page introductions, Home sections, profile shell, dialogs, and large panels. |
| `GlassCard` | Reusable card surface and the base for `PortfolioCard`. |
| `GlassBlob` | Floating header and progressive footer docks. |
| `GlassButton` | Primary and secondary commands or route calls to action. |
| `GlassLink` | Section-level text links. |
| `GlassIconButton` | Labelled icon-only controls. |
| `GlassIconLink` | Social and external destinations. |
| `GlassChip` | Short metadata, skills, roles, and facts. |
| `GlassDivider` | Quiet separation within a surface. |

Glass surfaces use one-pixel borders, bounded backdrop blur, semantic backgrounds, restrained highlights, and theme-owned shadows. When `enable_glass_effects` is false, surfaces use opaque elevated backgrounds and remove backdrop blur without changing structure.

Keep nested Home cards quieter than their outer section. A nested card should not compete with the panel through stronger blur, highlight, or shadow.

## Header and navigation

Above `980px`, the header is a sticky `GlassBlob` that server-renders expanded. Client behavior compacts it after downward scroll beyond the threshold, restores it on upward scroll or pointer proximity, and keeps it expanded while keyboard focus or the theme disclosure requires stable controls.

Desktop navigation uses a persistent animated route indicator plus `aria-current="page"`. At `980px` and below, the glass island becomes a fixed bottom dock. The profile mark and name are hidden, while the left side presents the same route list as a native swipeable rail with scroll snapping, padded ends, hidden scrollbars, and dynamic edge fades. The non-scrolling right side keeps the configured GitHub, LinkedIn, Email, and theme controls visible.

The desktop profile mark opens an image preview only when an image exists. The theme disclosure opens below the desktop trigger and above the mobile dock trigger. The shell reserves safe-area-aware bottom clearance so neither route content nor anchored targets end beneath the dock. Header motion uses centralized duration and easing tokens.

## Profile overview

The Home profile shell is the only hero-scale surface. It includes:

- portrait and identity details;
- one H1 greeting using the preferred name fallback;
- a static or configured rotating role;
- short About copy;
- full-width current work;
- a two-column Education and Research row.

Current work, education, and research are generated from explicit content references with deterministic fallback selection. Organization and institution logos render beside text without an additional decorative frame. A missing mark leaves a text layout rather than inventing a logo.

The compact Research panel uses structured byline and lab fields when present. In legacy summary mode it uses the documented summary fallback. Verified resources are links; unavailable resources remain clearly disabled and non-interactive.

## Portfolio cards

Use `PortfolioCard` variants according to meaning:

| Variant | Purpose |
| --- | --- |
| `summary` | Standard overview card. |
| `detail` | Complete evidence card. |
| `compact` | Dense groups such as skills. |
| `cta` | Focused action panel. |
| `media` | Card with primary media. |
| `timeline` | Experience timeline entry. |

Research and project Home cards use concise copy and bottom-aligned verified actions. Detail cards carry longer summaries, problem and solution context, impact, bullets, stack, and supporting links where the content type provides them.

Home section route actions use compact buttons aligned with the section heading. They remain visually subordinate to primary page actions.

## Skills

Home groups selected skills by `category` and `category_order`. The published content currently produces three cards with four skills each. A skill with the complete proficiency, summary, and evidence set renders as a button that opens the shared dialog. Incomplete legacy detail sets render as static badges.

The shared dialog is modal, traps focus, closes through Escape, backdrop, or button, restores trigger focus, and removes background scrolling. Project cards reuse the same interaction contract for configured project-specific skills.

## Recommendations

Recommendation cards render the full quote with an optional validated inline link and expose `Show more` only when measurement detects overflow. Multi-card Home rows may reduce one preview from four lines to three when header geometry requires a level collapsed row.

The outer Home panel keeps its collapsed border and background. An expanded card may extend below it while an invisible reserve preserves normal document flow for later sections. Home recommendation cards use an opaque theme-matched fill so their color remains stable across the panel boundary.

Quote links remain part of the prose. They become brighter and underlined on hover or focus without adding a background or changing line layout. Expansion controls preserve `aria-expanded`, `aria-controls`, and reduced-motion behavior.

## Footer

The footer is a normal-flow progressive disclosure, not a fixed overlay. Every pathname starts with a fresh compact copyright row. New user downward-scroll intent can expand details when the reserved runway is reached; layout shifts, route restoration, and programmatic scroll changes cannot. The `Details` and `Collapse` button remains the device-independent control.

Expanded details use identity, notices, and resources columns. Automatic collapse is deferred while focus remains inside. Manual collapse suppresses immediate reopening until the interaction region is exited. Route changes reset the disclosure state.

Footer state may animate width, padding, grid-row height, opacity, and small translation. It must not animate blur or scale, block native scrolling, or change total document length when it opens.

## Buttons, links, and chips

- Use buttons for actions and links for navigation.
- Use `SmartLink` when a destination may be internal, external, or email.
- Keep external new-tab destinations on `noopener noreferrer`.
- Give every icon-only control a specific accessible label.
- Use native disabled behavior for unavailable controls.
- Keep chips short and non-interactive unless their component is explicitly a button.

### Hover Base 1

`hover-base-1` is the shared visible interaction treatment. Combine it with the narrowest modifier that describes the control:

- `--inset` keeps the surface within a segmented edge;
- `--compact` uses tighter geometry for utility controls;
- `--inline` uses card-radius text-link geometry;
- `--solid` layers interaction over a primary fill;
- `--no-wave` suppresses only the decorative sheen;
- `--route` supplies the server-rendered active-route fallback.

Use `aria-current`, `aria-pressed`, `aria-expanded`, or native disabled state to express semantics. Decorative pseudo-elements use `pointer-events: none`. The sheen runs only for a fine pointer, and reduced motion disables sheen, lift, arrow travel, and route-indicator travel while preserving state colors.

## Motion

Motion supports state and orientation. Prefer opacity and transform. Recommendation disclosure and footer grid rows are documented exceptions where a bounded layout transition communicates state.

The role rotation, route indicator, header state, mobile rail drift, theme disclosure, recommendation expansion, footer disclosure, scroll reveals, and skeleton shimmer have explicit reduced-motion behavior. See [Animation guidelines](ANIMATION_GUIDELINES.md) for exact timing and constraints.

## Loading states

Route `loading.tsx` files use skeletons shaped like their destination. Skeletons contain no real text or fake controls, remain hidden from the accessibility tree at primitive level, and expose a busy labelled region at page level. They do not justify client-side content fetching.

See [Skeleton loading guidelines](SKELETON_LOADING_GUIDELINES.md).

## Responsive behavior

The style system uses focused thresholds at 980, 860, 720, 620, 520, 480, and 380 CSS pixels.

- Desktop navigation yields to the fixed mobile bottom dock at `980px` and below.
- The mobile route rail owns horizontal overflow without creating document-level overflow, while the action cluster never scrolls away.
- Profile and academic grids collapse as available width narrows.
- Skills and featured grids reduce columns without changing content order.
- Expanded footer columns become one column below 720px.
- Buttons and labelled icon links may become full-width on narrow screens.
- Long links, metadata, and resource labels wrap without horizontal overflow.
- Glass blur is reduced on smaller viewports.

Use an existing threshold when possible and test the layout immediately above and below it.

## Accessibility requirements

- Preserve one H1 per page and logical heading order.
- Keep keyboard access, visible focus, and touch target geometry.
- Pair visual state with native or ARIA state.
- Keep dialogs labelled and modal with focus management.
- Respect reduced motion without hiding content or controls.
- Use meaningful image alt text and empty alt text for truly decorative duplication.
- Keep skeletons and decorative animation out of the accessibility tree.
- Verify all themes at zoom and narrow widths.

See [Accessibility](ACCESSIBILITY.md) for the verified contracts and current limitations. Do not claim formal conformance without a dedicated audit.

## Image strategy

The static export sets Next.js images to unoptimized mode. Components use ordinary image elements with explicit dimensions where practical, eager loading for the primary portrait, and lazy loading for supporting marks.

Every file under `public/` is directly retrievable. Use an approved asset, a safe root-relative path, and useful alt text. Do not use an unverified or unrelated image merely because it exists in the asset tree.

## Adding or changing a component

1. Start with an existing layout, glass, card, link, or loading primitive.
2. Use semantic tokens for color, spacing, radius, shadow, and motion.
3. Confirm structure and accessible state before adding animation.
4. Add fine-pointer hover only after keyboard focus behavior exists.
5. Implement reduced-motion behavior with the interaction.
6. Test Navy, Light, and Dark at desktop, mobile, and 200 percent zoom.
7. Add or update component and CSS-contract tests.
8. Update this guide when the change creates a reusable rule.

For file ownership and cross-cutting changes, see [Project structure](PROJECT_STRUCTURE.md) and [Maintenance](MAINTENANCE.md).
