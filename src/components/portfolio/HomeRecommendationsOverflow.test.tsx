import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecommendationItem } from "@/content/types";
import { HomeRecommendations } from "@/components/portfolio/HomeRecommendations";

const recommendation: RecommendationItem = {
  id: "recommendation-a",
  recommenderName: "Alex Manager",
  recommenderTitle: "Engineering Manager",
  recommenderOrganization: "Example Company",
  relationship: "Managed the internship project.",
  recommendationDate: "2025-09",
  source: "LinkedIn",
  sourceUrl: "https://www.linkedin.com/in/example",
  linkedinUrl: "https://www.linkedin.com/in/example/details/recommendations/",
  fullQuote:
    "A thoughtful engineer who communicates clearly and turns ambiguous product goals into maintainable software. ".repeat(
      4
    ),
  featured: true,
  showOnHome: true,
  homeOrder: 1,
  detailOrder: 1,
  skills: []
};

function createRect(height: number, top = 0): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 320,
    toJSON: () => ({}),
    top,
    width: 320,
    x: 0,
    y: top
  } as DOMRect;
}

describe("Home recommendation overflow layout", () => {
  const resizeCallbacks: ResizeObserverCallback[] = [];
  let actualHomeHeight = 258;
  let animationFrameId = 0;

  function triggerResizeObservers() {
    act(() => {
      for (const callback of resizeCallbacks) {
        callback([], {} as ResizeObserver);
      }
    });
  }

  beforeEach(() => {
    actualHomeHeight = 258;
    animationFrameId = 0;
    resizeCallbacks.length = 0;

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("home-recommendations")) return createRect(actualHomeHeight);
      if (this.classList.contains("home-section__header")) return createRect(40);
      if (this.classList.contains("recommendation-card__header")) return createRect(90);
      if (this.classList.contains("recommendation-expandable__quote")) return createRect(240);
      if (this.classList.contains("recommendation-expandable__toggle")) return createRect(36);
      if (this.classList.contains("recommendation-card__links")) return createRect(36);
      return createRect(0);
    });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function getScrollHeight(this: HTMLElement) {
      return this.classList.contains("recommendation-expandable__quote") ? 240 : 0;
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameId += 1;
      callback(performance.now());
      return animationFrameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback);
        }

        disconnect() {}
        observe() {}
        unobserve() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fixes the outer panel and reserves only the selected card overflow", async () => {
    const recommendations = [
      recommendation,
      {
        ...recommendation,
        id: "recommendation-b",
        recommenderName: "Jordan Peer",
        linkedinUrl: "https://www.linkedin.com/in/jordan-peer/details/recommendations/"
      }
    ];
    const { container, unmount } = render(
      <section className="home-section home-section--recommendations">
        <div className="home-section__surface">
          <header className="home-section__header">Recommendations</header>
          <HomeRecommendations items={recommendations} showAction={false} />
        </div>
      </section>
    );
    const section = container.querySelector<HTMLElement>(".home-section--recommendations");
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".recommendation-card"));
    const expanders = Array.from(container.querySelectorAll<HTMLElement>(".recommendation-expandable"));

    await waitFor(() => {
      expect(section).toHaveAttribute("data-recommendation-overflow-layout", "ready");
      expect(section?.style.getPropertyValue("--home-recommendations-panel-height")).toBe("298px");
      expect(section?.style.getPropertyValue("--home-recommendations-overflow-reserve")).toBe("0px");
    });

    const firstToggle = within(cards[0]!).getByRole("button", {
      name: /show more recommendation from alex manager/i
    });
    fireEvent.click(firstToggle);
    actualHomeHeight = 410;
    triggerResizeObservers();

    await waitFor(() => {
      expect(expanders.map((expander) => expander.dataset.expanded)).toEqual(["true", "false"]);
      expect(section?.style.getPropertyValue("--home-recommendations-panel-height")).toBe("298px");
      expect(section?.style.getPropertyValue("--home-recommendations-overflow-reserve")).toBe("152px");
    });

    fireEvent.click(firstToggle);
    actualHomeHeight = 258;
    triggerResizeObservers();

    await waitFor(() => {
      expect(expanders.map((expander) => expander.dataset.expanded)).toEqual(["false", "false"]);
      expect(section?.style.getPropertyValue("--home-recommendations-overflow-reserve")).toBe("0px");
    });

    unmount();
    expect(section).not.toHaveAttribute("data-recommendation-overflow-layout");
    expect(section?.style.getPropertyValue("--home-recommendations-panel-height")).toBe("");
    expect(section?.style.getPropertyValue("--home-recommendations-overflow-reserve")).toBe("");
  });
});
