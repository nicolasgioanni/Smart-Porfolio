import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecommendationItem } from "@/content/types";
import { RecommendationsList } from "@/components/portfolio/RecommendationsList";
import { MOBILE_UI_QUERY } from "@/components/responsive/useMediaQuery";

const linkedInRecommendationsUrl =
  "https://www.linkedin.com/in/nicolas-gioanni/details/recommendations/";
const longQuote =
  "Nicolas consistently translated ambiguous research needs into clear, maintainable software while communicating thoughtfully across disciplines. ".repeat(
    4
  );

const recommendation: RecommendationItem = {
  id: "recommendation-a",
  recommenderName: "Alex Manager",
  recommenderTitle: "Engineering Manager",
  recommenderOrganization: "Example Company",
  relationship: "Managed Nicolas directly.",
  recommendationDate: "2025-09",
  source: "LinkedIn",
  sourceUrl: linkedInRecommendationsUrl,
  linkedinUrl: "https://www.linkedin.com/in/alex-manager/",
  fullQuote: longQuote,
  featured: true,
  showOnHome: true,
  homeOrder: 1,
  detailOrder: 1,
  skills: []
};

function createRecommendations(): RecommendationItem[] {
  return [
    recommendation,
    {
      ...recommendation,
      id: "recommendation-b",
      recommenderName: "Blair Professor",
      linkedinUrl: "https://www.linkedin.com/in/blair-professor/",
      homeOrder: 2,
      detailOrder: 2
    },
    {
      ...recommendation,
      id: "recommendation-c",
      recommenderName: "Casey Collaborator",
      linkedinUrl: "https://www.linkedin.com/in/casey-collaborator/",
      homeOrder: 3,
      detailOrder: 3
    },
    {
      ...recommendation,
      id: "recommendation-d",
      recommenderName: "Devon Teammate",
      linkedinUrl: "https://www.linkedin.com/in/devon-teammate/",
      homeOrder: 4,
      detailOrder: 4
    }
  ];
}

function createRect({
  height,
  left,
  top,
  width = 300
}: {
  height: number;
  left: number;
  top: number;
  width?: number;
}): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    toJSON: () => ({}),
    top,
    width,
    x: left,
    y: top
  } as DOMRect;
}

function installResponsiveMode(initialNaturalFlow = false) {
  let matches = initialNaturalFlow;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: MOBILE_UI_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
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
    vi.fn((query: string) => (query === MOBILE_UI_QUERY ? mediaQuery : reducedMotionQuery))
  );

  return {
    listenerCount: () => listeners.size,
    setNaturalFlow(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media: MOBILE_UI_QUERY } as MediaQueryListEvent;

      act(() => {
        listeners.forEach((listener) => listener(event));
      });
    }
  };
}

