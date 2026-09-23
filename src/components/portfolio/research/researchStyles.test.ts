import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const researchStyles = readFileSync(path.join(process.cwd(), "src", "styles", "research.css"), "utf8");

describe("research showcase styles", () => {
  it("alternates the visualization and evidence columns on desktop", () => {
    const projectRule = researchStyles.match(/\.research-project\s*\{[^}]*}/s)?.[0] ?? "";
    const rightProjectRule =
      researchStyles.match(/\.research-project\[data-visual-side="right"\]\s*\{[^}]*}/s)?.[0] ?? "";
    const rightVisualRule =
      researchStyles.match(/\.research-project\[data-visual-side="right"\] \.research-project__visual\s*\{[^}]*}/s)?.[0] ?? "";
    const rightContentRule =
      researchStyles.match(/\.research-project\[data-visual-side="right"\] \.research-project__content\s*\{[^}]*}/s)?.[0] ?? "";
    const rightSkeletonRule =
      researchStyles.match(/\.research-skeleton__project\[data-visual-side="right"\]\s*\{[^}]*}/s)?.[0] ?? "";

    expect(projectRule).toMatch(/grid-template-columns:\s*minmax\(280px, 0\.82fr\) minmax\(0, 1\.18fr\)/);
    expect(rightProjectRule).toMatch(/grid-template-columns:\s*minmax\(0, 1\.18fr\) minmax\(280px, 0\.82fr\)/);
    expect(rightVisualRule).toMatch(/grid-column:\s*2/);
    expect(rightContentRule).toMatch(/grid-column:\s*1/);
    expect(rightContentRule).toMatch(/grid-row:\s*1/);
    expect(rightSkeletonRule).toMatch(/grid-template-columns:\s*minmax\(0, 1\.18fr\) minmax\(280px, 0\.82fr\)/);
  });

  it("stacks every visualization before its evidence below the desktop breakpoint", () => {
    expect(researchStyles).toMatch(
      /@media \(max-width: 920px\)[\s\S]*?\.research-project__visual,[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1;[\s\S]*?\.research-project__content,[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*2;/
    );
  });

  it("defines distinct project palettes and removes optional motion when requested", () => {
    expect(researchStyles).toMatch(/\.research-project\[data-project="aml"\]\s*\{/);
    expect(researchStyles).toMatch(/\.research-project\[data-project="guide-donor"\]\s*\{/);
    expect(researchStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.research-list\[data-motion="enabled"\] \.research-project-wrap[\s\S]*?animation:\s*none/
    );
  });

  it("uses opaque per-project surfaces behind every research visual", () => {
    const visualSurfaces = [...researchStyles.matchAll(/--visual-surface:\s*([^;]+);/g)].map(([, surface]) => surface.trim());
    const visualRule = researchStyles.match(/\.research-project__visual\s*\{[^}]*}/s)?.[0] ?? "";
    const mediaStackRule = researchStyles.match(/\.research-media-stack\s*\{[^}]*}/s)?.[0] ?? "";
    const mediaRowRule = researchStyles.match(/\.research-project__media-row\s*\{[^}]*}/s)?.[0] ?? "";
    const mediaDividerRule = researchStyles.match(/\.research-project__media-divider\s*\{[^}]*}/s)?.[0] ?? "";

    expect(visualSurfaces).toHaveLength(6);
    expect(visualSurfaces.every((surface) => /^#[\da-f]{6}$/i.test(surface))).toBe(true);
    expect(researchStyles).toMatch(/\.research-visual\s*{[^}]*background:\s*var\(--visual-surface\)/s);
    expect(visualRule).toMatch(/background:\s*var\(--visual-surface\)/);
    expect(mediaStackRule).toMatch(/background:\s*var\(--visual-surface\)/);
    expect(mediaStackRule).toMatch(/grid-template-rows:\s*minmax\(min-content, 1fr\) 1px minmax\(min-content, 1fr\)/);
    expect(mediaRowRule).toMatch(/align-content:\s*center/);
    expect(mediaRowRule).toMatch(/justify-items:\s*center/);
    expect(mediaRowRule).toMatch(/padding:\s*var\(--space-4\)/);
    expect(mediaDividerRule).toMatch(/margin-inline:\s*24px/);
    expect(mediaDividerRule).toMatch(/background:\s*rgba\(220, 235, 255, 0\.12\)/);
  });

  it("keeps connected explainer scenes complete while twelve-second timelines animate actual subjects", () => {
    const sceneRule = researchStyles.match(/\.research-explainer__scene\s*\{[^}]*}/s)?.[0] ?? "";
    const labelRule = researchStyles.match(/\.research-explainer__scene-label\s*\{[^}]*}/s)?.[0] ?? "";
    const subjectSetupRule = researchStyles.match(/\.research-explainer\[data-animation-ready="true"\] \.research-explainer__pixel-patches,[\s\S]*?\.research-explainer\[data-animation-ready="true"\] \.research-explainer__export-token\s*\{[^}]*}/s)?.[0] ?? "";
    const subjectRunRule = researchStyles.match(/\.research-explainer\[data-animation-ready="true"\]\[data-playback="playing"\] \.research-explainer__pixel-patches,[\s\S]*?\.research-explainer\[data-animation-ready="true"\]\[data-playback="playing"\] \.research-explainer__export-token\s*\{[^}]*}/s)?.[0] ?? "";

    expect(sceneRule).toMatch(/overflow:\s*hidden/);
    expect(labelRule).toMatch(/font-size:\s*13px/);
    expect(subjectSetupRule).toMatch(/animation-duration:\s*12s/);
    expect(subjectSetupRule).toMatch(/animation-play-state:\s*paused/);
    expect(subjectRunRule).toMatch(/animation-play-state:\s*running/);
    for (const subject of [
      "pixel-patches",
      "data-token",
      "detector-ring",
      "test-token",
      "change-marker--requested",
      "guide-bracket",
      "donor-token",
      "export-token"
    ]) {
      expect(subjectSetupRule).toContain(`research-explainer__${subject}`);
    }
    expect(researchStyles).toMatch(/@keyframes research-explainer-aml-clean-flow[\s\S]*?translate3d/);
    expect(researchStyles).toMatch(/@keyframes research-explainer-detector-outer[\s\S]*?rotate/);
    expect(researchStyles).toMatch(/@keyframes research-explainer-export-guide[\s\S]*?translate3d/);
    expect(researchStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.research-explainer\[data-animation-ready="true"\]\[data-playback\] \.research-explainer__pixel-patches[\s\S]*?\.research-explainer\[data-animation-ready="true"\]\[data-playback\] \.research-explainer__export-token\s*\{[^}]*animation:\s*none/);
  });

  it("keeps full-card elevation exclusive to pointer hover", () => {
    const sharedAttentionRule =
      researchStyles.match(/\.research-project:hover,\s*\.research-project:focus-within\s*\{[^}]*}/s)?.[0] ?? "";
    const hoverElevationRule = researchStyles.match(/\.research-project:hover\s*\{[^}]*}/s)?.[0] ?? "";

    expect(sharedAttentionRule).toMatch(/border-color:\s*var\(--detail-accent-border\)/);
    expect(sharedAttentionRule).not.toMatch(/box-shadow|transform/);
    expect(hoverElevationRule).toMatch(/box-shadow:\s*var\(--shadow-soft\)/);
    expect(hoverElevationRule).not.toMatch(/glow|gradient|0 0 64px/);
    expect(hoverElevationRule).toMatch(/transform:\s*translate3d\(0, -2px, 0\)/);
  });

  it("keeps research resource targets touch-safe and the header identity compact", () => {
    const resourceRule = researchStyles.match(/\.research-project__resource\s*\{[^}]*}/s)?.[0] ?? "";
    const pendingResourceRule = researchStyles.match(/\.research-project__resource--pending\s*\{[^}]*}/s)?.[0] ?? "";
    const identityRule = researchStyles.match(/\.research-project__identity\s*\{[^}]*}/s)?.[0] ?? "";

    expect(resourceRule).toMatch(/min-height:\s*44px/);
    expect(pendingResourceRule).toMatch(/min-height:\s*44px/);
    expect(identityRule).toMatch(/display:\s*flex/);
    expect(researchStyles).not.toMatch(/research-project__kicker-row/);
    expect(researchStyles).not.toMatch(/research-project__metadata/);
  });

  it("contains graphical abstracts and limits lift motion to direct pointer or keyboard attention", () => {
    const graphicalAbstractFeatureBlock = researchStyles.slice(
      researchStyles.indexOf(".research-abstract {"),
      researchStyles.indexOf(".research-skeleton {")
    );
    const triggerRule = researchStyles.match(/\.research-abstract__trigger\s*\{[^}]*}/s)?.[0] ?? "";
    const thumbnailRule = researchStyles.match(/\.research-abstract__thumbnail\s*\{[^}]*}/s)?.[0] ?? "";
    const focusRule = researchStyles.match(/\.research-abstract__trigger:focus-visible\s*\{[^}]*}/s)?.[0] ?? "";
    const dialogFrameRule = researchStyles.match(/\.research-abstract-dialog__frame\s*\{[^}]*}/s)?.[0] ?? "";
    const dialogRootRule = researchStyles.match(/\.research-abstract-dialog\s*\{[^}]*}/s)?.[0] ?? "";
    const dialogFigureRule = researchStyles.match(/\.research-abstract-dialog__figure\s*\{[^}]*}/s)?.[0] ?? "";
    const dialogImageRule = researchStyles.match(/\.research-abstract-dialog__image\s*\{[^}]*}/s)?.[0] ?? "";
    const dialogCloseRule =
      researchStyles.match(/\.research-abstract-dialog__frame > \.research-abstract-dialog__close\s*\{[^}]*}/s)?.[0] ?? "";

    expect(thumbnailRule).toMatch(/width:\s*100%/);
    expect(thumbnailRule).toMatch(/height:\s*100%/);
    expect(thumbnailRule).toMatch(/object-fit:\s*contain/);
    expect(triggerRule).toMatch(/width:\s*100%/);
    expect(triggerRule).toMatch(/max-width:\s*none/);
    expect(researchStyles).toMatch(
      /\.research-abstract__title\s*\{[^}]*width:\s*100%[^}]*max-width:\s*44rem[^}]*justify-self:\s*start[^}]*overflow-wrap:\s*anywhere/s
    );
    expect(triggerRule).toMatch(
      /transition:\s*box-shadow 180ms ease,\s*transform 180ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/
    );
    expect(triggerRule).not.toMatch(/transition:[^;]*border-color/);
    expect(focusRule).toMatch(/outline:\s*3px solid var\(--detail-accent\)/);
    expect(focusRule).toMatch(/transform:\s*translate3d\(0, -2px, 0\)/);
    expect(dialogFrameRule).toMatch(/grid-template-rows:\s*minmax\(0, 1fr\)/);
    expect(dialogFrameRule).toMatch(/height:\s*100%/);
    expect(dialogFrameRule).toMatch(/box-shadow:\s*var\(--shadow-soft\)/);
    expect(dialogFrameRule).not.toMatch(/gradient|glow|backdrop-filter/);
    expect(dialogRootRule).toMatch(/background:\s*var\(--color-profile-preview-backdrop\)/);
    expect(dialogRootRule).not.toMatch(/backdrop-filter|blur/);
    expect(dialogFigureRule).toMatch(/overflow:\s*hidden/);
    expect(dialogImageRule).toMatch(/position:\s*absolute/);
    expect(dialogImageRule).toMatch(/inset:\s*0/);
    expect(dialogImageRule).toMatch(/max-inline-size:\s*100%/);
    expect(dialogImageRule).toMatch(/max-block-size:\s*100%/);
    expect(dialogImageRule).toMatch(/object-fit:\s*contain/);
    expect(dialogCloseRule).toMatch(/position:\s*absolute/);
    expect(graphicalAbstractFeatureBlock).not.toMatch(/gradient|backdrop-filter|blur|shadow-glow/i);
    expect(graphicalAbstractFeatureBlock).not.toMatch(/box-shadow\s*:\s*[^;]*\b0\s+0\b/i);
    expect(researchStyles).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.research-abstract__trigger:hover[\s\S]*?transform:\s*translate3d\(0, -2px, 0\)/
    );
    expect(researchStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.research-abstract__trigger\s*\{[^}]*transition:\s*none[\s\S]*?\.research-abstract__trigger:focus-visible[\s\S]*?transform:\s*none/
    );
  });

  it("contains the self-hosted video on opaque surfaces without blocking native media capabilities", () => {
    const videoFeatureBlock = researchStyles.slice(
      researchStyles.indexOf(".research-media-stack {"),
      researchStyles.indexOf(".research-abstract {")
    );
    const videoViewportRule = researchStyles.match(/\.research-video__viewport\s*\{[^}]*}/s)?.[0] ?? "";
    const videoHeaderRule = researchStyles.match(/\.research-video__header\s*\{[^}]*}/s)?.[0] ?? "";
    const videoToolbarRule = researchStyles.match(/\.research-video__toolbar\s*\{[^}]*}/s)?.[0] ?? "";
    const videoToolbarControlRule = researchStyles.match(/\.research-video__toolbar-control\s*\{[^}]*}/s)?.[0] ?? "";
    const playerRule = researchStyles.match(/\.research-video__player\s*\{[^}]*}/s)?.[0] ?? "";
    const dialogFrameRule = researchStyles.match(/\.research-video-dialog__frame\s*\{[^}]*}/s)?.[0] ?? "";
    const dialogViewportRule = researchStyles.match(/\.research-video-dialog__viewport\s*\{[^}]*}/s)?.[0] ?? "";
    const dialogPlayerRule = researchStyles.match(/\.research-video-dialog__player\s*\{[^}]*}/s)?.[0] ?? "";

    expect(videoFeatureBlock).toMatch(/background:\s*var\(--visual-surface\)/);
    expect(videoFeatureBlock).not.toMatch(/gradient|backdrop-filter|blur|shadow-glow/i);
    expect(videoHeaderRule).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(videoToolbarRule).toMatch(/position:\s*absolute/);
    expect(videoToolbarRule).toMatch(/top:\s*var\(--space-3\)/);
    expect(videoToolbarRule).toMatch(/right:\s*var\(--space-3\)/);
    expect(videoToolbarRule).toMatch(/border:\s*1px solid var\(--color-line-strong\)/);
    expect(videoToolbarRule).toMatch(/background:\s*var\(--color-surface-strong\)/);
    expect(videoToolbarControlRule).toMatch(/width:\s*44px !important/);
    expect(videoToolbarControlRule).toMatch(/min-height:\s*44px/);
    expect(videoToolbarControlRule).toMatch(/color:\s*var\(--color-ink-strong\)/);
    expect(videoViewportRule).toMatch(/aspect-ratio:\s*1710\s*\/\s*1108/);
    expect(videoViewportRule).toMatch(/border:\s*1px solid var\(--color-line-strong\)/);
    expect(videoViewportRule).toMatch(/overflow:\s*hidden/);
    expect(playerRule).toMatch(/object-fit:\s*contain/);
    expect(dialogFrameRule).toMatch(/grid-template-rows:\s*minmax\(0, 1fr\) auto/);
    expect(dialogFrameRule).toMatch(/overflow:\s*hidden/);
    expect(dialogFrameRule).not.toMatch(/gradient|backdrop-filter|blur/i);
    expect(dialogViewportRule).toMatch(/background:\s*#000/);
    expect(dialogPlayerRule).toMatch(/object-fit:\s*contain/);
    expect(researchStyles).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.research-video__viewport:hover \.research-video__toolbar,[\s\S]*?\.research-video-dialog__viewport:focus-within \.research-video__toolbar[\s\S]*?opacity:\s*1/
    );
    expect(researchStyles).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?\.research-video__toolbar\s*\{[^}]*opacity:\s*1[^}]*pointer-events:\s*auto[\s\S]*?\.research-video__toolbar-control::after\s*\{[^}]*content:\s*none/s
    );
  });
});
