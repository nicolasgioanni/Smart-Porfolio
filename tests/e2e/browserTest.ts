import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

type TurnstileOptions = {
  callback: (token: string) => void;
  size: "compact" | "flexible";
  theme: string;
  "error-callback": () => void;
  "expired-callback": () => void;
};

type TurnstileWidget = {
  container: HTMLElement;
  options: TurnstileOptions;
};

export async function installTurnstileMock(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", (route) =>
    route.fulfill({ body: "", contentType: "application/javascript", status: 200 })
  );

  await page.addInitScript(() => {
    type TestWindow = Window & {
      contactChallengeTest?: (event: "error" | "expired" | "shrink") => void;
      turnstile?: {
        remove: (widgetId: string) => void;
        render: (container: HTMLElement, options: TurnstileOptions) => string;
        reset: (widgetId: string) => void;
      };
    };

    const testWindow = window as TestWindow;
    const widgets = new Map<string, TurnstileWidget>();
    let sequence = 0;

    const renderChallenge = (widget: TurnstileWidget) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Complete test security check";
      button.style.width = widget.options.size === "compact" ? "150px" : "100%";
      button.style.height = widget.options.size === "compact" ? "140px" : "65px";
      button.dataset.size = widget.options.size;
      button.dataset.theme = widget.options.theme;
      button.addEventListener("click", () => widget.options.callback(`test-turnstile-token-${sequence}`));
      widget.container.replaceChildren(button);
    };

    testWindow.contactChallengeTest = (event) => {
      for (const widget of widgets.values()) {
        if (event === "shrink") widget.container.replaceChildren();
        else widget.options[event === "error" ? "error-callback" : "expired-callback"]();
      }
    };

    testWindow.turnstile = {
      render(container, options) {
        sequence += 1;
        const widgetId = `test-turnstile-${sequence}`;
        const widget = { container, options };
        widgets.set(widgetId, widget);
        renderChallenge(widget);
        return widgetId;
      },
      reset(widgetId) {
        const widget = widgets.get(widgetId);
        if (widget) renderChallenge(widget);
      },
      remove(widgetId) {
        widgets.get(widgetId)?.container.replaceChildren();
        widgets.delete(widgetId);
      }
    };
  });
}

/** Provider-owned lifecycle events without changing React-owned page state. */
export async function triggerContactChallenge(page: Page, event: "error" | "expired" | "shrink") {
  await page.evaluate((event) => {
    (window as Window & { contactChallengeTest?: (event: string) => void }).contactChallengeTest?.(event);
  }, event);
}

export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    await installTurnstileMock(page);
    await runWithPage(page);
  }
});

export { expect };
export type { Locator, Page, Request, Response, Route } from "@playwright/test";
