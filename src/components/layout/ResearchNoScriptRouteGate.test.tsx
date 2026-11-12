import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResearchNoScriptRouteGate } from "@/components/layout/ResearchNoScriptRouteGate";

describe("ResearchNoScriptRouteGate", () => {
  it("server-renders an inert Research fallback without wrapping the regular route body", () => {
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
});
