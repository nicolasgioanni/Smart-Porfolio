import { expect, type Page } from "@playwright/test";
import type { ThemeName } from "../../src/lib/theme/resolveThemeName";
import { themeLabels } from "../../src/lib/theme/themeOptions";
import { themeStorageKey } from "../../src/lib/theme/themePreference";
import { settleLayout } from "./settleLayout";

/**
 * Loads a palette through the production pre-hydration preference contract.
 *
 * The helper deliberately writes only the supported stored preference before
 * reload. ThemePreferenceScript and the hydrated controller remain the sole
 * owners of html[data-theme].
 */
export async function reloadWithStoredTheme(page: Page, theme: ThemeName): Promise<void> {
  await page.evaluate(
    ([storageKey, selectedTheme]) => window.localStorage.setItem(storageKey, selectedTheme),
    [themeStorageKey, theme]
  );
  await page.reload();
  await settleLayout(page);

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", theme);

  // Opening the native chooser confirms the client preference controller has
  // hydrated after the stored pre-navigation preference is resolved.
  const trigger = page.getByRole("button", { name: /choose color theme/i });
  await trigger.focus();
  await expect(page.getByRole("group", { name: "Color theme preference" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  // The trigger's permitted focus ring has a short exit transition. Let that
  // settle before callers sample palette shadows for decorative glow.
  await page.waitForTimeout(250);
}

/** Selects a manual palette through the hydrated, visible theme chooser. */
export async function selectThemeWithChooser(page: Page, theme: ThemeName): Promise<void> {
  const group = page.getByRole("group", { name: "Color theme preference" });
  if (!await group.isVisible()) {
    const trigger = page.getByRole("button", { name: /choose color theme/i });
    await trigger.focus();
  }

  await expect(group).toBeVisible();
  const option = group.getByRole("button", { name: themeLabels[theme], exact: true });
  await option.focus();
  await option.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}
