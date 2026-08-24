import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResumePage, { generateMetadata } from "@/app/resume/page";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

describe("private resume route", () => {
  it("offers request channels without publishing resume details or files", () => {
    const { container } = render(<ResumePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Request my resume" })).toBeInTheDocument();
    expect(screen.getByText(/private and shared directly with legitimate professional contacts/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open contact form" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Email resume request" })).toHaveAttribute(
      "href",
      "mailto:ngioanni@uw.edu?subject=Resume%20Request"
    );
    expect(container.querySelector('a[href$=".pdf"]')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/preview|not enabled|coming soon/i);
    expect(screen.queryByText("Experience highlights")).not.toBeInTheDocument();
    expect(screen.queryByText("Research highlights")).not.toBeInTheDocument();
    expect(screen.queryByText("Project highlights")).not.toBeInTheDocument();
    expect(screen.queryByText("Education")).not.toBeInTheDocument();
    expect(screen.queryByText("Skills")).not.toBeInTheDocument();
  });

  it("publishes private-request metadata", () => {
    expect(generateMetadata().title).toEqual({ absolute: "Resume | Nicolas Gioanni Portfolio" });
    expect(generateMetadata().description).toMatch(/private resume/i);
  });
});
