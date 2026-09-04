# Accessibility

Smart Portfolio uses semantic HTML, keyboard-operable controls, visible focus treatment, reduced-motion handling, and explicit interaction state. These are implementation requirements and verified practices, not a claim of formal Web Content Accessibility Guidelines conformance.

## Scope and authority

Accessibility behavior is implemented across route components, shared layout and navigation, interactive portfolio components, the contact form, and CSS. Component tests verify many contracts, but automated tests do not replace keyboard, screen-reader, zoom, contrast, and responsive review.

Primary sources are `src/app/`, `src/components/`, and the focused style sheets under `src/styles/`.

## Page structure

- The shared shell renders one `<main>` landmark between the site header and footer.
- Home uses the profile greeting as its single H1.
- Detail and contact routes use `PageIntro` to render their single H1.
- Legal routes use `LegalDocument` for their H1 and effective-date structure.
- Major Home regions and detail cards use descriptive headings and labelled sections.
- Footer link groups are navigation landmarks with distinct labels.

When adding a route, preserve one descriptive H1 and do not choose heading levels for visual size. Use `PageContainer`, `PageIntro`, and `SectionHeader` when their structure fits.

## Navigation

Desktop and mobile navigation are separate presentations of the same generated item list.

- Both navigation landmarks have accessible labels.
- The active route uses `aria-current="page"`.
- The animated desktop indicator is decorative.
- The mobile bottom dock exposes every route as a direct link with no disclosure or duplicated accessible copy.
- The route rail uses native horizontal scrolling, so touch, pointer, wheel, and keyboard users can reach hidden links in canonical order.
- Edge fades are visual overflow cues and do not change link names, order, focusability, or semantics.
- GitHub, LinkedIn, Email, and theme controls remain outside the scrolling rail so they stay available at every rail position.
- External HTTP destinations that open a new tab use `noopener noreferrer`.

The Contact, Privacy, Terms, and Security routes are intentionally available from the footer rather than primary navigation.

## Theme control

The theme disclosure is a labelled button with `aria-expanded` and `aria-controls`. Navy, Light, and Dark choices form a labelled group and expose selection with `aria-pressed`.

Keyboard focus opens the disclosure. Escape closes it and restores focus to the trigger. Closed options use `tabIndex=-1`. The stored `portfolio-theme` preference is applied before hydration when possible.

Theme changes must preserve readable text, visible focus, borders, disabled states, selection, and status colors. Formal contrast conformance is not asserted by an automated audit, so contrast remains a manual verification requirement.

## Focus treatment

Interactive controls use shared focus-visible styles and semantic tokens. Do not remove outlines without providing an equally visible replacement. Hover-only behavior must have a keyboard equivalent, and selected state must not rely on color alone when an ARIA state is available.

The desktop header expands when focus enters it so compact visual behavior does not hide keyboard controls. Focusing or otherwise interacting with the mobile rail pauses its automatic motion. Five seconds without another rail interaction resumes drift from the current position, while an open theme menu keeps the rail paused until it closes. The footer defers automatic collapse while focus remains inside expanded details, except that a route transition replaces the old disclosure with a fresh compact instance.

## Dialogs and disclosures

### Skills dialogs

Interactive portfolio and project skills use a shared dialog implementation that:

- exposes `role="dialog"`, `aria-modal`, a labelled title, and descriptive text;
- moves focus to the close control after opening;
- traps Tab and Shift+Tab within the dialog;
- closes on Escape, backdrop activation, or the close button;
- restores focus to the originating skill control;
- prevents background scrolling while open;
- removes its fade delay when reduced motion is requested.

Skills without the complete explanatory field set render as non-interactive badges.

### Profile image preview

The header profile image opens a labelled modal preview with a close button, Escape handling, and backdrop dismissal. The current preview does not implement the same focus trap and trigger-focus restoration used by skill dialogs. Treat that as a known manual-review limitation.

### Experience chapters

The Experience heading, summary, and detail controls share one page-introduction surface. The descriptive H1 and summary remain available when there are no published roles, while the detail controls are omitted because there is no content to switch.

The visible `Detail level:` text and its visually hidden `Experience` prefix label the page-level `For everyone` and `Technical` group through `aria-labelledby`. Each button exposes the selected depth with `aria-pressed`. A concise visually hidden polite live region announces depth changes without adding explanatory copy to the layout or repeating every role.

Each expandable evidence chapter is a native button with `aria-expanded` and `aria-controls`; its panel is a labelled region and is `aria-hidden` while collapsed. Only one chapter per role remains open. Escape closes the focused chapter without moving focus. Organization logos are decorative because the adjacent organization name supplies the same identity in text.

### Recommendations

