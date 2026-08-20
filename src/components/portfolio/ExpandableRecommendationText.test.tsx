import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpandableRecommendationText } from "@/components/portfolio/ExpandableRecommendationText";

const longQuote =
  "Nicolas consistently translated ambiguous research needs into clear, maintainable software while communicating thoughtfully across disciplines. " +
  "He anticipated risks, documented decisions carefully, and delivered reliable work that made the entire team more effective.";

function installReducedMotionPreference(matches: boolean) {
  const mediaQuery = {
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn()
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
}

describe("ExpandableRecommendationText", () => {
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    observe.mockReset();
    disconnect.mockReset();
    installReducedMotionPreference(false);
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        observe = observe;
        disconnect = disconnect;
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the full quote once and toggles the same controlled region", () => {
    const { container } = render(
      <ExpandableRecommendationText id="brent-lagesse" quote={longQuote} recommenderName="Brent Lagesse" />
    );
    const root = container.querySelector(".recommendation-expandable");
    const quote = container.querySelector("blockquote");
    const button = screen.getByRole("button", { name: /show more recommendation from brent lagesse/i });

    expect(screen.getAllByText(longQuote)).toHaveLength(1);
    expect(quote).toHaveClass("recommendation-expandable__quote");
    expect(root).toHaveAttribute("data-collapsed-lines", "4");
    expect(root).toHaveAttribute("data-expanded", "false");
    expect(button).toHaveTextContent("Show more");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "recommendation-brent-lagesse-quote");

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /show less recommendation from brent lagesse/i })).toBe(button);
    expect(button).toHaveTextContent("Show less");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(root).toHaveAttribute("data-expanded", "true");

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /show more recommendation from brent lagesse/i })).toBe(button);
    expect(root).toHaveAttribute("data-expanded", "false");
  });

  it("omits the toggle when a quote fits within four lines", () => {
    const { container } = render(
      <ExpandableRecommendationText id="short" quote="A thoughtful and reliable collaborator." recommenderName="Alex Manager" />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".recommendation-expandable")).toHaveAttribute("data-can-expand", "false");
  });

  it("uses measured overflow, exposes reduced motion, and cleans up its observer", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(240);
    vi.unstubAllGlobals();
    installReducedMotionPreference(true);
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        observe = observe;
        disconnect = disconnect;
      }
    );

    const { container, unmount } = render(
      <ExpandableRecommendationText id="measured" quote="Measured quote." recommenderName="Jordan Peer" />
    );

    await waitFor(() => {
      expect(container.querySelector(".recommendation-expandable")).toHaveAttribute("data-measured", "true");
      expect(container.querySelector(".recommendation-expandable")).toHaveAttribute("data-reduced-motion", "true");
    });
    expect(screen.getByRole("button", { name: /show more recommendation from jordan peer/i })).toBeInTheDocument();
    expect(observe).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
