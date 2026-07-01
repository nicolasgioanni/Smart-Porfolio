import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveBlobHeader } from "@/components/layout/InteractiveBlobHeader";
import { SocialLinkGroup } from "@/components/navigation/SocialLinkGroup";
import { createNavigationItems, isNavigationItemActive, navigationItems } from "@/components/navigation/navigationItems";

vi.mock("next/navigation", () => ({
  usePathname: () => "/"
}));

const headerBrand = {
  headline: "Software engineer",
  initial: "D",
  markImageSrc: "/favicon/favicon.png",
  name: "Demo Owner"
};

const headerNavigationItems = [
  { href: "/", label: "Home" },
  { href: "/research", label: "Research" },
  { href: "/projects", label: "Projects" }
];

const headerLinks = [
  {
    id: "github",
    label: "GitHub",
    url: "https://github.com/example",
    kind: "github",
    isPrimary: true,
    showOnHome: true,
    showInHeader: true,
    showInFooter: true,
    order: 1
  }
];

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value
  });
}

function setFinePointer(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches,
      media: query,
      removeEventListener: vi.fn(),
      removeListener: vi.fn()
    }))
  });
}

function renderHeader() {
  return render(<InteractiveBlobHeader brand={headerBrand} navigationItems={headerNavigationItems} primaryLinks={headerLinks} />);
}

function scrollToPosition(value: number) {
  act(() => {
    setScrollY(value);
    window.dispatchEvent(new Event("scroll"));
  });
}

function movePointerTo(clientY: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent("pointermove", { clientY }));
  });
}

describe("navigation helpers", () => {
  beforeEach(() => {
    setFinePointer(true);
    setScrollY(0);
  });

  afterEach(() => {
    setScrollY(0);
    vi.restoreAllMocks();
  });

  it("generates the required route links", () => {
    expect(navigationItems.map((item) => item.href)).toEqual(["/", "/research", "/projects", "/experience", "/recommendations", "/resume"]);
  });

  it("supports content-driven recommendations navigation settings", () => {
    expect(createNavigationItems({ enableRecommendations: false, recommendationsNavLabel: "Recommendations" }).map((item) => item.href)).toEqual([
      "/",
      "/research",
      "/projects",
      "/experience",
      "/resume"
    ]);
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 0 }).map((item) => item.href)).toEqual([
      "/",
      "/research",
      "/projects",
      "/experience",
      "/resume"
    ]);
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 0, showEmptyRecommendations: true }).map((item) => item.href)).toContain(
      "/recommendations"
    );
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 1, recommendationsNavLabel: "References" }).find((item) => item.href === "/recommendations")?.label).toBe("References");
  });

  it("detects active routes", () => {
    expect(isNavigationItemActive("/projects", "/projects")).toBe(true);
    expect(isNavigationItemActive("/projects/demo", "/projects")).toBe(true);
    expect(isNavigationItemActive("/research", "/")).toBe(false);
  });

  it("renders descriptive social links", () => {
    render(
      <SocialLinkGroup
        links={[
          {
            id: "github",
            label: "GitHub",
            url: "https://github.com/example",
            kind: "github",
            isPrimary: true,
            showOnHome: true,
            showInHeader: true,
            showInFooter: true,
            order: 1
          }
        ]}
      />
    );

    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("href", "https://github.com/example");
  });

  it("renders the interactive header expanded by default", () => {
    const { container } = renderHeader();

    expect(container.querySelector(".blob-header")).toHaveAttribute("data-header-state", "expanded");
    expect(container.querySelector(".site-brand__mark")).toHaveClass("site-brand__mark--image");
    expect(container.querySelector(".site-brand__mark-image")).toHaveAttribute("src", "/favicon/favicon.png");
    expect(screen.getByRole("button", { name: /view demo owner profile photo/i })).toBeInTheDocument();
  });

  it("opens the profile photo preview and closes when clicking outside the frame", async () => {
    const { container } = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: /view demo owner profile photo/i }));
    expect(screen.getByRole("dialog", { name: /demo owner profile photo/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /demo owner profile photo/i })).toHaveAttribute("src", "/favicon/favicon.png");

    fireEvent.click(screen.getByRole("img", { name: /demo owner profile photo/i }));
    expect(screen.getByRole("dialog", { name: /demo owner profile photo/i })).toBeInTheDocument();

    const backdrop = container.querySelector(".profile-image-preview");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(backdrop).toHaveAttribute("data-state", "closed");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /demo owner profile photo/i })).not.toBeInTheDocument());
  });

  it("closes the profile photo preview with Escape", async () => {
    const { container } = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: /view demo owner profile photo/i }));
    expect(screen.getByRole("dialog", { name: /demo owner profile photo/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".profile-image-preview")).toHaveAttribute("data-state", "closed");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /demo owner profile photo/i })).not.toBeInTheDocument());
  });

  it("shrinks on downward scroll and expands on upward scroll", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(120);
    expect(header).toHaveAttribute("data-header-state", "compact");

    scrollToPosition(80);
    expect(header).toHaveAttribute("data-header-state", "expanded");

    movePointerTo(220);
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });

  it("expands near the top proximity zone and compacts again when the pointer moves away", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    movePointerTo(24);
    expect(header).toHaveAttribute("data-header-state", "expanded");

    movePointerTo(220);
    expect(header).toHaveAttribute("data-header-state", "compact");
  });

  it("expands when focus moves into the header", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    fireEvent.focus(screen.getByRole("link", { name: /demo owner home/i }));
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });

  it("keeps the header expanded while the mobile menu is open", () => {
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    expect(screen.getByRole("button", { name: /menu/i })).toHaveAttribute("aria-expanded", "true");
    expect(header).toHaveAttribute("data-header-state", "expanded");

    scrollToPosition(190);
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });

  it("uses scroll direction instead of pointer proximity on coarse pointer devices", () => {
    setFinePointer(false);
    const { container } = renderHeader();
    const header = container.querySelector(".blob-header");

    scrollToPosition(140);
    expect(header).toHaveAttribute("data-header-state", "compact");

    movePointerTo(24);
    expect(header).toHaveAttribute("data-header-state", "compact");

    scrollToPosition(100);
    expect(header).toHaveAttribute("data-header-state", "expanded");
  });
});
