import { expect, type Locator } from "./browserTest";

/** Verifies the stable-width settings shell fits only its currently active view. */
export async function expectSettingsActiveViewFit(player: Locator): Promise<void> {
  const settings = player.getByTestId("video-settings");
  const transitionGeometry = await settings.evaluate(async (element) => {
    const sample = () => {
      const viewport = element.querySelector<HTMLElement>(".research-video-player__settings-viewport");
      if (!viewport) throw new Error("Expected the settings transition viewport.");
      const layers = Array.from(viewport.querySelectorAll<HTMLElement>(":scope > [data-open]")).map((layer) => {
        const box = layer.getBoundingClientRect();
        const transform = getComputedStyle(layer).transform;
        const translateX = transform === "none" ? 0 : Number.parseFloat(transform.split(",")[4] ?? "0");
        return { left: box.left - translateX, width: box.width };
      });
      return {
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth,
        viewportHeight: viewport.getBoundingClientRect().height,
        layers
      };
    };
    const samples = [sample()];

    for (let frame = 0; frame < 24; frame += 1) {
      const hasFiniteTransition = element
        .getAnimations({ subtree: true })
        .some((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity);
      if (!hasFiniteTransition) break;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push(sample());
    }

    return samples;
  });
  for (const sample of transitionGeometry) {
    expect(sample.scrollWidth).toBeLessThanOrEqual(sample.clientWidth + 1);
    expect(sample.scrollHeight).toBeLessThanOrEqual(Math.max(sample.clientHeight, sample.viewportHeight + 11));
    expect(sample.layers).toHaveLength(2);
    expect(Math.abs(sample.layers[0]!.left - sample.layers[1]!.left)).toBeLessThanOrEqual(0.25);
    expect(sample.layers[0]!.width).toBeCloseTo(sample.layers[1]!.width, 1);
  }

  const geometry = await player.evaluate((playerElement) => {
    const settings = playerElement.querySelector<HTMLElement>("[data-testid='video-settings']");
    const viewport = settings?.querySelector<HTMLElement>(".research-video-player__settings-viewport");
    const activeView = viewport?.querySelector<HTMLElement>(":scope > [data-open='true']");
    if (!settings || !viewport || !activeView) throw new Error("Expected an open settings shell with one active view.");

    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top, width: rect.width };
    };
    const controls = Array.from(activeView.querySelectorAll<HTMLElement>("button, input")).map(box);

    return {
      active: {
        box: box(activeView),
        clientWidth: activeView.clientWidth,
        scrollWidth: activeView.scrollWidth
      },
      controls,
      player: {
        box: box(playerElement),
        scrollLeft: playerElement.scrollLeft
      },
      settings: {
        box: box(settings),
        clientHeight: settings.clientHeight,
        clientWidth: settings.clientWidth,
        overflowY: getComputedStyle(settings).overflowY,
        scrollHeight: settings.scrollHeight,
        scrollWidth: settings.scrollWidth
      },
      viewport: {
        box: box(viewport),
        clientWidth: viewport.clientWidth,
        overflowX: getComputedStyle(viewport).overflowX,
        overflowY: getComputedStyle(viewport).overflowY
      }
    };
  });

  expect(geometry.settings.scrollWidth).toBeLessThanOrEqual(geometry.settings.clientWidth + 1);
  expect(geometry.active.scrollWidth).toBeLessThanOrEqual(geometry.active.clientWidth + 1);
  expect(geometry.player.scrollLeft).toBe(0);
  expect(geometry.viewport.overflowX).toBe("clip");
  expect(geometry.viewport.overflowY).toBe("clip");
  expect(geometry.settings.box.left).toBeGreaterThanOrEqual(geometry.player.box.left - 1);
  expect(geometry.settings.box.right).toBeLessThanOrEqual(geometry.player.box.right + 1);
  expect(geometry.settings.box.top).toBeGreaterThanOrEqual(geometry.player.box.top - 1);
  expect(geometry.settings.box.bottom).toBeLessThanOrEqual(geometry.player.box.bottom + 1);
  expect(geometry.viewport.box.width - geometry.active.box.width).toBeCloseTo(10, 1);
  expect(geometry.viewport.box.height - geometry.active.box.height).toBeCloseTo(10, 1);
  expect(geometry.settings.box.height - geometry.viewport.box.height).toBeLessThanOrEqual(11);

  for (const control of geometry.controls) {
    expect(control.left).toBeGreaterThanOrEqual(geometry.viewport.box.left - 1);
    expect(control.right).toBeLessThanOrEqual(geometry.viewport.box.right + 1);
    expect(control.top).toBeGreaterThanOrEqual(geometry.viewport.box.top - 1);
    expect(control.bottom).toBeLessThanOrEqual(geometry.viewport.box.bottom + 1);
  }

  if (geometry.settings.scrollHeight > geometry.settings.clientHeight + 1) {
    expect(geometry.settings.overflowY).toMatch(/auto|scroll/);
  }
}

/** A clipped transition viewport must leave the browser focus treatment visible. */
export async function expectSettingsFocusGutter(control: Locator): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  const gutter = await control.evaluate((element) => {
    const viewport = element.closest<HTMLElement>(".research-video-player__settings-viewport");
    const player = element.closest<HTMLElement>(".research-video-player");
    if (!viewport) throw new Error("Expected the focused settings control inside its viewport.");
    if (!player) throw new Error("Expected the focused settings control inside its player.");
    const controlBox = element.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    return {
      bottom: viewportBox.bottom - controlBox.bottom,
      left: controlBox.left - viewportBox.left,
      playerScrollLeft: player.scrollLeft,
      right: viewportBox.right - controlBox.right,
      top: controlBox.top - viewportBox.top
    };
  });

  expect(gutter.left).toBeGreaterThanOrEqual(4);
  expect(gutter.playerScrollLeft).toBe(0);
  expect(gutter.right).toBeGreaterThanOrEqual(4);
  expect(gutter.top).toBeGreaterThanOrEqual(4);
  expect(gutter.bottom).toBeGreaterThanOrEqual(4);
}
