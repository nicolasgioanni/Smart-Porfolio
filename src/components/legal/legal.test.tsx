import { readFileSync } from "node:fs";
import path from "node:path";
import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import PrivacyPage, { generateMetadata as generatePrivacyMetadata } from "@/app/privacy/page";
import SecurityPage, { generateMetadata as generateSecurityMetadata } from "@/app/security/page";
import TermsPage, { generateMetadata as generateTermsMetadata } from "@/app/terms/page";
import { resolveLegalEffectiveDate } from "@/components/legal/LegalDocument";

const siteSettingsTemplate = readFileSync(
  path.join(process.cwd(), "src", "content", "templates", "site_settings.csv"),
  "utf8"
);

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

beforeAll(() => {
  class IntersectionObserverMock implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    disconnect() {}
    observe() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    unobserve() {}
  }

  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("legal document routes", () => {
  it("renders the terms title, effective-date field, and required verification language", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Site Terms & Accuracy Notice" })).toBeInTheDocument();
    expect(screen.getByText(/Effective date:/).closest("p")?.querySelector("time")).toBeInTheDocument();
    expect(
      screen.getByText(/Employment, education, credentials, metrics, authorship, project status, and availability/).closest("p")
    ).toHaveTextContent(
      "Employment, education, credentials, metrics, authorship, project status, and availability should be independently confirmed through Nicolas Gioanni at ngioanni@uw.edu and, where appropriate, the relevant institution or organization before being relied upon for a material decision."
    );
  });

  it("discloses active contact processing, providers, retention, theme storage, and the correction channel", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy Notice" })).toBeInTheDocument();
    expect(screen.getByText("portfolio-theme")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Browser storage and essential verification cookie" })).toBeInTheDocument();
    expect(screen.getByText(/sets a signed contact-verification cookie for up to 30 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/not your name, email address, phone number, message/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact requests and email communications" })).toBeInTheDocument();
    expect(screen.getByText(/first name, last name, email address, optional phone number, message/)).toBeInTheDocument();
    expect(screen.getByText(/Turnstile is visibly completed before the data-entry form opens/)).toBeInTheDocument();
    expect(screen.getByText(/form should advance automatically when verification succeeds/)).toBeInTheDocument();
    expect(screen.getByText(/contact-field values remain in your browser while you complete and review/)).toBeInTheDocument();
    expect(screen.getByText(/does not send the Turnstile response through Cloudflare verification a second time/)).toBeInTheDocument();
    expect(screen.getByText(/reviewed fields are locked so a failed or uncertain attempt/)).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare may additionally process request information for edge rate limiting/)).toBeInTheDocument();
    expect(screen.getByText(/Resend delivers a transactional confirmation/)).toBeInTheDocument();
    expect(screen.getByText(/does not intentionally add contact submissions to a first-party contact database/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Privacy Notice$/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\//)
    );
    expect(screen.getByRole("heading", { name: "Questions, corrections, and removal requests" })).toBeInTheDocument();
  });

  it("states the scoped contact architecture, active safeguards, and disclosure limits", () => {
    render(<SecurityPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Security & Responsible Disclosure" })).toBeInTheDocument();
    expect(screen.getByText(/public portfolio pages are statically generated/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact submission safeguards" })).toBeInTheDocument();
    expect(screen.getByText(/server verifies that token once through Cloudflare Siteverify/)).toBeInTheDocument();
    expect(screen.getByText(/signing key is derived with domain-separated HKDF/)).toBeInTheDocument();
    expect(screen.getByText(/without calling Siteverify a second time/)).toBeInTheDocument();
    expect(screen.getByText(/byte-equivalent Resend payload required by idempotency/)).toBeInTheDocument();
    expect(screen.getByText(/application handlers do not implement request rate limiting/)).toBeInTheDocument();
    expect(screen.getByText(/live configuration is not represented in this repository/)).toBeInTheDocument();
    expect(screen.getByText(/noreply@mail\.nicolasmgioanni\.dev/)).toBeInTheDocument();
    expect(screen.getByText(/private owner destination and all provider secrets remain server-side/)).toBeInTheDocument();
    expect(screen.getByText(/validated visitor address receives the confirmation and is used as the reply-to address/)).toBeInTheDocument();
    expect(screen.getByText(/fail closed when required Turnstile, ticket, validation/)).toBeInTheDocument();
    expect(screen.getByText("The affected portfolio URL or asset.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No authorization, safe harbor, reward, or bug bounty" })).toBeInTheDocument();
  });

  it("publishes distinct production metadata for every notice", () => {
    expect(generateTermsMetadata().title).toEqual({
      absolute: "Site Terms & Accuracy Notice | Nicolas Gioanni Portfolio"
    });
    expect(generatePrivacyMetadata().title).toEqual({ absolute: "Privacy Notice | Nicolas Gioanni Portfolio" });
    expect(generateSecurityMetadata().title).toEqual({
      absolute: "Security & Responsible Disclosure | Nicolas Gioanni Portfolio"
    });
  });
});

describe("legal effective-date normalization", () => {
  it("publishes and formats the current legal effective date", () => {
    expect(siteSettingsTemplate).toMatch(/^legal_effective_date,2026-08-22$/m);
    expect(resolveLegalEffectiveDate("2026-08-22")).toEqual({ iso: "2026-08-22", label: "August 22, 2026" });
  });

  it("formats another valid settings date and rejects impossible values", () => {
    expect(resolveLegalEffectiveDate("2027-01-09")).toEqual({ iso: "2027-01-09", label: "January 9, 2027" });
    expect(resolveLegalEffectiveDate("2026-02-31")).toEqual({ iso: "2026-08-22", label: "August 22, 2026" });
  });
});
