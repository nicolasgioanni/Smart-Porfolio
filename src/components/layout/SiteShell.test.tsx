import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SiteShell } from "@/components/layout/SiteShell";

vi.mock("@/components/layout/SiteHeader", () => ({ SiteHeader: () => <header>Header</header> }));
vi.mock("@/components/layout/SiteFooter", () => ({ SiteFooter: () => <footer>Footer</footer> }));

describe("SiteShell", () => {
  it("keeps unrelated route markup free of feature fallback composition", () => {
    const markup = renderToStaticMarkup(
      <SiteShell content={{ siteSettings: { enableGlassEffects: true } } as never} initialTheme="navy">
        <section>Privacy route body</section>
      </SiteShell>
    );

    expect(markup).toContain('<main class="site-main"><section>Privacy route body</section></main>');
    expect(markup).not.toContain("noscript");
  });
});
