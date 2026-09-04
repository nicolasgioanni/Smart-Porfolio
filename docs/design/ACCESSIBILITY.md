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
- Native hard clipping marks horizontal overflow without changing link names, order, focusability, or semantics.
- GitHub, LinkedIn, Email, and theme controls remain outside the scrolling rail so they stay available at every rail position.
- External HTTP destinations that open a new tab use `noopener noreferrer`.

The Contact, Privacy, Terms, and Security routes are intentionally available from the footer rather than primary navigation.

## Theme control

The theme disclosure is a labelled button with `aria-expanded` and `aria-controls`. System, Light, My mode, and Dark preferences form a labelled group and expose selection with `aria-pressed`. System is a behavior rather than a fourth palette: it announces the effective Light or Dark result from the device preference, while the corresponding manual palette button remains unpressed. My mode retains the internal `navy` value so existing saved choices continue to work.

Keyboard focus opens the disclosure. Escape closes it and restores focus to the trigger. Closed options use `tabIndex=-1`. Before hydration, a valid `portfolio-theme` override is applied first; without one, the device color preference selects Light or Dark. System changes continue to update the page until the visitor chooses a manual override.

Theme changes must preserve readable text, visible focus, borders, disabled states, selection, and status colors. Formal contrast conformance is not asserted by an automated audit, so contrast remains a manual verification requirement.

## Focus treatment

Interactive controls use shared focus-visible styles and semantic tokens. Do not remove outlines without providing an equally visible replacement. Hover-only behavior must have a keyboard equivalent, and selected state must not rely on color alone when an ARIA state is available.

The desktop header expands when focus enters it so compact visual behavior does not hide keyboard controls. Focusing or otherwise interacting with the mobile rail pauses its automatic motion. Five seconds without another rail interaction resumes drift from the current position, while an open theme menu keeps the rail paused until it closes. The footer defers automatic collapse while focus remains inside expanded details, except that a route transition replaces the old disclosure with a fresh compact instance.

## Dialogs and disclosures

### Shared dialogs

Profile previews, interactive portfolio skills, project skills, and other modal media use the shared `ModalDialog` implementation. It:

- exposes `role="dialog"`, `aria-modal`, and an accessible name, with an optional description;
- moves focus to the close control after opening;
- traps Tab and Shift+Tab within the dialog;
- closes on Escape, backdrop activation, or the close button;
- restores focus to the originating trigger;
- prevents background scrolling while open;
- removes its fade delay when reduced motion is requested.

Each consumer supplies its own accessible name, optional description, initial-focus control, and trigger reference. The shared layer owns portal rendering, focus containment through the complete exit transition, Escape and backdrop dismissal, exact background-scroll restoration, reduced-motion timing, and trigger-focus restoration. When dialogs overlap, only the topmost dialog remains exposed and interactive until it exits. Skills without the complete explanatory field set render as non-interactive badges.

### Profile image preview

The header profile image opens a labelled modal preview through the shared dialog layer. Its close button receives initial focus, keyboard focus remains inside the preview, and dismissal restores focus to the profile-image trigger.

### Research and Experience details

The Research and Experience headings, summaries, and detail controls each share one page-introduction surface. The descriptive H1 and summary remain available when a collection is empty, while its detail control is omitted because there is no content to switch.

The visible `Detail` text sits beside an `Overview` and `Technical` button group with a context-specific accessible name. Each button exposes the selected depth with `aria-pressed` and keeps a minimum 44 by 44 CSS-pixel target for every pointer capability. A concise visually hidden polite live region announces depth changes without adding explanatory copy to the layout or repeating every project or role.

Each expandable evidence row is a native button with `aria-expanded` and `aria-controls`; its panel is a labelled region and is `aria-hidden` while collapsed. Research keeps one row open per project, and Experience keeps one row open per role. Escape closes the focused row without moving focus. Each graphical-abstract thumbnail is a labelled native button; its decorative thumbnail avoids a duplicate announcement, while the enlarged dialog image carries the specific scientific alternative text. The dialog opens on a visible close control and supports Escape, backdrop dismissal, focus containment, and trigger-focus restoration. Unknown projects without media keep a concise labelled fallback diagram. Research route organization marks use the authored logo alt because the simplified card header does not repeat the organization as text. An unpublished resource is a native disabled button named `&lt;label&gt; — not yet published`, never a link or a faux disabled element; its visible label stays exactly as authored.

### Research video

CytoCV's self-hosted supplementary video uses native controls with no autoplay, metadata-only preload, inline playback support, and an enabled synchronized English captions track. The player offers a readable time-coded narration transcript with timestamped visual descriptions and an MP4 download fallback outside the native control surface. Playback loading, failure, and completion are politely announced without hiding either fallback; inline and modal status messages remain independent. Its enlarged view reuses `ModalDialog`, keeps native captions, fullscreen, and picture-in-picture available, and pauses while handing its current timeline between the inline and enlarged views. Neither view is programmatically played. Review captions and visual descriptions against the source whenever the asset changes; see [Research media](../content/RESEARCH_MEDIA.md) for the current integrity and publication record.

### Recommendations

