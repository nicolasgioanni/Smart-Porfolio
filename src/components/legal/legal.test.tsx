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

    const title = screen.getByRole("heading", { level: 1, name: "Site Terms & Accuracy Notice" });
    const introModule = title.closest(".page-intro__surface");
    const effectiveDate = screen.getByText(/Effective date:/).closest("p");

    expect(introModule).toHaveClass("glass-surface", "glass-surface--strong");
    expect(introModule).toHaveTextContent("Site notice");
    expect(introModule).toHaveTextContent("How portfolio information may be used, verified, and attributed.");
    expect(introModule).not.toContainElement(effectiveDate);
    expect(effectiveDate?.querySelector("time")).toBeInTheDocument();
    expect(effectiveDate).toHaveClass("legal-document__effective-date");
    expect(
      screen.getByText(/Employment, education, credentials, metrics, authorship, project status, and availability/).closest("p")
    ).toHaveTextContent(
      "Employment, education, credentials, metrics, authorship, project status, and availability should be independently confirmed through Nicolas Gioanni at ngioanni@uw.edu and, where appropriate, the relevant institution or organization before being relied upon for a material decision."
    );
    expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByText(/contact form asks visitors to acknowledge this Notice/)).toBeInTheDocument();
  });

  it("discloses active contact processing, providers, retention, theme storage, and the correction channel", () => {
    render(<PrivacyPage />);

    const title = screen.getByRole("heading", { level: 1, name: "Privacy Notice" });
    const introModule = title.closest(".page-intro__surface");
    const effectiveDate = screen.getByText(/Effective date:/).closest("p");

    expect(introModule).toHaveClass("glass-surface", "glass-surface--strong");
    expect(introModule).toHaveTextContent("Site notice");
    expect(introModule).toHaveTextContent(
      "What information may be processed when you visit this portfolio or choose to make contact."
    );
    expect(introModule).not.toContainElement(effectiveDate);
    expect(effectiveDate).toHaveClass("legal-document__effective-date");
    expect(screen.getByText("portfolio-theme")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Browser storage and essential verification cookie" })).toBeInTheDocument();
    expect(screen.getByText(/sets a signed contact-verification cookie for up to 30 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/not your name, email address, phone number, message/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact requests and email communications" })).toBeInTheDocument();
    expect(screen.getByText(/first name, last name, email address, optional phone number, message/)).toBeInTheDocument();
    expect(screen.getByText(/form-start timestamp and a hidden anti-spam field/)).toBeInTheDocument();
    expect(screen.getByText(/Loading and completing Turnstile causes the browser to communicate with Cloudflare/)).toBeInTheDocument();
    expect(screen.getByText(/form should advance automatically when verification succeeds/)).toBeInTheDocument();
    expect(screen.getByText(/contact-field values remain in your browser while you complete and review/)).toBeInTheDocument();
    expect(screen.getByText(/does not send the Turnstile response through Cloudflare verification a second time/)).toBeInTheDocument();
    expect(screen.getByText(/reviewed fields are locked so a failed or uncertain attempt/)).toBeInTheDocument();
    expect(screen.getByText(/stores a keyed HMAC-SHA-256 value rather than the address itself/)).toBeInTheDocument();
    expect(screen.getByText(/server sends only the domain portion of the supplied address/)).toBeInTheDocument();
    expect(screen.getByText(/reserves one of two allowed attempts.*rolling 24-hour window/)).toBeInTheDocument();
    expect(screen.getByText(/Resend is asked first to deliver a transactional confirmation/)).toBeInTheDocument();
    expect(screen.getByText(/Acceptance by Resend does not guarantee final mailbox delivery/)).toBeInTheDocument();
    expect(screen.getByText(/does not send Resend the Turnstile token/)).toBeInTheDocument();
    expect(screen.getByText(/Full contact submissions are not added to a first-party contact database/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cloudflare Privacy Policy" })).toHaveAttribute(
      "href",
      "https://www.cloudflare.com/privacypolicy/"
    );
    expect(screen.getByRole("link", { name: "Turnstile Privacy Addendum" })).toHaveAttribute(
      "href",
      "https://www.cloudflare.com/turnstile-privacy-policy/"
    );
    expect(screen.getByRole("link", { name: "1.1.1.1 Public DNS Resolver privacy commitments" })).toHaveAttribute(
      "href",
      "https://developers.cloudflare.com/1.1.1.1/privacy/public-dns-resolver/"
    );
    expect(screen.getByRole("link", { name: "Data Processing Addendum" })).toHaveAttribute(
      "href",
      "https://resend.com/legal/dpa"
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "https://resend.com/legal/privacy-policy"
    );
    expect(screen.getByRole("link", { name: "D1 Time Travel documentation" })).toHaveAttribute(
      "href",
      "https://developers.cloudflare.com/d1/reference/time-travel/"
    );
    expect(screen.getByRole("heading", { name: "Questions and privacy requests" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Changes to this Notice" })).toBeInTheDocument();
  });

  it("states the scoped contact architecture, active safeguards, and disclosure limits", () => {
    render(<SecurityPage />);

    const title = screen.getByRole("heading", { level: 1, name: "Security & Responsible Disclosure" });
    const introModule = title.closest(".page-intro__surface");
    const effectiveDate = screen.getByText(/Effective date:/).closest("p");

    expect(introModule).toHaveClass("glass-surface", "glass-surface--strong");
    expect(introModule).toHaveTextContent("Site notice");
    expect(introModule).toHaveTextContent(
      "How to report a suspected portfolio security issue without disrupting visitors or third-party services."
    );
    expect(introModule).not.toContainElement(effectiveDate);
    expect(effectiveDate).toHaveClass("legal-document__effective-date");
    expect(screen.getByText(/public portfolio pages are statically generated/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact submission safeguards" })).toBeInTheDocument();
    expect(screen.getByText(/server verifies that token once through Cloudflare Siteverify/)).toBeInTheDocument();
    expect(screen.getByText(/signing key is derived with domain-separated HKDF/)).toBeInTheDocument();
    expect(screen.getByText(/without calling Siteverify a second time/)).toBeInTheDocument();
    expect(screen.getByText(/bounded mail-domain DNS validation/)).toBeInTheDocument();
    expect(screen.getByText(/same separately idempotent Resend payloads/)).toBeInTheDocument();
    expect(screen.getByText(/at most two reservations per normalized email address in a rolling 24-hour window/)).toBeInTheDocument();
    expect(screen.getByText(/does not store the raw address, name, phone number, or message in D1/)).toBeInTheDocument();
    expect(screen.getByText(/WAF rate limiting remains defense in depth/)).toBeInTheDocument();
    expect(screen.getByText(/noreply@mail\.nicolasmgioanni\.dev/)).toBeInTheDocument();
    expect(screen.getByText(/private owner destination and all provider secrets remain server-side/)).toBeInTheDocument();
    expect(screen.getByText(/submitted visitor address that passes format and mail-domain routing checks/)).toBeInTheDocument();
    expect(
      screen.getByText(/fail closed when required Turnstile, ticket, DNS validation, quota storage/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vulnerability Disclosure Policy" })).toHaveAttribute(
      "href",
      "https://www.cloudflare.com/disclosure/"
    );
    expect(screen.getByRole("link", { name: "Coordinated Disclosure Policy" })).toHaveAttribute(
      "href",
      "https://docs.github.com/en/site-policy/security-policies/coordinated-disclosure-of-security-vulnerabilities"
    );
    expect(screen.getByRole("link", { name: "Responsible Disclosure page" })).toHaveAttribute(
      "href",
      "https://resend.com/security/responsible-disclosure"
    );
    expect(screen.getByText("The affected portfolio URL or asset.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No authorization, safe harbor, reward, or bug bounty" })).toBeInTheDocument();
  });

  it("publishes distinct production metadata for every notice", () => {
    expect(generateTermsMetadata().title).toEqual({
      absolute: "Nicolas Gioanni | Site Terms & Accuracy Notice"
    });
    expect(generatePrivacyMetadata().title).toEqual({ absolute: "Nicolas Gioanni | Privacy Notice" });
    expect(generateSecurityMetadata().title).toEqual({
      absolute: "Nicolas Gioanni | Security & Responsible Disclosure"
    });
  });
});

describe("legal effective-date normalization", () => {
  it("publishes and formats the current legal effective date", () => {
    expect(siteSettingsTemplate).toMatch(/^legal_effective_date,2026-08-30$/m);
    expect(resolveLegalEffectiveDate("2026-08-30")).toEqual({ iso: "2026-08-30", label: "August 30, 2026" });
  });

  it("formats another valid settings date and rejects impossible values", () => {
    expect(resolveLegalEffectiveDate("2027-01-09")).toEqual({ iso: "2027-01-09", label: "January 9, 2027" });
    expect(resolveLegalEffectiveDate("2026-02-31")).toEqual({ iso: "2026-08-30", label: "August 30, 2026" });
  });
});
