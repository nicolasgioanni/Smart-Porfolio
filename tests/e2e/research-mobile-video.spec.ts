import { allowBrowserConsoleMessage, captureBrowserConsole, expectNoBrowserConsoleIssues } from "./browserConsole";
import { expect, test, type Locator, type Page } from "./browserTest";
import { settleLayout } from "./settleLayout";
import { reloadWithStoredTheme } from "./themePreference";

const cytocvProject = 'article.research-project[id="cytocv-miller-lab"]';

test.beforeEach(async ({ page }) => {
  captureBrowserConsole(page);
  allowBrowserConsoleMessage(page, /Button failed to load, iconName = (invalid|pip|airplay)-placard/);
  await page.setViewportSize({ width: 390, height: 844 });
});

test.afterEach(async ({ page }) => {
  expectNoBrowserConsoleIssues(page);
});

function inlinePlayer(page: Page) {
  return page.locator(cytocvProject).getByTestId("research-video-player");
}

function videoFor(player: Locator) {
  return player.locator("video.research-video-player__media");
}

async function setCue(video: Locator, currentTime: number) {
  await expect
    .poll(() =>
      video.evaluate((element) => {
        const media = element as HTMLVideoElement;
        const captions = media.querySelector("track") as HTMLTrackElement | null;
        return {
          captionsReady: captions?.readyState ?? 0,
          metadataReady: media.readyState >= HTMLMediaElement.HAVE_METADATA
        };
      })
    )
    .toEqual({ captionsReady: 2, metadataReady: true });
  await video.evaluate((element, time) => {
    const media = element as HTMLVideoElement;
    media.currentTime = time;
    media.dispatchEvent(new Event("timeupdate"));
    media.dispatchEvent(new Event("seeked"));
  }, currentTime);
}

async function wakeTouchControls(player: Locator) {
  await player.scrollIntoViewIfNeeded();
  if (await player.getAttribute("data-controls-visible") === "true") return;
  await player.evaluate((element) => {
    for (const type of ["pointerdown", "pointerup"] as const) {
      element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch" }));
    }
  });
  await expect(player).toHaveAttribute("data-controls-visible", "true");
}

async function rejectContainerFullscreen(player: Locator) {
  await player.evaluate((element) => {
    Object.defineProperty(element, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new DOMException("blocked", "NotAllowedError"))
    });
  });
}

async function expectCaptionTiming(player: Locator, expectedOpacityDuration: string, expectedTransformDuration: string) {
  await expect
    .poll(() =>
      player.getByTestId("research-video-captions").evaluate((caption) => {
        const style = getComputedStyle(caption);
        return { duration: style.transitionDuration, property: style.transitionProperty };
      })
    )
    .toEqual({
      duration: `${expectedOpacityDuration}, ${expectedTransformDuration}`,
      property: "opacity, transform"
    });
}

async function expectNoCaptionMotion(player: Locator) {
  await expect
    .poll(() =>
      player.getByTestId("research-video-captions").evaluate((caption) => {
        const style = getComputedStyle(caption);
        return { duration: style.transitionDuration, property: style.transitionProperty };
      })
    )
    .toEqual({ duration: "0s", property: "none" });
}

test("@mobile-video animates CytoCV popup captions through a nested native fullscreen fallback", async ({ page }) => {
  test.slow();
  await page.goto("/research");
  await settleLayout(page);

  const inline = inlinePlayer(page);
  await wakeTouchControls(inline);
  await inline.getByRole("button", { name: "Open video settings" }).click();
  await inline.getByTestId("video-settings").getByRole("button", { name: "Open enlarged player" }).click();

  const popup = page.getByRole("dialog", { name: "CytoCV supplementary workflow video" });
  const player = popup.getByTestId("research-video-player");
  const video = videoFor(player);
  await expect(popup).toBeVisible();
  await setCue(video, 24);
  await expect(player.getByTestId("research-video-captions")).toContainText("of the red nucleus.");
  await wakeTouchControls(player);

  await expectCaptionTiming(player, "0.2s", "0.2s");
  await player.getByRole("button", { name: "Disable captions" }).click();
  await expect(player).toHaveAttribute("data-caption-transition", "true");
  await expectCaptionTiming(player, "0.18s", "0.2s");
  await page.waitForTimeout(90);
  await player.getByRole("button", { name: "Enable captions" }).click();
  await expect(player).toHaveAttribute("data-caption-exiting", "false");
  await expect(player).toHaveAttribute("data-caption-visible", "true");

  await rejectContainerFullscreen(player);
  await player.getByRole("button", { name: "Enter fullscreen" }).click();
  const fullscreen = page.getByRole("dialog", { name: "CytoCV supplementary workflow video enlarged fullscreen" });
  await expect(fullscreen).toBeVisible();
  await expect(player).toHaveAttribute("data-fullscreen-fallback", "true");
  await setCue(video, 19);
  await expect(player.getByTestId("research-video-captions")).toContainText("This red image shows the cell contour");
  await expectCaptionTiming(player, "0.2s", "0.2s");

  await page.keyboard.press("Escape");
  await expect(fullscreen).not.toBeVisible();
  await expect(popup).toBeVisible();
});

