import { expect, test } from "./browserTest";

test.describe("progressive enhancement", () => {
  test("keeps every route's server content, Research media, and footer navigation available without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    try {
      const routes = [
        ["/", /^Hi, I’m/],
        ["/experience", "Experience"],
        ["/research", "Applied AI Research"],
        ["/projects", "Projects"],
        ["/recommendations", "Recommendations"],
        ["/resume", "Resume"],
        ["/contact", "Contact"],
        ["/contact-terms", "Contact & Communication Terms"],
        ["/terms", "Site Terms & Accuracy Notice"],
        ["/privacy", "Privacy Notice"],
        ["/security", "Security & Responsible Disclosure"]
      ] as const;

      for (const [pathname, heading] of routes) {
        await page.goto(pathname);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      }

      await page.goto("/projects");
      const credit = page.getByRole("link", { name: "Parth Gupta" });
      await expect(credit).toBeVisible();
      await expect(credit).toHaveAttribute("href", "https://www.linkedin.com/in/parthgu/");
      await expect(credit).toHaveAttribute("target", "_blank");
      await expect(credit).toHaveAttribute("rel", /noopener/);
      await expect(credit).toHaveAttribute("rel", /noreferrer/);
      await expect(credit).toHaveCSS("text-decoration-line", "none");
      await expect(credit.locator("span")).toHaveCSS("text-decoration-line", "underline");
      await expect(credit.locator("svg")).toHaveAttribute("aria-hidden", "true");

      await page.goto("/research");
      await expect(page.locator("main video[controls]").first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Footer notices" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Footer resources" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("keeps shipped content and navigation readable when IntersectionObserver is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined });
    });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const reveal of await page.locator(".motion-reveal, .motion-compress").all()) {
      await expect(reveal).toHaveCSS("opacity", "1");
      await expect(reveal).not.toHaveClass(/motion-ready/);
    }
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  });
});
