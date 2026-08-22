import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecommendationItem } from "@/content/types";
import { HomeRecommendations } from "@/components/portfolio/HomeRecommendations";
import { MOBILE_UI_QUERY, PHONE_HERO_QUERY } from "@/components/responsive/useMediaQuery";

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

function installMatchMedia(initialMobileMatch = false, initialPhoneMatch = false) {
  let mobileMatches = initialMobileMatch;
  let phoneMatches = initialPhoneMatch;
  const mobileListeners = new Set<(event: MediaQueryListEvent) => void>();
  const phoneListeners = new Set<(event: MediaQueryListEvent) => void>();
  const mobileQuery = {
    get matches() {
      return mobileMatches;
    },
    media: MOBILE_UI_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      mobileListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      mobileListeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      mobileListeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      mobileListeners.delete(listener);
    },
    dispatchEvent: () => true
  } as unknown as MediaQueryList;
  const phoneQuery = {
    get matches() {
      return phoneMatches;
    },
    media: PHONE_HERO_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      phoneListeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      phoneListeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      phoneListeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      phoneListeners.delete(listener);
    },
    dispatchEvent: () => true
  } as unknown as MediaQueryList;
  const reducedMotionQuery = {
    matches: false,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => true
  } as unknown as MediaQueryList;

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      if (query === MOBILE_UI_QUERY) return mobileQuery;
      if (query === PHONE_HERO_QUERY) return phoneQuery;
      return reducedMotionQuery;
    })
  );

  return {
    listenerCount: () => mobileListeners.size + phoneListeners.size,
    setMobileMatch(matches: boolean) {
      mobileMatches = matches;
      const event = { matches, media: MOBILE_UI_QUERY } as MediaQueryListEvent;

      act(() => {
        for (const listener of mobileListeners) listener(event);
      });
    },
    setPhoneMatch(matches: boolean) {
      phoneMatches = matches;
      const event = { matches, media: PHONE_HERO_QUERY } as MediaQueryListEvent;

      act(() => {
        for (const listener of phoneListeners) listener(event);
      });
    }
  };
}

function createRecommendations(): RecommendationItem[] {
  return [
    recommendation,
    {
      ...recommendation,
      id: "recommendation-b",
      recommenderName: "Jordan Peer",
      linkedinUrl: "https://www.linkedin.com/in/jordan-peer/details/recommendations/"
    }
  ];
}

describe("Home recommendation overflow layout", () => {
  const resizeCallbacks: ResizeObserverCallback[] = [];
  let actualHomeHeight = 258;
  let animationFrameId = 0;
  let responsiveMode: ReturnType<typeof installMatchMedia>;

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
    responsiveMode = installMatchMedia();

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
        private readonly callback: ResizeObserverCallback;

        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
          resizeCallbacks.push(callback);
        }

        disconnect() {
          const callbackIndex = resizeCallbacks.indexOf(this.callback);

          if (callbackIndex >= 0) resizeCallbacks.splice(callbackIndex, 1);
        }
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
    const recommendations = createRecommendations();
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
    expect(responsiveMode.listenerCount()).toBe(0);
  });

  it("keeps expanded cards in natural document flow in mobile UI mode", async () => {
    responsiveMode.setMobileMatch(true);
    const { container } = render(
      <section className="home-section home-section--recommendations">
        <div className="home-section__surface">
          <header className="home-section__header">Recommendations</header>
          <HomeRecommendations items={createRecommendations()} showAction={false} />
        </div>
      </section>
    );
    const section = container.querySelector<HTMLElement>(".home-section--recommendations");
    const cards = Array.from(container.querySelectorAll<HTMLElement>(".recommendation-card"));
    const expanders = Array.from(container.querySelectorAll<HTMLElement>(".recommendation-expandable"));

    await waitFor(() => {
      expect(window.matchMedia).toHaveBeenCalledWith(MOBILE_UI_QUERY);
      expect(section).not.toHaveAttribute("data-recommendation-overflow-layout");
      expect(section?.style.getPropertyValue("--home-recommendations-panel-height")).toBe("");
      expect(section?.style.getPropertyValue("--home-recommendations-overflow-reserve")).toBe("");
    });

    fireEvent.click(
      within(cards[0]!).getByRole("button", {
        name: /show more recommendation from alex manager/i
      })
    );
    actualHomeHeight = 410;
    triggerResizeObservers();

    await waitFor(() => {
      expect(expanders.map((expander) => expander.dataset.expanded)).toEqual(["true", "false"]);
      expect(section).not.toHaveAttribute("data-recommendation-overflow-layout");
      expect(section?.style.getPropertyValue("--home-recommendations-panel-height")).toBe("");
      expect(section?.style.getPropertyValue("--home-recommendations-overflow-reserve")).toBe("");
    });
  });

  it("uses four-line previews without shared row heights in the single-column phone layout", async () => {
    responsiveMode.setMobileMatch(true);
    responsiveMode.setPhoneMatch(true);
    const { container } = render(
      <section className="home-section home-section--recommendations">
        <div className="home-section__surface">
          <header className="home-section__header">Recommendations</header>
          <HomeRecommendations items={createRecommendations()} showAction={false} />
        </div>
      </section>
    );
    const items = Array.from(container.querySelectorAll<HTMLElement>(".home-recommendations__item"));
    const expanders = Array.from(container.querySelectorAll<HTMLElement>(".recommendation-expandable"));

    await waitFor(() => {
      expect(expanders.map((expander) => expander.dataset.collapsedLines)).toEqual(["4", "4"]);
      expect(
        items.map((item) => item.style.getPropertyValue("--recommendation-row-collapsed-height"))
      ).toEqual(["", ""]);
    });
  });

  it("clears desktop overflow sizing on mobile and remeasures when desktop returns", async () => {
    const { container } = render(
      <section className="home-section home-section--recommendations">
        <div className="home-section__surface">
          <header className="home-section__header">Recommendations</header>
          <HomeRecommendations items={createRecommendations()} showAction={false} />
        </div>
      </section>
    );
    const section = container.querySelector<HTMLElement>(".home-section--recommendations");

    await waitFor(() => {
      expect(section).toHaveAttribute("data-recommendation-overflow-layout", "ready");
      expect(section?.style.getPropertyValue("--home-recommendations-panel-height")).toBe("298px");
    });

    responsiveMode.setMobileMatch(true);

    await waitFor(() => {
      expect(section).not.toHaveAttribute("data-recommendation-overflow-layout");
      expect(section?.style.getPropertyValue("--home-recommendations-panel-height")).toBe("");
      expect(section?.style.getPropertyValue("--home-recommendations-overflow-reserve")).toBe("");
    });

    const scheduledFramesBeforeDesktopReturn = vi.mocked(window.requestAnimationFrame).mock.calls.length;
    responsiveMode.setMobileMatch(false);

    await waitFor(() => {
      expect(section).toHaveAttribute("data-recommendation-overflow-layout", "ready");
      expect(section?.style.getPropertyValue("--home-recommendations-panel-height")).toBe("298px");
      expect(section?.style.getPropertyValue("--home-recommendations-overflow-reserve")).toBe("0px");
      expect(vi.mocked(window.requestAnimationFrame).mock.calls.length).toBeGreaterThan(
        scheduledFramesBeforeDesktopReturn
      );
    });
  });
});