describe("RecommendationsList expansion layout", () => {
  let animationFrameId = 0;
  let responsiveMode: ReturnType<typeof installResponsiveMode>;

  beforeEach(() => {
    animationFrameId = 0;
    responsiveMode = installResponsiveMode();

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("featured-grid")) {
        return createRect({ height: 424, left: 0, top: 0, width: 620 });
      }

      if (this.classList.contains("recommendation-card--detail")) {
        const slot = this.closest<HTMLElement>(".recommendations-list__item");
        const id = slot?.dataset.recommendationId ?? "";
        const column = id === "recommendation-b" || id === "recommendation-d" ? 1 : 0;
        const row = id === "recommendation-c" || id === "recommendation-d" ? 1 : 0;
        const expanded = slot?.dataset.expanded === "true";

        return createRect({
          height: expanded ? 500 : 200,
          left: column * 320,
          top: row * 224
        });
      }

      return createRect({ height: 0, left: 0, top: 0 });
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

  it("keeps one desktop overlay active and dims only cards its rectangle covers", async () => {
    const { container } = render(<RecommendationsList items={createRecommendations()} />);
    const root = container.querySelector<HTMLElement>(".recommendations-list");
    const slots = Array.from(container.querySelectorAll<HTMLElement>(".recommendations-list__item"));

    await waitFor(() => {
      expect(root).toHaveAttribute("data-layout-mode", "overlay");
      expect(root).toHaveAttribute("data-overlay-ready", "true");
      expect(slots.map((slot) => slot.style.getPropertyValue("--recommendation-detail-collapsed-height"))).toEqual([
        "200px",
        "200px",
        "200px",
        "200px"
      ]);
    });

    fireEvent.click(within(slots[0]!).getByRole("button", { name: /show more recommendation from alex manager/i }));

    await waitFor(() => {
      expect(slots.map((slot) => slot.dataset.expanded)).toEqual(["true", "false", "false", "false"]);
      expect(slots.map((slot) => slot.dataset.overlapped)).toEqual(["false", "false", "true", "false"]);
      expect(root?.style.getPropertyValue("--recommendations-overlay-reserve")).toBe("76px");
    });

    fireEvent.click(
      within(slots[1]!).getByRole("button", { name: /show more recommendation from blair professor/i })
    );

    await waitFor(() => {
      expect(slots.map((slot) => slot.dataset.expanded)).toEqual(["false", "true", "false", "false"]);
      expect(slots.map((slot) => slot.dataset.overlapped)).toEqual(["false", "false", "false", "true"]);
      expect(root?.style.getPropertyValue("--recommendations-overlay-reserve")).toBe("76px");
    });
  });

  it("collapses on Escape with focus restored and when focus enters another card", async () => {
    const { container } = render(<RecommendationsList items={createRecommendations()} />);
    const slots = Array.from(container.querySelectorAll<HTMLElement>(".recommendations-list__item"));
    const firstToggle = within(slots[0]!).getByRole("button", {
      name: /show more recommendation from alex manager/i
    });

    fireEvent.click(firstToggle);
    await waitFor(() => expect(slots[0]).toHaveAttribute("data-expanded", "true"));

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(slots[0]).toHaveAttribute("data-expanded", "false");
      expect(document.activeElement).toBe(firstToggle);
    });

    fireEvent.click(firstToggle);
    await waitFor(() => expect(slots[0]).toHaveAttribute("data-expanded", "true"));

    const secondProfileLink = within(slots[1]!).getByRole("link", {
      name: "View Blair Professor's LinkedIn profile"
    });
    fireEvent.focus(secondProfileLink);

    await waitFor(() => {
      expect(slots.map((slot) => slot.dataset.expanded)).toEqual(["false", "false", "false", "false"]);
      expect(slots.map((slot) => slot.dataset.overlapped)).toEqual(["false", "false", "false", "false"]);
    });
  });

  it("uses natural flow without overlap geometry at 980px and below", async () => {
    responsiveMode.setNaturalFlow(true);
    const { container, unmount } = render(<RecommendationsList items={createRecommendations()} />);
    const root = container.querySelector<HTMLElement>(".recommendations-list");
    const slots = Array.from(container.querySelectorAll<HTMLElement>(".recommendations-list__item"));

    await waitFor(() => {
      expect(root).toHaveAttribute("data-layout-mode", "natural");
      expect(root).toHaveAttribute("data-overlay-ready", "false");
      expect(root?.style.getPropertyValue("--recommendations-overlay-reserve")).toBe("0px");
      expect(slots.every((slot) => slot.style.getPropertyValue("--recommendation-detail-collapsed-height") === "")).toBe(
        true
      );
    });

    fireEvent.click(within(slots[0]!).getByRole("button", { name: /show more recommendation from alex manager/i }));
    fireEvent.click(
      within(slots[1]!).getByRole("button", { name: /show more recommendation from blair professor/i })
    );

    await waitFor(() => {
      expect(slots.map((slot) => slot.dataset.expanded)).toEqual(["false", "true", "false", "false"]);
      expect(slots.map((slot) => slot.dataset.overlapped)).toEqual(["false", "false", "false", "false"]);
      expect(root?.style.getPropertyValue("--recommendations-overlay-reserve")).toBe("0px");
    });

    unmount();
    expect(responsiveMode.listenerCount()).toBe(0);
  });
});
