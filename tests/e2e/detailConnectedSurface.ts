import { expect, type Locator, type Page } from "./browserTest";
import { settleDetailPanelMotion } from "./detailOverlay";
import { settleLayout } from "./settleLayout";
import { reloadWithStoredTheme } from "./themePreference";

type ConnectedDetailSurfaceOptions = {
  cardSelector: string;
  pathname: string;
};

type ConnectedDetail = {
  card: Locator;
  cardSelector: string;
  panel: Locator;
  section: Locator;
  trigger: Locator;
};

type SurfaceSnapshot = {
  cardBackground: string;
  panelBackground: string;
  panelBottomBorder: string;
  panelBoxShadow: string;
  panelLeftBorder: string;
  panelRadius: string;
  panelTop: number;
  panelTopBorder: string;
  panelTopLeftRadius: string;
  separatorOpacity: string;
  triggerBackground: string;
  triggerBottomLeftRadius: string;
  triggerBottomRightRadius: string;
  triggerBoxShadow: string;
  triggerBottom: number;
  triggerFocusVisible: boolean;
  triggerTopLeftRadius: string;
};

async function findLastExpandableDetail(page: Page, cardSelector: string): Promise<ConnectedDetail | undefined> {
  const cards = page.locator(cardSelector);

  for (let cardIndex = 0; cardIndex < (await cards.count()); cardIndex += 1) {
    const card = cards.nth(cardIndex);
    const triggers = card.locator("button.detail-section__trigger");
    const count = await triggers.count();
    if (count === 0) continue;

    const trigger = triggers.nth(count - 1);
    const panelId = await trigger.getAttribute("aria-controls");
    if (!panelId) throw new Error("The last expandable detail trigger needs an aria-controls target.");

    return {
      card,
      cardSelector,
      panel: page.locator(`#${panelId}`),
      section: trigger.locator(".."),
      trigger
    };
  }

  return undefined;
}

