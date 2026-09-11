import type { Page } from "@playwright/test";

const browserIssues = new WeakMap<Page, string[]>();
const allowedMessages = new WeakMap<Page, RegExp[]>();

export function allowBrowserConsoleMessage(page: Page, pattern: RegExp) {
  const allowed = allowedMessages.get(page) ?? [];
  allowed.push(pattern);
  allowedMessages.set(page, allowed);
}

export function captureBrowserConsole(page: Page) {
  const issues: string[] = [];
  browserIssues.set(page, issues);

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      if ((allowedMessages.get(page) ?? []).some((pattern) => pattern.test(message.text()))) return;
      issues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
}

export function expectNoBrowserConsoleIssues(page: Page) {
  const issues = browserIssues.get(page) ?? [];

  if (issues.length > 0) {
    throw new Error(`Unexpected browser console output:\n${issues.join("\n")}`);
  }
}
