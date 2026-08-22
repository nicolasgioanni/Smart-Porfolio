import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MOBILE_UI_QUERY,
  PHONE_HERO_QUERY,
  useMediaQuery
} from "@/components/responsive/useMediaQuery";

type QueryController = {
  addEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  mediaQuery: MediaQueryList;
  removeEventListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  setMatches: (matches: boolean) => void;
};

function createQueryController(query: string, initialMatches: boolean, legacy = false): QueryController {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = initialMatches;
  const addEventListener = vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
    listeners.add(listener);
  });
  const removeEventListener = vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
    listeners.delete(listener);
  });
  const addListener = vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.add(listener));
  const removeListener = vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener));
  const mediaQuery = {
    addEventListener: legacy ? undefined : addEventListener,
    addListener,
    dispatchEvent: vi.fn(),
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    removeEventListener: legacy ? undefined : removeEventListener,
    removeListener
  } as unknown as MediaQueryList;

  return {
    addEventListener,
    addListener,
    mediaQuery,
    removeEventListener,
    removeListener,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches: nextMatches, media: query } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    }
  };
}

function QueryResult({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <output>{matches ? "matches" : "does not match"}</output>;
}

describe("useMediaQuery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports the canonical responsive layout queries", () => {
    expect(MOBILE_UI_QUERY).toBe("(max-width: 980px)");
    expect(PHONE_HERO_QUERY).toBe("(max-width: 720px)");
  });

  it("uses a stable non-matching server snapshot", () => {
    expect(renderToStaticMarkup(<QueryResult query={MOBILE_UI_QUERY} />)).toContain("does not match");
  });

  it("reads the hydrated match and follows modern change events", () => {
    const controller = createQueryController(MOBILE_UI_QUERY, true);
    vi.stubGlobal("matchMedia", vi.fn(() => controller.mediaQuery));

    const { unmount } = render(<QueryResult query={MOBILE_UI_QUERY} />);

    expect(screen.getByText("matches")).toBeInTheDocument();
    expect(controller.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    act(() => controller.setMatches(false));
    expect(screen.getByText("does not match")).toBeInTheDocument();

    unmount();
    expect(controller.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("supports legacy MediaQueryList listeners and cleans them up", () => {
    const controller = createQueryController(PHONE_HERO_QUERY, false, true);
    vi.stubGlobal("matchMedia", vi.fn(() => controller.mediaQuery));

    const { unmount } = render(<QueryResult query={PHONE_HERO_QUERY} />);

    expect(controller.addListener).toHaveBeenCalledWith(expect.any(Function));
    act(() => controller.setMatches(true));
    expect(screen.getByText("matches")).toBeInTheDocument();

    unmount();
    expect(controller.removeListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it("falls back to false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<QueryResult query={MOBILE_UI_QUERY} />);
    expect(screen.getByText("does not match")).toBeInTheDocument();
  });
});