async function readSurfaceSnapshot(detail: ConnectedDetail): Promise<SurfaceSnapshot> {
  return detail.panel.evaluate((panel, cardSelector) => {
    const trigger = panel.previousElementSibling;
    const section = panel.parentElement;
    const card = panel.closest(cardSelector);
    if (!(trigger instanceof HTMLElement) || !(section instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      throw new Error("The connected detail surface is missing a trigger, section, or card.");
    }

    const panelStyles = getComputedStyle(panel);
    const triggerStyles = getComputedStyle(trigger);
    const cardStyles = getComputedStyle(card);
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    return {
      cardBackground: cardStyles.backgroundColor,
      panelBackground: panelStyles.backgroundColor,
      panelBottomBorder: panelStyles.borderBottomWidth,
      panelBoxShadow: panelStyles.boxShadow,
      panelLeftBorder: panelStyles.borderLeftWidth,
      panelRadius: panelStyles.borderRadius,
      panelTop: panelRect.top,
      panelTopBorder: panelStyles.borderTopWidth,
      panelTopLeftRadius: panelStyles.borderTopLeftRadius,
      separatorOpacity: getComputedStyle(section, "::before").opacity,
      triggerBackground: triggerStyles.backgroundColor,
      triggerBottomLeftRadius: triggerStyles.borderBottomLeftRadius,
      triggerBottomRightRadius: triggerStyles.borderBottomRightRadius,
      triggerBoxShadow: triggerStyles.boxShadow,
      triggerBottom: triggerRect.bottom,
      triggerFocusVisible: trigger.matches(":focus-visible"),
      triggerTopLeftRadius: triggerStyles.borderTopLeftRadius
    };
  }, detail.cardSelector);
}

function expectConnectedSurface(snapshot: SurfaceSnapshot) {
  expect(snapshot.triggerBackground).toBe(snapshot.cardBackground);
  expect(snapshot.panelBackground).toBe(snapshot.cardBackground);
  expect(snapshot.triggerBottomLeftRadius).toBe("0px");
  expect(snapshot.triggerBottomRightRadius).toBe("0px");
  expect(snapshot.triggerTopLeftRadius).not.toBe("0px");
  expect(snapshot.panelTopBorder).toBe("0px");
  expect(snapshot.panelLeftBorder).toBe("1px");
  expect(snapshot.panelBottomBorder).toBe("1px");
  expect(snapshot.panelTopLeftRadius).toBe("0px");
  expect(snapshot.panelRadius).toMatch(/^0px 0px /);
  expect(snapshot.panelBoxShadow).toBe("none");
  expect(snapshot.separatorOpacity).toBe("0");
  expect(Math.abs(snapshot.panelTop - snapshot.triggerBottom)).toBeLessThanOrEqual(1);
}

export async function expectConnectedDetailSurfaceAcrossPalettes(
  page: Page,
  options: ConnectedDetailSurfaceOptions
): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(options.pathname);
  await settleLayout(page);

  if (!(await findLastExpandableDetail(page, options.cardSelector))) return false;

  for (const theme of ["navy", "light", "dark"] as const) {
    await reloadWithStoredTheme(page, theme);

    for (const glassEffects of ["true", "false"] as const) {
      await page.locator(".site-shell").evaluate((shell, value) => shell.setAttribute("data-glass-effects", value), glassEffects);
      const detail = await findLastExpandableDetail(page, options.cardSelector);
      if (!detail) throw new Error("The connected detail surface disappeared after a palette reload.");

      await detail.trigger.scrollIntoViewIfNeeded();
      await detail.trigger.focus();
      await page.keyboard.press("Enter");
      await expect(detail.section).toHaveAttribute("data-visual-state", "open");

      const opened = await readSurfaceSnapshot(detail);
      expectConnectedSurface(opened);
      expect(opened.triggerFocusVisible).toBe(true);
      expect(opened.triggerBoxShadow).toContain("rgb(");

      await settleDetailPanelMotion(detail.panel);
      expectConnectedSurface(await readSurfaceSnapshot(detail));

      const triggerBox = await detail.trigger.boundingBox();
      expect(triggerBox).not.toBeNull();
      await page.mouse.move(triggerBox!.x + triggerBox!.width / 2, triggerBox!.y + triggerBox!.height / 2);
      await expect.poll(() => detail.trigger.evaluate((trigger) => trigger.matches(":hover"))).toBe(true);
      expect((await readSurfaceSnapshot(detail)).triggerBackground).toBe(opened.triggerBackground);

      await detail.trigger.press("Escape");
      await expect(detail.section).toHaveAttribute("data-visual-state", "closing");
      expectConnectedSurface(await readSurfaceSnapshot(detail));

      await settleDetailPanelMotion(detail.panel);
      await expect(detail.section).toHaveAttribute("data-visual-state", "closed");
      await expect.poll(() =>
        detail.section.evaluate((section) => getComputedStyle(section, "::before").opacity)
      ).toBe("1");
    }
  }

  return true;
}

export async function expectConnectedDetailSurfaceResponsiveBoundary(
  page: Page,
  options: ConnectedDetailSurfaceOptions
): Promise<boolean> {
  for (const width of [981, 980, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(options.pathname);
    await settleLayout(page);

    const detail = await findLastExpandableDetail(page, options.cardSelector);
    if (!detail) return false;

    await detail.trigger.scrollIntoViewIfNeeded();
    await detail.trigger.click();
    await expect(detail.section).toHaveAttribute("data-visual-state", "open");
    await expect(detail.panel).toHaveCSS("position", width === 981 ? "absolute" : "static");
    expectConnectedSurface(await readSurfaceSnapshot(detail));

    if (width === 981) {
      await expect(detail.card).toHaveCSS("overflow", "visible");
      await expect.poll(() =>
        detail.panel.evaluate((panel) => {
          const section = panel.parentElement;
          return Boolean(section && panel.getBoundingClientRect().bottom > section.getBoundingClientRect().bottom + 1);
        })
      ).toBe(true);
    }

    if (width === 390) {
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
        )
        .toBe(true);
    }
  }

  return true;
}

export async function expectReducedMotionConnectedDetailSurface(
  page: Page,
  options: ConnectedDetailSurfaceOptions
): Promise<boolean> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(options.pathname);
  await settleLayout(page);

  const detail = await findLastExpandableDetail(page, options.cardSelector);
  if (!detail) return false;

  await detail.trigger.scrollIntoViewIfNeeded();
  await detail.trigger.focus();
  await page.keyboard.press("Enter");
  await expect(detail.section).toHaveAttribute("data-visual-state", "open");
  expectConnectedSurface(await readSurfaceSnapshot(detail));
  await expect(detail.panel).toHaveCSS("transition-duration", "0s");

  return true;
}
