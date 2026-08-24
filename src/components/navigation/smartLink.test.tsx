import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlassButton } from "@/components/glass/GlassButton";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { GlassLink } from "@/components/glass/GlassLink";
import { createNavigationItems } from "@/components/navigation/navigationItems";
import { SmartLink } from "@/components/navigation/SmartLink";
import { isSiteRouteHref, siteRoutePaths } from "@/components/navigation/siteRoutes";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a data-next-link="true" href={href} {...props}>
      {children}
    </a>
  )
}));

describe("site route registry", () => {
  it("keeps the declared routes in navigation order", () => {
    expect(siteRoutePaths).toEqual([
      "/",
      "/experience",
      "/research",
      "/projects",
      "/recommendations",
      "/resume",
      "/contact",
      "/terms",
      "/privacy",
      "/security"
    ]);
    expect(createNavigationItems({ enableRecommendations: false }).map((item) => item.href)).toEqual([
      "/",
      "/experience",
      "/research",
      "/projects",
      "/resume"
    ]);
    expect(createNavigationItems({ enableRecommendations: true, recommendationCount: 1 }).map((item) => item.href)).toEqual([
      "/",
      "/experience",
      "/research",
      "/projects",
      "/recommendations",
      "/resume"
    ]);
  });

  it("recognizes only exact app routes with optional query and hash suffixes", () => {
    expect(isSiteRouteHref("/projects")).toBe(true);
    expect(isSiteRouteHref("/projects?source=home")).toBe(true);
    expect(isSiteRouteHref("/projects#featured")).toBe(true);
    expect(isSiteRouteHref("/projects?source=home#featured")).toBe(true);
    expect(isSiteRouteHref("/?source=brand")).toBe(true);
    expect(isSiteRouteHref("/terms")).toBe(true);
    expect(isSiteRouteHref("/privacy#email-communications")).toBe(true);
    expect(isSiteRouteHref("/security?source=footer")).toBe(true);
    expect(isSiteRouteHref("/contact?source=footer")).toBe(true);

    expect(isSiteRouteHref("/projects/example")).toBe(false);
    expect(isSiteRouteHref("/resume/demo.pdf")).toBe(false);
    expect(isSiteRouteHref("/images/profile.png")).toBe(false);
    expect(isSiteRouteHref("https://example.com/projects")).toBe(false);
    expect(isSiteRouteHref("mailto:hello@example.com")).toBe(false);
  });
});

describe("SmartLink", () => {
  it("uses Next Link for a declared route while preserving anchor props", () => {
    const onClick = vi.fn();

    render(
      <SmartLink
        className="custom-link"
        href="/research?source=home#current"
        onClick={(event) => {
          event.preventDefault();
          onClick();
        }}
      >
        Research
      </SmartLink>
    );

    const link = screen.getByRole("link", { name: "Research" });
    expect(link).toHaveAttribute("data-next-link", "true");
    expect(link).toHaveAttribute("href", "/research?source=home#current");
    expect(link).toHaveClass("custom-link");

    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each(["/projects/example", "/resume/demo.pdf", "/images/profile.png", "mailto:hello@example.com"])(
    "keeps %s as a native anchor",
    (href) => {
      render(<SmartLink href={href}>Destination</SmartLink>);

      expect(screen.getByRole("link", { name: "Destination" })).not.toHaveAttribute("data-next-link");
    }
  );

  it("opens external URLs safely and merges caller rel values", () => {
    render(
      <SmartLink href="https://example.com" rel="nofollow">
        External
      </SmartLink>
    );

    const link = screen.getByRole("link", { name: "External" });
    expect(link).not.toHaveAttribute("data-next-link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "nofollow noopener noreferrer");
  });
});

describe("Hover Base 1 link integrations", () => {
  it("marks glass buttons and preserves the solid primary distinction", () => {
    const { rerender } = render(
      <GlassButton href="/projects" variant="primary">
        Projects
      </GlassButton>
    );

    expect(screen.getByRole("link", { name: "Projects" })).toHaveClass("hover-base-1", "hover-base-1--solid");

    rerender(
      <GlassButton href="/research" variant="secondary">
        Research
      </GlassButton>
    );

    expect(screen.getByRole("link", { name: "Research" })).toHaveClass("hover-base-1");
    expect(screen.getByRole("link", { name: "Research" })).not.toHaveClass("hover-base-1--solid");
  });

  it("marks compact glass links and renders a hidden arrow element", () => {
    const { container } = render(<GlassLink href="/experience">Experience</GlassLink>);

    const link = screen.getByRole("link", { name: "Experience" });
    expect(link).toHaveClass("hover-base-1", "hover-base-1--compact");
    expect(container.querySelector(".glass-link__arrow")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".glass-link__arrow")).toHaveTextContent(">");
  });

  it("marks icon links as compact controls", () => {
    render(<GlassIconLink label="GitHub" url="https://github.com/example" />);

    expect(screen.getByRole("link", { name: "GitHub" })).toHaveClass("hover-base-1", "hover-base-1--compact");
  });

  it("marks profile contact links as inline controls", () => {
    render(
      <PortfolioHero
        links={[]}
        motionEnabled={false}
        overview={{
          about: "Builds dependable products.",
          greetingName: "Demo",
          role: { kind: "static", label: "Software engineer" }
        }}
        profile={{
          email: "hello@example.com",
          fullName: "Demo Owner",
          headline: "Software engineer",
          location: "",
          shortBio: "Builds dependable products."
        }}
      />
    );

    expect(screen.getByRole("link", { name: "hello@example.com" })).toHaveClass("hover-base-1", "hover-base-1--inline");
  });
});
