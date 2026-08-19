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

  it("renders the configured quote label once as a safe external link without changing the quote text", () => {
    const quote =
      "Nicolas has worked with me on an open source project, CytoCV, in collaboration with biologists at the University of Utah.";
    const { container } = render(
      <ExpandableRecommendationText
        fullQuoteLink={{ label: "CytoCV", url: "https://github.com/BrentLagesse/CytoCV" }}
        id="brent-lagesse"
        quote={quote}
        recommenderName="Brent Lagesse"
      />
    );
    const quoteElement = container.querySelector("blockquote");
    const link = screen.getByRole("link", { name: "CytoCV" });

    expect(quoteElement).toHaveTextContent(quote);
    expect(quoteElement?.querySelectorAll("a")).toHaveLength(1);
    expect(link).toHaveClass("recommendation-expandable__inline-link");
    expect(link).toHaveAttribute("href", "https://github.com/BrentLagesse/CytoCV");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps unconfigured URLs as plain quote text instead of auto-linking them", () => {
    const quote = "Project details are available at https://example.com/recommendation.";
    const { container } = render(
      <ExpandableRecommendationText id="plain-url" quote={quote} recommenderName="Alex Manager" />
    );

    expect(container.querySelector("blockquote")).toHaveTextContent(quote);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("omits the toggle when a quote fits within four lines", () => {
    const { container } = render(
      <ExpandableRecommendationText id="short" quote="A thoughtful and reliable collaborator." recommenderName="Alex Manager" />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".recommendation-expandable")).toHaveAttribute("data-can-expand", "false");
  });

  it("supports a three-line preview and remeasures when the line count changes", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(240);
    const { container, rerender } = render(
      <ExpandableRecommendationText
        collapsedLineCount={3}
        id="adaptive"
        quote="A measured recommendation that remains complete while its collapsed viewport changes."
        recommenderName="Taylor Collaborator"
      />
    );
    const root = container.querySelector<HTMLElement>(".recommendation-expandable");

    await waitFor(() => {
      expect(root).toHaveAttribute("data-collapsed-lines", "3");
      expect(root?.style.getPropertyValue("--recommendation-collapsed-height")).toBe("72px");
    });

    rerender(
      <ExpandableRecommendationText
        collapsedLineCount={4}
        id="adaptive"
        quote="A measured recommendation that remains complete while its collapsed viewport changes."
        recommenderName="Taylor Collaborator"
      />
    );

    await waitFor(() => {
      expect(root).toHaveAttribute("data-collapsed-lines", "4");
      expect(root?.style.getPropertyValue("--recommendation-collapsed-height")).toBe("96px");
    });
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
