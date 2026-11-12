import { testIdentity } from "./receipts.mjs";

// Existing live-workbook tests allow specific optional content to be absent.
// This explicit registry preserves those contracts without treating arbitrary
// skips as success. New reasons/identities require review; failures and serial
// interruption never qualify. Every accepted skip remains visible in receipts.
const entries = [
  ["navigation", [], "uses semantic Education summary hover and focus states in every palette", ["Education interaction coverage requires a generated item with details."]],
  ["navigation", [], "progresses and reverses Education disclosure animation without clipping its final state", ["Education motion coverage requires a generated item with details."]],
  ["navigation", [], "expands Education details immediately when reduced motion is requested", ["Education reduced-motion coverage requires a generated item with details."]],
  ["experience", ["Experience showcase"], "defers large-viewport touch focus dismissal until the outside button activates", ["Touch ordering needs two expandable Experience cards."]],
  ["experience", ["Experience showcase"], "keeps desktop evidence overlays out of route flow through real keyboard and pointer interactions", [
    "Overlay regression requires an expandable Experience card.", "Overlay spill regression requires a following Experience card."
  ]],
  ["experience", ["Experience showcase"], "keeps expanded cards at rest after focus and scrolling in every palette", ["Focus elevation regression requires an expandable Experience card."]],
  ["research", ["Research showcase"], "keeps alternating project rows and accessible technical disclosures", ["Legacy research content can legitimately omit expandable detail disclosures."]],
  ["research", ["Research showcase"], "keeps research evidence overlays out of flow through real keyboard and pointer interactions", [
    "Overlay regression requires an expandable Research project.", "Overlay regression requires a rendered Research disclosure with a visible overlap target."
  ]],
  ["research", ["Research showcase"], "keeps expanded projects at rest after focus and scrolling in every palette", ["Legacy research content can legitimately omit expandable detail disclosures."]],
  ["recommendations", ["recommendation cards"], "keeps desktop rows fixed and dims exactly the cards covered by the active overlay", ["Desktop overlay regression requires an expandable card with a later row"]],
  ["recommendations", ["recommendation cards"], "uses natural flow without dimming or horizontal overflow at responsive widths", [
    "Responsive disclosure regression requires recommendation content", "Responsive flow regression requires an expandable recommendation followed by another card"
  ]],
  ["recommendations", ["recommendation cards"], "supports Escape, cross-card focus collapse, and reduced motion", [
    "Keyboard disclosure regression requires recommendation content", "Keyboard disclosure regression requires an expandable recommendation"
  ]]
];

export const allowedBrowserSkips = Object.freeze(Object.fromEntries(entries.map(([file, group, title, reasons]) => [
  testIdentity({ project: "chromium", file: `tests/e2e/${file}.spec.ts`, titlePath: [...group, title] }), Object.freeze(reasons)
])));

export function validateSkipRegistry(discovery) {
  const identities = new Set(discovery);
  for (const identity of Object.keys(allowedBrowserSkips)) {
    if (!identities.has(identity)) throw new Error("Optional-content skip registry has a moved or removed test; reconcile it explicitly.");
  }
}
