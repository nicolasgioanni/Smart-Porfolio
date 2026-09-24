import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResearchNoScriptRouteGate } from "@/components/layout/ResearchNoScriptRouteGate";

const route = vi.hoisted(() => ({ pathname: "/research" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

describe("ResearchNoScriptRouteGate", () => {
  it("server-renders an inert Research fallback without wrapping the regular route body", () => {
    route.pathname = "/research";
    const markup = renderToStaticMarkup(
      <ResearchNoScriptRouteGate fallback={<p>Native fallback</p>}>
        <section>Regular route body</section>
      </ResearchNoScriptRouteGate>
    );
    expect(markup).toContain("<noscript>");
    expect(markup).toContain("<p>Native fallback</p>");
    expect(markup).toContain(".site-main > :not(noscript)");
    expect(markup.endsWith("</noscript><section>Regular route body</section>")).toBe(true);
  });

  it("leaves other route output unchanged", () => {
    route.pathname = "/projects";
    expect(renderToStaticMarkup(
      <ResearchNoScriptRouteGate fallback={<p>Native fallback</p>}>
        <section>Regular route body</section>
      </ResearchNoScriptRouteGate>
    )).toBe("<section>Regular route body</section>");
  });
});
