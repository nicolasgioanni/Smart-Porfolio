import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeEducationDetails } from "@/components/portfolio/home/HomeEducationDetails";

describe("HomeEducationDetails", () => {
  it("keeps bullets and native labels in the static markup without enhanced accessibility state", () => {
    const markup = renderToStaticMarkup(
      <HomeEducationDetails bullets={["GPA: 3.9/4.0", "Relevant coursework: Algorithms"]} institution="Example University" />
    );

    expect(markup).toContain("<details");
    expect(markup).toContain("Show more");
    expect(markup).toContain("Show less");
    expect(markup).toContain("GPA: 3.9/4.0");
    expect(markup).toContain("Relevant coursework: Algorithms");
    expect(markup).not.toContain("data-enhanced");
    expect(markup).not.toContain("aria-expanded");
    expect(markup).not.toContain("aria-hidden");
    expect(markup).not.toContain("inert");
  });

  it("keeps each native disclosure compact and independently operable when animation is unavailable", () => {
    const { container } = render(
      <>
        <HomeEducationDetails bullets={["GPA: 3.9/4.0"]} institution="Example University" />
        <HomeEducationDetails bullets={["Relevant coursework: Algorithms"]} institution="Cascadia College" />
      </>
    );

    const disclosures = container.querySelectorAll<HTMLDetailsElement>("details.home-education-item__disclosure");
    expect(disclosures).toHaveLength(2);
    expect(disclosures[0]).not.toHaveAttribute("open");
    expect(disclosures[1]).not.toHaveAttribute("open");
    expect(screen.getAllByText("Show more")).toHaveLength(2);
    expect(container.querySelectorAll(".home-education-item__disclosure-label-less")).toHaveLength(2);

    fireEvent.click(disclosures[0]!.querySelector("summary")!);
    expect(disclosures[0]).toHaveAttribute("open");
    expect(disclosures[1]).not.toHaveAttribute("open");

    fireEvent.click(disclosures[0]!.querySelector("summary")!);
    expect(disclosures[0]).not.toHaveAttribute("open");
    expect(screen.getAllByText("Show more")).toHaveLength(2);
  });

  it("retargets a pending disclosure animation when the control is reversed", async () => {
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    const animations: Array<{
      cancel: ReturnType<typeof vi.fn>;
      commitStyles: ReturnType<typeof vi.fn>;
      finished: Promise<void>;
      resolve: () => void;
    }> = [];

    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(() => {
        let resolve: (() => void) | undefined;
        const animation = {
          cancel: vi.fn(),
          commitStyles: vi.fn(),
          finished: new Promise<void>((complete) => {
            resolve = complete;
          }),
          resolve: () => resolve?.()
        };

        animations.push(animation);
        return animation as unknown as Animation;
      })
    });

    try {
      const { container } = render(<HomeEducationDetails bullets={["GPA: 3.9/4.0"]} institution="Example University" />);
      const disclosure = container.querySelector<HTMLDetailsElement>(".home-education-item__disclosure");
      const content = container.querySelector<HTMLElement>(".home-education-item__disclosure-content");
      const measurement = container.querySelector<HTMLElement>(".home-education-item__disclosure-measure");

      vi.spyOn(content!, "getBoundingClientRect").mockReturnValue({ height: 20 } as DOMRect);
      vi.spyOn(measurement!, "getBoundingClientRect").mockReturnValue({ height: 40 } as DOMRect);

      const summary = disclosure?.querySelector("summary");

      fireEvent.click(summary!);
      fireEvent.click(summary!);
      expect(disclosure).toHaveAttribute("open");
      expect(summary).toHaveAttribute("aria-expanded", "false");
      expect(content).toHaveAttribute("aria-hidden", "true");
      expect(content).toHaveAttribute("inert");

      fireEvent.click(summary!);

      expect(animations).toHaveLength(6);
      expect(animations.slice(0, 4).every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
      expect(disclosure).toHaveAttribute("open");
      expect(summary).toHaveAttribute("aria-expanded", "true");
      expect(content).not.toHaveAttribute("aria-hidden");
      expect(content).not.toHaveAttribute("inert");

      animations.slice(2, 4).forEach((animation) => animation.resolve());
      await Promise.resolve();
      expect(disclosure).toHaveAttribute("open");

      animations.slice(4).forEach((animation) => animation.resolve());
      await waitFor(() => expect(content!.style.height).toBe(""));
      expect(content!.style.opacity).toBe("");
      expect(content!.style.overflow).toBe("");
      expect(animations.slice(4).every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
    } finally {
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
      } else {
        delete (HTMLElement.prototype as { animate?: unknown }).animate;
      }
    }
  });

  it("retargets the pending height animation from the resized inner measurement", async () => {
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
    const animations: Array<{
      cancel: ReturnType<typeof vi.fn>;
      finished: Promise<void>;
      keyframes: Keyframe[] | PropertyIndexedKeyframes;
    }> = [];
    let frame: FrameRequestCallback | undefined;
    let measurementHeight = 80;

    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      })
    });
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn((keyframes: Keyframe[] | PropertyIndexedKeyframes) => {
        const animation = { cancel: vi.fn(), finished: new Promise<void>(() => {}), keyframes };

        animations.push(animation);
        return animation as unknown as Animation;
      })
    });

    try {
      const { container } = render(<HomeEducationDetails bullets={["GPA: 3.9/4.0"]} institution="Example University" />);
      const content = container.querySelector<HTMLElement>(".home-education-item__disclosure-content");
      const measurement = container.querySelector<HTMLElement>(".home-education-item__disclosure-measure");
      const summary = container.querySelector("summary");

      vi.spyOn(content!, "getBoundingClientRect").mockReturnValue({ height: 20 } as DOMRect);
      vi.spyOn(measurement!, "getBoundingClientRect").mockImplementation(() => ({ height: measurementHeight }) as DOMRect);
      fireEvent.click(summary!);
      await waitFor(() => expect(animations).toHaveLength(2));

      measurementHeight = 40;
      await act(async () => {
        window.dispatchEvent(new Event("resize"));
      });
      expect(frame).toBeDefined();

      await act(async () => {
        frame?.(0);
      });

      expect(animations).toHaveLength(4);
      expect(animations.slice(0, 2).every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
      expect(animations[2]!.keyframes).toMatchObject({ height: ["20px", "40px"] });
    } finally {
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
      } else {
        delete (HTMLElement.prototype as { animate?: unknown }).animate;
      }

      if (originalRequestAnimationFrame) {
        Object.defineProperty(window, "requestAnimationFrame", originalRequestAnimationFrame);
      } else {
        delete (window as { requestAnimationFrame?: unknown }).requestAnimationFrame;
      }
    }
  });

  it("settles the current disclosure immediately when reduced motion changes during its animation", async () => {
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
    const animations: Array<{ cancel: ReturnType<typeof vi.fn>; finished: Promise<void> }> = [];
    let matches = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQuery = {
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      get matches() {
        return matches;
      },
      media: "(prefers-reduced-motion: reduce)",
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)
    } as unknown as MediaQueryList;

    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => mediaQuery) });
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(() => {
        const animation = { cancel: vi.fn(), finished: new Promise<void>(() => {}) };

        animations.push(animation);
        return animation as unknown as Animation;
      })
    });

    try {
      const { container } = render(<HomeEducationDetails bullets={["GPA: 3.9/4.0"]} institution="Example University" />);
      const disclosure = container.querySelector<HTMLDetailsElement>(".home-education-item__disclosure");
      const content = container.querySelector<HTMLElement>(".home-education-item__disclosure-content");
      const measurement = container.querySelector<HTMLElement>(".home-education-item__disclosure-measure");
      const summary = disclosure?.querySelector("summary");

      vi.spyOn(measurement!, "getBoundingClientRect").mockReturnValue({ height: 40 } as DOMRect);
      fireEvent.click(summary!);
      expect(animations).toHaveLength(2);

      matches = true;
      await act(async () => {
        listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
      });

      expect(disclosure).toHaveAttribute("open");
      expect(summary).toHaveAttribute("aria-expanded", "true");
      expect(content).not.toHaveAttribute("aria-hidden");
      expect(content).not.toHaveAttribute("inert");
      expect(animations.every((animation) => animation.cancel.mock.calls.length === 1)).toBe(true);
    } finally {
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
      } else {
        delete (HTMLElement.prototype as { animate?: unknown }).animate;
      }

      if (originalMatchMedia) {
        Object.defineProperty(window, "matchMedia", originalMatchMedia);
      } else {
        delete (window as { matchMedia?: unknown }).matchMedia;
      }
    }
  });

  it("falls back without leaving a partial animation when a paired animation cannot start", () => {
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    const firstAnimation = { cancel: vi.fn(), finished: Promise.resolve() };

    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi
        .fn()
        .mockReturnValueOnce(firstAnimation)
        .mockImplementationOnce(() => {
          throw new Error("Opacity animation is unavailable.");
        })
    });

    try {
      const { container } = render(<HomeEducationDetails bullets={["GPA: 3.9/4.0"]} institution="Example University" />);
      const disclosure = container.querySelector<HTMLDetailsElement>(".home-education-item__disclosure");
      const content = container.querySelector<HTMLElement>(".home-education-item__disclosure-content");
      const measurement = container.querySelector<HTMLElement>(".home-education-item__disclosure-measure");

      vi.spyOn(measurement!, "getBoundingClientRect").mockReturnValue({ height: 40 } as DOMRect);
      fireEvent.click(disclosure!.querySelector("summary")!);

      expect(disclosure).toHaveAttribute("open");
      expect(firstAnimation.cancel).toHaveBeenCalledTimes(1);
      expect(content!.style.height).toBe("");
      expect(content!.style.opacity).toBe("");
      expect(content!.style.overflow).toBe("");
    } finally {
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
      } else {
        delete (HTMLElement.prototype as { animate?: unknown }).animate;
      }
    }
  });
});
