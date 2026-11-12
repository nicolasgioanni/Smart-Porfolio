import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteNoScriptFallback } from "@/components/layout/RouteNoScriptFallback";

describe("RouteNoScriptFallback", () => {
  it("keeps a route-scoped server fallback ahead of the loading-boundary child", () => {
    const markup = renderToStaticMarkup(
      <RouteNoScriptFallback fallback={<h1>Server route content</h1>}>
        <div data-testid="loading-boundary">Route child</div>
      </RouteNoScriptFallback>
    );

    expect(markup).toContain("<noscript>");
    expect(markup).toContain("<h1>Server route content</h1>");
    expect(markup).toContain(".site-main > :not(noscript)");
    expect(markup.endsWith('</noscript><div data-testid="loading-boundary">Route child</div>')).toBe(true);
  });
});
