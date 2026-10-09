import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StaticPortfolioRouteGate } from "@/components/layout/StaticPortfolioRouteGate";

const route = vi.hoisted(() => ({ pathname: "/research" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

describe("StaticPortfolioRouteGate", () => {
  it("server-renders an inert Research fallback without wrapping the regular route body", () => {
    route.pathname = "/research";
    const markup = renderToStaticMarkup(
      <StaticPortfolioRouteGate projectsFallback={<p>Native projects fallback</p>} researchFallback={<p>Native fallback</p>}>
        <section>Regular route body</section>
      </StaticPortfolioRouteGate>
    );
    expect(markup).toContain("<noscript>");
    expect(markup).toContain("<p>Native fallback</p>");
    expect(markup).toContain(".site-main > :not(noscript)");
    expect(markup.endsWith("</noscript><section>Regular route body</section>")).toBe(true);
  });

  it("server-renders a Projects fallback when one is provided", () => {
    route.pathname = "/projects";
    expect(renderToStaticMarkup(
      <StaticPortfolioRouteGate projectsFallback={<p>Native projects fallback</p>} researchFallback={<p>Native research fallback</p>}>
        <section>Regular route body</section>
      </StaticPortfolioRouteGate>
    )).toContain("Native projects fallback");
  });

  it("leaves unrelated route output unchanged", () => {
    route.pathname = "/contact";
    expect(renderToStaticMarkup(
      <StaticPortfolioRouteGate projectsFallback={<p>Native projects fallback</p>} researchFallback={<p>Native fallback</p>}>
        <section>Regular route body</section>
      </StaticPortfolioRouteGate>
    )).toBe("<section>Regular route body</section>");
  });
});
