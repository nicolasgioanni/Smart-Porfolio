import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompressOnScrollSection } from "@/components/motion/CompressOnScrollSection";
import { ScrollReveal } from "@/components/motion/ScrollReveal";

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
};

const observerRecords: ObserverRecord[] = [];

class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
  unobserve = vi.fn();

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.rootMargin = options?.rootMargin ?? "";
    this.thresholds = Array.isArray(options?.threshold) ? options.threshold : [options?.threshold ?? 0];
    observerRecords.push({ callback, disconnect: this.disconnect, observe: this.observe });
  }
}

function emitIntersection(isIntersecting: boolean) {
  const record = observerRecords.at(-1);
  if (!record) throw new Error("Missing IntersectionObserver record.");

  act(() => {
    record.callback(
      [
        {
          intersectionRatio: isIntersecting ? 1 : 0,
          isIntersecting
        } as IntersectionObserverEntry
      ],
      {} as IntersectionObserver
    );
  });
}

describe("motion reveal behavior", () => {
  afterEach(() => {
    observerRecords.length = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps compressed sections visible after they have revealed once", () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    render(
      <CompressOnScrollSection>
        <span>Skills snapshot</span>
      </CompressOnScrollSection>
    );

    const section = screen.getByText("Skills snapshot").closest("section");

    expect(section).toHaveClass("motion-compress");
    expect(section).toHaveClass("motion-ready");
    expect(section).not.toHaveClass("is-visible");

    emitIntersection(true);
    expect(section).toHaveClass("is-visible");

    emitIntersection(false);
    expect(section).toHaveClass("is-visible");
  });

  it("leaves content readable when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    render(
      <ScrollReveal>
        <span>Static fallback</span>
      </ScrollReveal>
    );

    const reveal = screen.getByText("Static fallback").parentElement;
    expect(reveal).toHaveClass("motion-reveal", "is-visible");
    expect(reveal).not.toHaveClass("motion-ready");
  });
});
