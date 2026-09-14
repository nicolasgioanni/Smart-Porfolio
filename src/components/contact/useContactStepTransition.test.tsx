import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useContactStepTransition } from "@/components/contact/useContactStepTransition";

type DeferredAnimation = Animation & {
  cancel: ReturnType<typeof vi.fn>;
  finish: () => void;
};

const resizeObservers: ResizeObserverCallback[] = [];
let mediaMatches = false;
let mediaListeners: Array<(event: MediaQueryListEvent) => void> = [];
let framePresentationHeight = 120;

function rectangle(height: number): DOMRect {
  return {
    bottom: height,
    height,
    left: 0,
    right: 400,
    top: 0,
    width: 400,
    x: 0,
    y: 0,
    toJSON: () => ({})
  } as DOMRect;
}

function createAnimation(): DeferredAnimation {
  let resolveFinished!: () => void;
  let rejectFinished!: () => void;
  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });
  const animation = {
    cancel: vi.fn(() => rejectFinished()),
    finished,
    finish: resolveFinished
  } as unknown as DeferredAnimation;
  return animation;
}

function Harness() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [active, setActive] = useState(true);
  const { frameRef, transitionToStep } = useContactStepTransition({
    active,
    onStepChange: setStep,
    step,
    view: active ? "form" : "verification"
  });

  return (
    <>
      {active ? (
        <div data-testid="frame" ref={frameRef}>
          <div className="contact-step" data-height={step === 1 ? "120" : step === 2 ? "260" : "180"} />
        </div>
      ) : null}
      <button onClick={() => transitionToStep(step === 1 ? 2 : 3)} type="button">Next</button>
      <button onClick={() => setActive(false)} type="button">Remove frame</button>
    </>
  );
}

describe("contact step transitions", () => {
  beforeEach(() => {
    resizeObservers.length = 0;
    mediaMatches = false;
    mediaListeners = [];
    framePresentationHeight = 120;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) {
        resizeObservers.push(callback);
      }
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    });
    vi.stubGlobal("CSS", { supports: vi.fn(() => true) });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.push(listener),
        get matches() {
          return mediaMatches;
        },
        removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          mediaListeners = mediaListeners.filter((candidate) => candidate !== listener);
        }
      }))
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("contact-step")) return rectangle(Number(this.dataset.height));
      if (this.dataset.testid === "frame") return rectangle(framePresentationHeight);
      return rectangle(0);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("releases temporary dimensions and the finished animation effect", async () => {
    const animation = createAnimation();
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: vi.fn(() => animation) });
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const frame = screen.getByTestId("frame");
    expect(frame.style.height).toBe("120px");
    expect(frame.style.overflow).toBe("clip");
    act(() => animation.finish());

    await waitFor(() => expect(frame.style.height).toBe(""));
    expect(frame.style.overflow).toBe("");
    expect(animation.cancel).toHaveBeenCalledOnce();
  });

  it("does not let stale observer or finish callbacks cancel a replacement animation", async () => {
    const first = createAnimation();
    const second = createAnimation();
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second) });
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(first.cancel).toHaveBeenCalledOnce();
    expect(second.cancel).not.toHaveBeenCalled();

    act(() => resizeObservers[0]?.([{ contentRect: rectangle(300) } as ResizeObserverEntry], {} as ResizeObserver));
    act(() => first.finish());
    expect(second.cancel).not.toHaveBeenCalled();

    act(() => second.finish());
    await waitFor(() => expect(screen.getByTestId("frame").style.height).toBe(""));
  });

  it("cancels the current animation when incoming content changes height", () => {
    const animation = createAnimation();
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: vi.fn(() => animation) });
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    act(() => resizeObservers.at(-1)?.([{ contentRect: rectangle(300) } as ResizeObserverEntry], {} as ResizeObserver));
    expect(animation.cancel).toHaveBeenCalledOnce();
    expect(screen.getByTestId("frame").style.height).toBe("");
  });

  it("cancels a running animation when the form frame is removed or motion becomes reduced", async () => {
    const first = createAnimation();
    const second = createAnimation();
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second) });
    const firstRender = render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove frame" }));
    expect(first.cancel).toHaveBeenCalledOnce();

    firstRender.unmount();
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    mediaMatches = true;
    act(() => mediaListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent)));
    await waitFor(() => expect(second.cancel).toHaveBeenCalledOnce());
  });

  it("falls back to an immediate step when animation is unsupported or throws", () => {
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: undefined });
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("frame").getAttribute("style")).toBeNull();
    unmount();

    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: vi.fn(() => { throw new Error("unsupported"); }) });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByTestId("frame").style.height).toBe("");
    expect(screen.getByTestId("frame").style.overflow).toBe("");
  });
});