Each available provenance link opens the recommendation source, and the separate `View profile` and `View recommendation` actions expose recommender-specific accessible names. The shield-check and any LinkedIn icons that accompany visible labels are decorative. External links opened in a new tab retain `noopener noreferrer`; provenance hover and focus emphasize only the visible verification text without making the icon the sole cue.

Long recommendations expose a native button with `aria-expanded`, `aria-controls`, and a recommender-specific label. The quote stays in one blockquote and is not duplicated into a live region. At `720px` and below, only the first sentence appears while collapsed; the remainder and its links are hidden until expansion. Single-sentence quotes remain fully visible without a toggle. The detail route permits only one expanded card at a time; Escape collapses it and returns focus to its toggle, while pointer interaction outside the active card dismisses it after the clicked control activates. Above `980px`, focus entering another card also dismisses the open overlay, and only cards physically covered by it are visually dimmed without being hidden from the accessibility tree. At `980px` and below, cards expand in natural flow with no dimming; pointer focus does not collapse the current card before a newly targeted control receives its click. Reduced-motion mode changes expansion and overlap state without height or opacity transitions.

### Footer disclosure

The footer's `Details` and `Collapse` button exposes `aria-expanded` and `aria-controls`. Collapsed detail content is `aria-hidden` and inert. Every route begins with a fresh compact disclosure; layout settling and restored or programmatic scrolling cannot open it. Downward wheel, touch, pointer-scroll, or scroll-key intent can activate automatic expansion when the runway is reached. The explicit button remains available for device-independent control, and focused details are not hidden by automatic collapse within the same route.

## Motion and reduced motion

Motion is supplementary. Content remains present when motion is disabled.

The `prefers-reduced-motion: reduce` rules and shared preference hook disable or simplify page entrance motion, scroll reveals, Home role rotation, route-indicator travel, mobile rail return and drift, Hover Base lift, recommendation transitions, dialog fades, header and footer transitions, and smooth scrolling. Skeletons are already static. Hydrated palette changes bypass the optional View Transition fade and apply immediately. Manual mobile rail scrolling remains available.

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

Skeleton primitives are `aria-hidden`. Page skeletons expose one labelled region with `aria-busy="true"`; body placeholders do not contain fake prose or interactive controls. `RouteHeaderSkeleton` places the exact canonical header strings inside an `aria-hidden` ancestor only to let the browser derive responsive line geometry. That ink is transparent, non-selectable, and noninteractive, so it does not add headings, readable copy, focus targets, or announcements to the accessibility tree. Static solid placeholders reserve geometry without decorative animation. Skeletons are route-transition polish and never replace available static content.

See [Skeleton loading guidelines](SKELETON_LOADING_GUIDELINES.md) for the complete contract.

## Contact form

The Contact route keeps a direct email alternative available when the Turnstile widget or delivery endpoint is unavailable.

The route begins with a visible, labelled Turnstile gate. Contact fields are not rendered until server verification succeeds. Gate loading, success, expiry, retry, and failure states are announced. Retry actions restore focus to the persistent gate heading or status instead of leaving focus on a removed control. Success enables Continue and opens the form automatically after a brief 500-millisecond transition unless the visitor continues sooner; focus then moves into the form.

The three data-entry steps provide visible labels, required-state cues, `aria-invalid`, error descriptions, focus movement, polite status updates, alert semantics, two native acknowledgement checkboxes, and a final Send button disabled until both acknowledgements are complete. Narrow layouts keep visual button order aligned with DOM and keyboard order. Delivery states remain announced while repeated Send actions are blocked. Successful delivery replaces the wizard with a standalone completion view and a clearly named <em>Send another message</em> action that starts a fresh gate. An expired two-hour draft exposes an explicit fresh-request action that preserves the reviewed values but requires a new UUID, Turnstile check, and start time. The hidden honeypot is removed from the tab order.

Server validation remains authoritative. Accessible client feedback does not weaken origin, schema, timing, ticket, or delivery checks.

## Responsive and zoom behavior

Navigation, grids, profile panels, controls, and footer columns collapse at established breakpoints. At `980px` and below, the navigation dock stays fixed above the device safe area and the shell reserves matching bottom clearance. Long links and labels may wrap. Primary glass buttons have a 44 CSS pixel minimum height, and narrower layouts expand controls where needed.

Verify meaningful UI changes at 200 percent zoom, at the 980 and 720 pixel layout transitions, and at a narrow mobile width. Check for clipped text, horizontal scrolling, obscured focus, dialog overflow, and controls that depend on hover.

## Verification checklist

1. Confirm the route has one H1 and logical heading order.
2. Navigate every control with Tab and Shift+Tab.
3. Confirm System announces its active Light or Dark result, then verify the dual-layer focus treatment in all three palettes.
4. Operate menus, dialogs, and disclosures with the keyboard.
5. Verify active, expanded, pressed, invalid, busy, and live-region state where applicable.
6. Repeat the interaction with reduced motion enabled.
7. Inspect desktop, mobile, and 200 percent zoom layouts.
8. Check image alt text and decorative-image handling.
9. Run focused component tests, the relevant `test:e2e:*` browser suites, and `npm run verify`.

Related guidance is in the [Design system](DESIGN_SYSTEM.md), [Animation guidelines](ANIMATION_GUIDELINES.md), [Quality checklist](../quality/QUALITY_CHECKLIST.md), and [Testing](../quality/TESTING.md).
