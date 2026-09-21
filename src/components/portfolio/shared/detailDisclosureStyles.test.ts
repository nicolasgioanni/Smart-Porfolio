import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const detailStyles = readFileSync(path.join(process.cwd(), "src", "styles", "detail.css"), "utf8");

describe("connected detail disclosure styles", () => {
  it("uses each card's semantic opaque surface, including the glass-effects fallback", () => {
    const cardSurfaceRule =
      detailStyles.match(/\.experience-card,\s*\.research-project\s*\{[^}]*}/s)?.[0] ?? "";
    const fallbackSurfaceRule =
      detailStyles.match(
        /\.site-shell\[data-glass-effects="false"\] \.experience-card,\s*\.site-shell\[data-glass-effects="false"\] \.research-project\s*\{[^}]*}/s
      )?.[0] ?? "";

    expect(cardSurfaceRule).toMatch(/--detail-panel-surface:\s*var\(--color-surface\)/);
    expect(fallbackSurfaceRule).toMatch(/--detail-panel-surface:\s*var\(--glass-fallback-surface\)/);
  });

  it("joins summary and panel with a disclosed outline instead of persistent trigger shadows", () => {
    const connectedTriggerRule =
      detailStyles.match(
        /\.detail-section:is\(\[data-visual-state="open"\], \[data-visual-state="closing"\]\) \.detail-section__trigger\s*\{[^}]*}/s
      )?.[0] ?? "";
    const openPanelRule =
      detailStyles.match(/\.detail-section\[data-visual-state="open"\] \.detail-section__panel\s*\{[^}]*}/s)?.[0] ?? "";
    const closingPanelRule =
      detailStyles.match(/\.detail-section\[data-visual-state="closing"\] \.detail-section__panel\s*\{[^}]*}/s)?.[0] ?? "";

    expect(connectedTriggerRule).toMatch(/border-end-end-radius:\s*0/);
    expect(connectedTriggerRule).toMatch(/border-end-start-radius:\s*0/);
    expect(connectedTriggerRule).toMatch(/background:\s*var\(--detail-panel-surface\)/);
    expect(connectedTriggerRule).not.toMatch(/box-shadow/);
    expect(connectedTriggerRule).toMatch(/transition:\s*none/);

    for (const panelRule of [openPanelRule, closingPanelRule]) {
      expect(panelRule).toMatch(/border-width:\s*0 1px 1px/);
      expect(panelRule).toMatch(/border-radius:\s*0 0 var\(--radius-card\) var\(--radius-card\)/);
      expect(panelRule).toMatch(/background:\s*var\(--detail-panel-surface\)/);
      expect(panelRule).not.toMatch(/box-shadow/);
    }

    expect(detailStyles).toMatch(/\.detail-section__trigger::before,\s*\.detail-section__trigger::after\s*\{[\s\S]*?top:\s*-1px[\s\S]*?right:\s*0[\s\S]*?bottom:\s*0[\s\S]*?left:\s*0/s);
    expect(detailStyles).toMatch(/\.detail-section__trigger::before\s*\{[^}]*border-top-color:\s*var\(--color-line-strong\)/s);
    expect(detailStyles).toMatch(/\.detail-section__trigger::after\s*\{[\s\S]*?border-right-color:\s*var\(--color-line-strong\)[\s\S]*?border-left-color:\s*var\(--color-line-strong\)[\s\S]*?transform:\s*scaleY\(0\)[\s\S]*?transform-origin:\s*bottom/s);
    expect(detailStyles).toMatch(/\.detail-section\[data-open="true"\] \.detail-section__trigger::before,[\s\S]*?\.detail-section\[data-open="true"\] \.detail-section__trigger::after\s*\{[^}]*opacity:\s*1/s);
    expect(detailStyles).toMatch(/\.detail-list:has\(> \.detail-section:first-child\[data-open="true"\]\)::before,[\s\S]*?\.detail-section:has\(\+ \.detail-section\[data-open="true"\]\)::before/s);
    expect(detailStyles).toMatch(/top:\s*100%/);
    expect(detailStyles).not.toMatch(/top:\s*calc\(100% - 1px\)/);
  });

  it("keeps the keyboard focus ring and prevents hover from breaking an active join", () => {
    const focusRule =
      detailStyles.match(
        /\.detail-section:is\(\[data-visual-state="open"\], \[data-visual-state="closing"\]\) \.detail-section__trigger:focus-visible\s*\{[^}]*}/s
      )?.[0] ?? "";

    expect(focusRule).toMatch(/var\(--focus-ring\)/);
    expect(focusRule).not.toMatch(/inset/);
    expect(detailStyles).toMatch(
      /\.detail-section:not\(\[data-visual-state="open"\]\):not\(\[data-visual-state="closing"\]\)[\s\S]*?\.detail-section__trigger:not\(\.detail-section__trigger--static\):hover/s
    );
  });
});