test("@mobile-video keeps fullscreen fallback controls opaque in every palette and removes caption motion", async ({ page }) => {
  test.slow();
  await page.goto("/research");
  await settleLayout(page);

  for (const theme of ["navy", "light", "dark"] as const) {
    await reloadWithStoredTheme(page, theme);
    await page.locator(".site-shell").evaluate((shell) => shell.setAttribute("data-glass-effects", "false"));

    const player = inlinePlayer(page);
    const video = videoFor(player);
    await setCue(video, 19);
    await expect(player.getByTestId("research-video-captions")).toContainText("This red image shows the cell contour");
    await wakeTouchControls(player);
    await rejectContainerFullscreen(player);
    await player.getByRole("button", { name: "Enter fullscreen" }).click();

    const fullscreen = page.getByRole("dialog", { name: "CytoCV supplementary workflow video fullscreen" });
    await expect(fullscreen).toBeVisible();
    const opaqueSurface = await player.evaluate((element) => {
      const caption = element.querySelector<HTMLElement>("[data-testid='research-video-captions']");
      const control = element.querySelector<HTMLElement>(".research-video-player__center-control");
      const exit = element.closest("dialog")?.querySelector<HTMLElement>(".research-video-fullscreen__exit");
      if (!caption || !control || !exit) throw new Error("Missing fullscreen caption, control, or exit button.");
      const captionStyle = getComputedStyle(caption);
      const controlStyle = getComputedStyle(control, "::before");
      const exitStyle = getComputedStyle(exit);
      return {
        captionBackdrop: captionStyle.backdropFilter,
        captionBackground: captionStyle.backgroundColor,
        controlBackdrop: controlStyle.backdropFilter,
        controlBackground: controlStyle.backgroundColor,
        dialogBackground: getComputedStyle(element.closest("dialog")!).backgroundColor,
        exitBackground: exitStyle.backgroundColor,
        exitBorder: exitStyle.borderColor,
        exitColor: exitStyle.color
      };
    });
    expect(opaqueSurface).toEqual({
      captionBackdrop: "none",
      captionBackground: "rgb(6, 21, 34)",
      controlBackdrop: "none",
      controlBackground: "rgb(6, 21, 34)",
      dialogBackground: "rgb(0, 0, 0)",
      exitBackground: "rgb(6, 21, 34)",
      exitBorder: "rgba(255, 253, 247, 0.56)",
      exitColor: "rgb(255, 253, 247)"
    });

    await page.keyboard.press("Escape");
    await expect(fullscreen).not.toBeVisible();
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/research");
  await settleLayout(page);
  const reducedPlayer = inlinePlayer(page);
  await setCue(videoFor(reducedPlayer), 24);
  await expect(reducedPlayer.getByTestId("research-video-captions")).toContainText("of the red nucleus.");
  await wakeTouchControls(reducedPlayer);
  await expectNoCaptionMotion(reducedPlayer);
  await reducedPlayer.getByRole("button", { name: "Disable captions" }).click();
  await expect(reducedPlayer).toHaveAttribute("data-caption-exiting", "false");
  await expect(reducedPlayer).toHaveAttribute("data-caption-visible", "false");
  await expect(reducedPlayer).toHaveAttribute("data-caption-center-conflict", "false");
  await expect
    .poll(() =>
      reducedPlayer.getByTestId("research-video-captions").evaluate((caption) => getComputedStyle(caption).opacity)
    )
    .toBe("0");
  await expect
    .poll(() =>
      reducedPlayer.locator(".research-video-player__center-control").evaluate((control) => getComputedStyle(control).visibility)
    )
    .toBe("visible");
});
