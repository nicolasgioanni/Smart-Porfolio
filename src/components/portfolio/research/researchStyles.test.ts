import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const researchStyles = readFileSync(path.join(process.cwd(), "src", "styles", "research.css"), "utf8");

function rule(selector: string) {
  return researchStyles.match(new RegExp(`(^|\\n)\\s*${selector}\\s*\\{[^}]*}`, "ms"))?.[0] ?? "";
}

describe("research showcase styles", () => {
  it("alternates the visualization and evidence columns on desktop", () => {
    const projectRule = rule("\\.research-project");
    const rightProjectRule = rule('\\.research-project\\[data-visual-side="right"\\]');
    const rightVisualRule = rule('\\.research-project\\[data-visual-side="right"\\] \\.research-project__visual');
    const rightContentRule = rule('\\.research-project\\[data-visual-side="right"\\] \\.research-project__content');

    expect(projectRule).toMatch(/grid-template-columns:\s*minmax\(280px, 0\.82fr\) minmax\(0, 1\.18fr\)/);
    expect(rightProjectRule).toMatch(/grid-template-columns:\s*minmax\(0, 1\.18fr\) minmax\(280px, 0\.82fr\)/);
    expect(rightVisualRule).toMatch(/grid-column:\s*2/);
    expect(rightContentRule).toMatch(/grid-column:\s*1/);
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

  it("keeps opaque per-project visual surfaces and direct graphical-abstract containment", () => {
    const visualSurfaces = [...researchStyles.matchAll(/--visual-surface:\s*([^;]+);/g)].map(([, surface]) => surface.trim());
    const visualRule = researchStyles.match(/\.research-project__visual\s*\{[^}]*}/s)?.[0] ?? "";
    const mediaStackRule = researchStyles.match(/\.research-media-stack\s*\{[^}]*}/s)?.[0] ?? "";
    const mediaRowRule = researchStyles.match(/\.research-project__media-row\s*\{[^}]*}/s)?.[0] ?? "";
    const mediaDividerRule = researchStyles.match(/\.research-project__media-divider\s*\{[^}]*}/s)?.[0] ?? "";
    const abstractRule = rule("\\.research-abstract");
    const thumbnailRule = rule("\\.research-abstract__thumbnail");

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
    expect(abstractRule).toMatch(/background:\s*var\(--visual-surface\)/);
    expect(thumbnailRule).toMatch(/object-fit:\s*contain/);
  });

  it("keeps connected explainer scenes complete while twelve-second timelines animate actual subjects", () => {
    const sceneRule = researchStyles.match(/\.research-explainer__scene\s*\{[^}]*}/s)?.[0] ?? "";
    const labelRule = researchStyles.match(/\.research-explainer__scene-label\s*\{[^}]*}/s)?.[0] ?? "";
    const guideDonorLabelRule = researchStyles.match(/\.research-explainer__scene-label--guide-row,[\s\S]*?\.research-explainer__scene-label--donor-row\s*\{[^}]*}/s)?.[0] ?? "";
    const controlRule = rule("\\.research-explainer__playback-control");
    const diagramSymbolRule = rule("\\.research-explainer__base-letter");
    const subjectSetupRule = researchStyles.match(/\.research-explainer\[data-animation-ready="true"\] \.research-explainer__pixel-patches,[\s\S]*?\.research-explainer\[data-animation-ready="true"\] \.research-explainer__export-token\s*\{[^}]*}/s)?.[0] ?? "";
    const subjectRunRule = researchStyles.match(/\.research-explainer\[data-animation-ready="true"\]\[data-playback="playing"\] \.research-explainer__pixel-patches,[\s\S]*?\.research-explainer\[data-animation-ready="true"\]\[data-playback="playing"\] \.research-explainer__export-token\s*\{[^}]*}/s)?.[0] ?? "";

    expect(sceneRule).toMatch(/overflow:\s*hidden/);
    expect(labelRule).toMatch(/font-size:\s*var\(--font-size-small\)/);
    expect(guideDonorLabelRule).toMatch(/font-size:\s*var\(--font-size-small\)/);
    expect(controlRule).toMatch(/font-size:\s*var\(--font-size-control-glyph\)/);
    expect(diagramSymbolRule).toMatch(/font-size:\s*var\(--font-size-diagram-symbol\)/);
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

  it("keeps full-card elevation exclusive to fine-pointer hover", () => {
    const sharedAttentionRule =
      researchStyles.match(/\.research-project:hover,\s*\.research-project:focus-within\s*\{[^}]*}/s)?.[0] ?? "";
    const hoverElevationRule = rule("\\.research-project:hover");

    expect(sharedAttentionRule).toMatch(/border-color:\s*var\(--detail-accent-border\)/);
    expect(sharedAttentionRule).not.toMatch(/box-shadow|transform/);
    expect(hoverElevationRule).toMatch(/box-shadow:\s*var\(--shadow-soft\)/);
    expect(hoverElevationRule).toMatch(/transform:\s*translate3d\(0, -2px, 0\)/);
  });

  it("keeps research resource targets touch-safe and the header identity compact", () => {
    const resourceRule = rule("\\.research-project__resource");
    const pendingResourceRule = rule("\\.research-project__resource--pending");
    const identityRule = rule("\\.research-project__identity");

    expect(resourceRule).toMatch(/min-height:\s*44px/);
    expect(pendingResourceRule).toMatch(/min-height:\s*44px/);
    expect(identityRule).toMatch(/display:\s*flex/);
    expect(researchStyles).not.toMatch(/research-project__kicker-row/);
    expect(researchStyles).not.toMatch(/research-project__metadata/);
  });

  it("limits graphical-abstract lift to direct pointer or keyboard attention", () => {
    const triggerRule = rule("\\.research-abstract__trigger");
    const focusRule = rule("\\.research-abstract__trigger:focus-visible");

    expect(triggerRule).toMatch(/transition:\s*box-shadow 180ms ease,\s*transform 180ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/);
    expect(focusRule).toMatch(/outline:\s*3px solid var\(--detail-accent\)/);
    expect(focusRule).toMatch(/transform:\s*translate3d\(0, -2px, 0\)/);
    expect(researchStyles).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.research-abstract__trigger:hover[\s\S]*?transform:\s*translate3d\(0, -2px, 0\)/
    );
  });

  it("uses a shared media dialog with a fit-to-media frame, safe gutters, and a permanent close target", () => {
    const dialogRootRule = rule("\\.research-media-dialog");
    const dialogFrameRule = rule("\\.research-media-dialog__frame");
    const dialogImageRule = rule("\\.research-media-dialog__image");
    const dialogCloseRule = rule("\\.research-media-dialog__close");

    expect(dialogRootRule).toMatch(/safe-area-inset-top/);
    expect(dialogRootRule).toMatch(/16px/);
    expect(researchStyles).toMatch(/@media \(min-width: 621px\)[\s\S]*?\.research-media-dialog[\s\S]*?32px/);
    expect(dialogFrameRule).toMatch(/width:\s*min\(1120px, calc\(100vw - 32px\)\)/);
    expect(dialogFrameRule).toMatch(/max-height:\s*84dvh/);
    expect(dialogFrameRule).not.toMatch(/height:\s*100%/);
    expect(dialogImageRule).toMatch(/object-fit:\s*contain/);
    expect(dialogCloseRule).toMatch(/width:\s*44px/);
    expect(dialogCloseRule).toMatch(/height:\s*44px/);
  });

  it("keeps a native media viewport under progressive liquid-glass controls with opaque fallbacks", () => {
    const playerRule = rule("\\.research-video-player");
    const mediaRule = rule("\\.research-video-player__media");
    const controlRule = rule("\\.research-video-player__control");
    const controlSurfaceRule = researchStyles.match(/^\.research-video-player__control::before\s*\{[^}]*}/m)?.[0] ?? "";
    const centerRule = rule("\\.research-video-player__center-control");
    const seekRule = rule("\\.research-video-player__seek");
    const timeRule = rule("\\.research-video-player__time");
    const bottomBarRule = rule("\\.research-video-player__bottom-bar");

    expect(playerRule).toMatch(/background:\s*#000/);
    expect(mediaRule).toMatch(/object-fit:\s*contain/);
    expect(controlRule).toMatch(/width:\s*44px/);
    expect(controlRule).toMatch(/min-height:\s*44px/);
    expect(controlSurfaceRule).toMatch(/inset:\s*7px/);
    expect(centerRule).toMatch(/width:\s*48px/);
    expect(researchStyles).not.toMatch(/research-video-player__top-bar/);
    expect(bottomBarRule).toMatch(/min-height:\s*70px/);
    expect(bottomBarRule).toMatch(/padding:\s*0 10px/);
    expect(bottomBarRule).not.toMatch(/(?:background|border(?:-radius)?|box-shadow|backdrop-filter)\s*:/);
    expect(researchStyles).toMatch(/\.research-video-player__timeline-row\s*\{[^}]*padding-top:\s*7px/);
    expect(researchStyles).toMatch(/\.research-video-player__timeline-row,[\s\S]*?align-items:\s*center/);
    expect(seekRule).not.toMatch(/align-self/);
    expect(timeRule).not.toMatch(/align-self/);
    expect(researchStyles).toMatch(/\.research-video-player__actions\s*\{[^}]*justify-content:\s*space-between/);
    expect(researchStyles).toMatch(/\.research-video-player__volume-range\[data-open="true"\]\s*\{[^}]*width:\s*100px/);
    expect(researchStyles).toMatch(/\.research-video-player__volume-range input\[aria-label="Volume"\]\s*\{[^}]*width:\s*96px[^}]*border:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/);
    expect(researchStyles).toMatch(/\.research-video-player\[data-controls-visible="false"\] \.research-video-player__bottom-bar,[\s\S]*?\.research-video-player\[data-controls-visible="false"\] \.research-video-player__center-control/);
    expect(researchStyles).toMatch(/\.research-video-player__captions--lower\s*\{[^}]*display:\s*none/);
    expect(researchStyles).toMatch(/\.research-video-player__captions--raised\s*\{[^}]*bottom:\s*var\(--research-video-caption-raised-bottom, 82px\)/);
    expect(researchStyles).toMatch(/\[data-caption-raised-position="upper"\][\s\S]*?top:\s*var\(--research-video-caption-upper-top/);
    expect(researchStyles).toMatch(/\.research-video-player__captions--lower\s*\{[^}]*bottom:\s*var\(--research-video-caption-lower-bottom/);
    expect(researchStyles).toMatch(/@media \(max-width: 420px\)[\s\S]*?\.research-video-player__captions\s*\{[^}]*font-size:\s*var\(--font-size-caption\)/);
    expect(researchStyles).toMatch(/research-video-player__captions--lower[\s\S]*?opacity:\s*0/);
    expect(researchStyles).toMatch(/\.research-video-player__captions\s*\{[^}]*font-family:\s*var\(--font-sans\)[^}]*font-weight:\s*var\(--font-weight-regular\)[^}]*transition:\s*opacity 200ms ease, transform 200ms ease/);
    expect(researchStyles).toMatch(/--research-video-caption-opacity:\s*0/);
    expect(researchStyles).toMatch(/\[data-caption-visible="true"\]\s*\{[^}]*--research-video-caption-opacity:\s*1/);
    expect(researchStyles).toMatch(/\[data-caption-transition="true"\][\s\S]*?transition:\s*opacity 180ms ease, transform 200ms ease/);
    expect(researchStyles).toMatch(/--research-video-glass-ink:\s*#fffdf7/);
    expect(researchStyles).toMatch(/--research-video-glass-surface:\s*#061522/);
    expect(researchStyles).toMatch(/text-shadow:\s*var\(--research-video-glass-text-shadow\)/);
    expect(researchStyles).toMatch(/color-mix\(in srgb, var\(--research-video-glass-surface\) 30%, transparent\)/);
    const glassSupport = researchStyles.match(/@supports \(\(color: color-mix\(in srgb, black, white\) and \(backdrop-filter: blur\(1px\)\)\) \{[\s\S]*?\n}\n\n\.research-video-player:fullscreen/)?.[0] ?? "";
    expect(glassSupport).not.toMatch(/research-video-player__bottom-bar/);
    expect(researchStyles).not.toMatch(/research-video-player__volume-popover/);
    expect(researchStyles).toMatch(/@supports \(\(color: color-mix\(in srgb, black, white\)\) and \(backdrop-filter: blur\(1px\)\)\)/);
    expect(researchStyles).toMatch(/site-shell\[data-glass-effects="false"\][\s\S]*?backdrop-filter:\s*none/);
    expect(researchStyles).toMatch(/@media \(prefers-reduced-transparency: reduce\), \(forced-colors: active\)/);
  });

  it("adapts player controls to their own width and preserves the fullscreen and reduced-motion fallbacks", () => {
    const videoRule = rule("\\.research-video");

    expect(videoRule).toMatch(/container:\s*research-video-preview \/ inline-size/);
    expect(researchStyles).toMatch(/\.research-video-player\s*\{[\s\S]*?container-type:\s*inline-size/);
    expect(researchStyles).not.toMatch(/research-video-player__top-bar/);
    expect(researchStyles).not.toMatch(/research-video-player__center-control\s*\{[^}]*top:\s*28%/);
    expect(researchStyles).toMatch(/\.research-video-player__settings button\s*\{[^}]*min-height:\s*32px/);
    expect(researchStyles).toMatch(/\.research-video-player\.research-media-dialog__video .research-video-player__bottom-bar,[\s\S]*?width:\s*clamp\(min\(352px, calc\(100% - 32px\)\), 33\.333%, calc\(100% - 32px\)\)/);
    expect(researchStyles).toMatch(/@container \(max-width: 24rem\)[\s\S]*?research-video-player\[data-volume-open="true"\][\s\S]*?flex-wrap:\s*wrap/);
    expect(researchStyles).toMatch(/\.research-video-player__settings\s*\{[^}]*grid-template-areas:\s*"view"[^}]*transition:\s*opacity 180ms ease, transform 180ms ease, visibility 0s linear 180ms/);
    expect(researchStyles).toMatch(/\.research-video-player__settings-root,[\s\S]*?grid-area:\s*view[^}]*transition:\s*opacity 180ms ease, transform 180ms ease, visibility 0s linear 180ms/);
    expect(researchStyles).toMatch(/\.research-video-player__settings-root\[data-open="false"\]\s*\{[^}]*transform:\s*translateX\(-6px\)/);
    expect(researchStyles).toMatch(/\.research-video-player__settings-speeds\[data-open="false"\]\s*\{[^}]*transform:\s*translateX\(6px\)/);
    expect(researchStyles).toMatch(/\.research-video-player__settings \.research-video-player__settings-back\s*\{[^}]*justify-self:\s*start[^}]*width:\s*32px/);
    expect(researchStyles).toMatch(/\.research-video-player__speed-range\s*\{[^}]*width:\s*100%/);
    expect(researchStyles).toMatch(/@container research-video-preview \(max-width: 30rem\)[\s\S]*?\.research-video__viewport\[data-enhanced="true"\]:not\(:fullscreen\):not\(:-webkit-full-screen\)\s*\{[^}]*min-block-size:\s*320px/);
    expect(researchStyles).not.toMatch(/@media \(max-width: 420px\)[\s\S]*?\.research-video__viewport\s*\{[^}]*min-block-size/);
    expect(researchStyles).not.toMatch(/\.research-video-player__settings-root\[data-open="false"\],[\s\S]*?display:\s*none/);
    expect(researchStyles).toMatch(/@media \(pointer: coarse\)[\s\S]*?\.research-video-player__settings button[\s\S]*?min-height:\s*44px/);
    expect(researchStyles).toMatch(/\.research-video-player:fullscreen,[\s\S]*?\.research-video-player:-webkit-full-screen/);
    expect(researchStyles).toMatch(
      /\.research-video-player:fullscreen:not\(\[data-caption-adaptive="true"\]\) \.research-video-player__captions--raised,[\s\S]*?bottom:\s*calc\(82px \+ var\(--space-3\)\)/
    );
    expect(researchStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.research-video-player__bottom-bar[\s\S]*?transition:\s*none/
    );
    expect(researchStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.research-video-player__settings-root,[\s\S]*?transition:\s*none/
    );
  });
});
