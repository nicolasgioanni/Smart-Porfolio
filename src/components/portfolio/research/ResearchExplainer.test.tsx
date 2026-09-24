import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchExplainer } from "@/components/portfolio/research/ResearchExplainer";

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

let observerCallback: ObserverCallback | undefined;
let motionChangeListeners = new Set<() => void>();
let prefersReducedMotion = false;

class IntersectionObserverMock {
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }

  disconnect() {}

  observe() {}

  unobserve() {}

  takeRecords() {
    return [];
  }
}

function matchMedia(matches = false) {
  prefersReducedMotion = matches;
  motionChangeListeners = new Set();

  return vi.fn(() => ({
    addEventListener: (_eventName: string, listener: () => void) => motionChangeListeners.add(listener),
    get matches() {
      return prefersReducedMotion;
    },
    media: "(prefers-reduced-motion: reduce)",
    removeEventListener: (_eventName: string, listener: () => void) => motionChangeListeners.delete(listener)
  }));
}

function setReducedMotionPreference(reduced: boolean) {
  prefersReducedMotion = reduced;
  for (const listener of motionChangeListeners) listener();
}

describe("ResearchExplainer", () => {
  beforeEach(() => {
    observerCallback = undefined;
    vi.stubGlobal("matchMedia", matchMedia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    {
      description: "clean handwritten seven",
      imageName: "Illustrative binary detector training scene",
      labels: ["Clean image", "Altered copy", "Train with both", "Binarydetector", "Test image", "Clean or manipulated?"],
      title: "Can AI spot an altered image?",
      variant: "aml"
    },
    {
      description: "requested A to G change",
      imageName: "Guide and donor design scene",
      labels: ["Target DNA", "A → G", "Guide site", "Donor design", "Export designs", "Guide", "Donor"],
      title: "Design a DNA change",
      variant: "guide-donor"
    }
  ] as const)("server-renders the complete $variant connected scene without playback controls", ({ description, imageName, labels, title, variant }) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<ResearchExplainer variant={variant} />);
    const explainer = host.querySelector<HTMLElement>(`[data-research-explainer="${variant}"]`);

    expect(explainer).not.toBeNull();
    expect(explainer).toHaveAttribute("data-animation-ready", "false");
    expect(explainer).toHaveAttribute("data-playback", "complete");
    expect(explainer?.querySelectorAll(".research-explainer__phase")).toHaveLength(4);
    expect(explainer?.querySelectorAll(".research-explainer__scene")).toHaveLength(1);
    expect(explainer?.querySelector(".research-explainer__title")).toHaveTextContent(title);
    expect(explainer?.querySelector(".research-explainer__loop")).toHaveTextContent("Workflow overview");
    expect(Array.from(explainer?.querySelectorAll(".research-explainer__scene-label") ?? [], (label) => label.textContent)).toEqual(labels);
    expect(explainer?.querySelector(".research-explainer__steps")).toBeNull();
    expect(explainer?.querySelector("figcaption")?.textContent?.trim()).not.toBe("");

    const diagram = explainer?.querySelector("svg");
    expect(diagram).toHaveAttribute("aria-label", imageName);
    const descriptionId = diagram?.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(explainer?.querySelector(`#${descriptionId}`)).toHaveTextContent(description);
    expect(explainer?.querySelector("button.research-explainer__playback-control")).toBeNull();
  });

  it("keeps every scene and the complete explanatory copy available without playback support", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<ResearchExplainer variant="aml" />);
    const explainer = container.querySelector<HTMLElement>('[data-research-explainer="aml"]')!;

    expect(explainer).toHaveAttribute("data-playback", "complete");
    expect(explainer.querySelectorAll(".research-explainer__phase")).toHaveLength(4);
    expect(screen.getByRole("img", { name: "Illustrative binary detector training scene" })).toBeInTheDocument();
    expect(Array.from(explainer.querySelectorAll(".research-explainer__scene-label"), (label) => label.textContent)).toEqual([
      "Clean image",
      "Altered copy",
      "Train with both",
      "Binarydetector",
      "Test image",
      "Clean or manipulated?"
    ]);
    expect(screen.getByText("An illustrative experiment: train a detector using clean and manipulated digit images.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /altered image animation/i })).not.toBeInTheDocument();
  });

  it("runs only while its own viewport is visible and preserves an explicit pause", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    const { container } = render(<ResearchExplainer variant="guide-donor" />);
    const explainer = container.querySelector<HTMLElement>('[data-research-explainer="guide-donor"]')!;

    expect(explainer).toHaveAttribute("data-playback", "waiting");
    act(() => observerCallback?.([{ intersectionRatio: 0.25, isIntersecting: true } as IntersectionObserverEntry]));
    expect(explainer).toHaveAttribute("data-playback", "playing");
    expect(screen.getByText("12s loop")).toBeInTheDocument();

    const pause = screen.getByRole("button", { name: "Pause Design a DNA change animation" });
    fireEvent.click(pause);
    expect(explainer).toHaveAttribute("data-playback", "paused");
    expect(screen.getByRole("button", { name: "Resume Design a DNA change animation" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Guide and donor marker key" })).toHaveTextContent(
      "Requested changeOptional silent change"
    );

    act(() => observerCallback?.([{ intersectionRatio: 0, isIntersecting: false } as IntersectionObserverEntry]));
    expect(explainer).toHaveAttribute("data-playback", "paused");
    expect(explainer.querySelectorAll(".research-explainer__phase")).toHaveLength(4);
  });

  it("removes a focused reduced-motion control after it blurs before another preference change", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    const { container } = render(<ResearchExplainer variant="aml" />);

    act(() => observerCallback?.([{ intersectionRatio: 0.25, isIntersecting: true } as IntersectionObserverEntry]));
    const control = screen.getByRole("button", { name: "Pause Can AI spot an altered image? animation" });
    control.focus();
    expect(control).toHaveFocus();

    act(() => setReducedMotionPreference(true));
    expect(screen.getByRole("button", { name: /Can AI spot an altered image\? is static/i })).toBeInTheDocument();

    act(() => setReducedMotionPreference(false));
    act(() => container.querySelector<HTMLElement>(".research-explainer__viewport")?.focus());
    act(() => setReducedMotionPreference(true));

    expect(screen.queryByRole("button", { name: /Can AI spot an altered image\? is static/i })).not.toBeInTheDocument();
  });
});
