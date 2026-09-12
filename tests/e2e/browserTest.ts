import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

type TurnstileOptions = {
  callback: (token: string) => void;
};

type TurnstileWidget = {
  container: HTMLElement;
  options: TurnstileOptions;
};

async function installTurnstileMock(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", (route) =>
    route.fulfill({ body: "", contentType: "application/javascript", status: 200 })
  );

  await page.addInitScript(() => {
    type TestWindow = Window & {
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
      button.addEventListener("click", () => widget.options.callback(`test-turnstile-token-${sequence}`));
      widget.container.replaceChildren(button);
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
        widgets.delete(widgetId);
      }
    };
  });
}

export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    await installTurnstileMock(page);
    await runWithPage(page);
  }
});

export { expect };
export type { Locator, Page, Request, Response, Route } from "@playwright/test";