Each available provenance link opens the recommendation source, and the separate `View profile` and `View recommendation` actions expose recommender-specific accessible names. The shield-check and any LinkedIn icons that accompany visible labels are decorative. External links opened in a new tab retain `noopener noreferrer`; provenance hover and focus emphasize only the visible verification text without making the icon the sole cue.

Long recommendations expose a native button with `aria-expanded`, `aria-controls`, and a recommender-specific label. The quote stays in one blockquote and is not duplicated into a live region. The detail route permits only one expanded card at a time; Escape collapses it and returns focus to its toggle, and moving focus into another card collapses the open overlay. Above `980px`, only cards physically covered by the opaque expanded card are visually dimmed, without hiding them from the accessibility tree. At `980px` and below, cards expand in natural flow with no dimming. Reduced-motion mode changes expansion and overlap state without height or opacity transitions.

### Footer disclosure

The footer's `Details` and `Collapse` button exposes `aria-expanded` and `aria-controls`. Collapsed detail content is `aria-hidden` and inert. Every route begins with a fresh compact disclosure; layout settling and restored or programmatic scrolling cannot open it. Downward wheel, touch, pointer-scroll, or scroll-key intent can activate automatic expansion when the runway is reached. The explicit button remains available for device-independent control, and focused details are not hidden by automatic collapse within the same route.

## Motion and reduced motion

Motion is supplementary. Content remains present when motion is disabled.

The `prefers-reduced-motion: reduce` rules and shared preference hook disable or simplify scroll reveals, Home role rotation, route-indicator travel, mobile rail return and drift, Hover Base sheen and lift, recommendation transitions, dialog fades, header and footer transitions, skeleton shimmer, and smooth scrolling. Manual mobile rail scrolling remains available.

The `enable_scroll_motion` content setting controls decorative scroll reveals. It does not replace the operating-system preference.

## Images and icons

- The Home portrait uses the portfolio owner's name as alt text.
- The portrait fallback has an accessible label and visible initials.
- Decorative affiliation marks use empty alt text when adjacent text already identifies the organization.
- Content cards use configured logo alt text or derive it from the organization or institution name.
- Icons accompanying visible labels are decorative. Icon-only controls require a specific accessible label.
- Images use explicit dimensions where their component has a known display size.

Do not publish filename-only alt text. If an image conveys no information beyond adjacent text, use empty alt text rather than repeating the label.

## Loading states

Skeleton primitives are `aria-hidden`. Page skeletons expose a labelled region with `aria-busy="true"`; they do not contain fake content or interactive controls. Shimmer stops under reduced motion. Skeletons are route-transition polish and never replace available static content.

See [Skeleton loading guidelines](SKELETON_LOADING_GUIDELINES.md) for the complete contract.

## Contact form

The Contact route keeps a direct email alternative available when the Turnstile widget or delivery endpoint is unavailable.

The three-step form provides visible labels, required-state cues, `aria-invalid`, error descriptions, focus movement between steps, polite status updates, alert semantics, native acknowledgement checkboxes, and a final Send button disabled until the widget is prepared and acknowledgements are complete. Verification, interactive fallback, expiry, retry, and delivery states remain announced while repeated Send actions are blocked. The interaction-only widget may remain visually hidden when no challenge is required. Successful delivery replaces the wizard with a standalone completion view and a clearly named <em>Send another message</em> action. The hidden honeypot is removed from the tab order.

Server validation remains authoritative. Accessible client feedback does not weaken origin, schema, timing, ticket, or delivery checks.

## Responsive and zoom behavior

Navigation, grids, profile panels, controls, and footer columns collapse at established breakpoints. At `980px` and below, the navigation dock stays fixed above the device safe area and the shell reserves matching bottom clearance. Long links and labels may wrap. Primary glass buttons have a 44 CSS pixel minimum height, and narrower layouts expand controls where needed.

Verify meaningful UI changes at 200 percent zoom, at the 980 and 720 pixel layout transitions, and at a narrow mobile width. Check for clipped text, horizontal scrolling, obscured focus, dialog overflow, and controls that depend on hover.

## Verification checklist

1. Confirm the route has one H1 and logical heading order.
2. Navigate every control with Tab and Shift+Tab.
3. Confirm focus is visible in Navy, Light, and Dark.
4. Operate menus, dialogs, and disclosures with the keyboard.
5. Verify active, expanded, pressed, invalid, busy, and live-region state where applicable.
6. Repeat the interaction with reduced motion enabled.
7. Inspect desktop, mobile, and 200 percent zoom layouts.
8. Check image alt text and decorative-image handling.
9. Run focused component tests, both `npm run test:e2e:navigation` and `npm run test:e2e:footer`, and `npm run verify`.

Related guidance is in the [Design system](DESIGN_SYSTEM.md), [Animation guidelines](ANIMATION_GUIDELINES.md), [Quality checklist](QUALITY_CHECKLIST.md), and [Testing](TESTING.md).
