import type { Metadata } from "next";
import { LegalDocument, resolveLegalContactEmail, resolveLegalEffectiveDate } from "@/components/legal/LegalDocument";
import { SmartLink } from "@/components/navigation/SmartLink";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

const pageTitle = "Security & Responsible Disclosure";
const pageDescription =
  "Security architecture, reporting instructions, testing boundaries, and coordinated-disclosure expectations for this portfolio.";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), pageTitle, pageDescription);
}

export default function SecurityPage() {
  const content = getPortfolioContent();
  const contactEmail = resolveLegalContactEmail(content.siteSettings.legalContactEmail);
  const effectiveDate = resolveLegalEffectiveDate(content.siteSettings.legalEffectiveDate);

  return (
    <LegalDocument
      description="How to report a suspected portfolio security issue without disrupting visitors or third-party services."
      effectiveDate={effectiveDate}
      motionEnabled={content.siteSettings.enableScrollMotion}
      title={pageTitle}
    >
      <section>
        <h2>Architecture and scope</h2>
        <p>
          The public portfolio pages are statically generated and do not provide visitor accounts, payments, or a general
          application API. Contact requests are handled by two narrowly scoped Cloudflare Pages Functions. Cloudflare
          Turnstile supplies the initial bot-protection signal, and Resend delivers the visitor confirmation and private owner
          notification. Hosting, source control, Turnstile, Resend, receiving email systems, linked demonstrations, and other
          external services are independently operated third-party systems and are outside this site&apos;s testing scope.
        </p>
        <p>
          An issue in a portfolio page, asset, or portfolio-owned source code should be reported through this Notice. An issue
          in a provider&apos;s own platform must instead be handled under that provider&apos;s current authorized process—for example,
          Cloudflare&apos;s <SmartLink href="https://www.cloudflare.com/disclosure/">Vulnerability Disclosure Policy</SmartLink>,
          GitHub&apos;s{" "}
          <SmartLink href="https://docs.github.com/en/site-policy/security-policies/coordinated-disclosure-of-security-vulnerabilities">
            Coordinated Disclosure Policy
          </SmartLink>, or Resend&apos;s{" "}
          <SmartLink href="https://resend.com/security/responsible-disclosure">Responsible Disclosure page</SmartLink>. The
          provider&apos;s current scope, rules, and reporting availability control.
        </p>
        <p>
          Those provider pages are independently maintained, may change without notice from this portfolio, and govern only
          the systems and conduct within the scope they identify. They do not authorize testing of this portfolio or extend a
          provider&apos;s safe harbor, reward, or bounty terms to it.
        </p>
      </section>

      <section>
        <h2>Contact submission safeguards</h2>
        <p>
          Turnstile is visibly completed at the start of the form. The server verifies that token once through Cloudflare
          Siteverify at <code>/api/contact/verify</code>, requiring the exact expected action and an allowed hostname. Success
          sets a signed, 30-minute, <code>HttpOnly</code>, <code>Secure</code>, <code>SameSite=Strict</code>, host-only
          verification cookie bound to one opaque submission identifier. The form advances automatically on success, with
          Continue retained only as a fallback. The cookie contains no contact content, and its signing key is derived with
          domain-separated HKDF from the existing server-only Turnstile secret rather than a new secret.
        </p>
        <p>
          Browser-side field checks improve usability but are not treated as a security boundary. The final
          <code>/api/contact</code> endpoint validates the signed ticket and matching submission identifier without calling
          Siteverify a second time. It independently performs schema, type, length, email, required-acknowledgment, timing,
          honeypot, and bounded mail-domain DNS validation, and returns generic JSON errors that do not expose provider
          responses or private configuration. Successful delivery clears the cookie. A delivery failure retains the
          still-valid ticket for retry until its original expiry. After the first delivery attempt, reviewed fields remain
          locked so any failed or uncertain retry uses the same submission identifier and the same separately idempotent
          Resend payloads.
        </p>
        <p>
          Email delivery uses a fixed, verified sender identity. Automated confirmation mail is sent from
          noreply@mail.nicolasmgioanni.dev and directs follow-up to the public ngioanni@uw.edu address. The submitted visitor
          address that passes format and mail-domain routing checks receives the confirmation and is used as the reply-to
          address on the private owner notification, but it cannot control the sender, private destination, or other mail
          headers. The private owner destination and all provider secrets remain server-side and are not returned to the
          browser. The confirmation is submitted to Resend first; the private owner notification is submitted only after that
          request is accepted. Separate submission-scoped idempotency keys make a partial-failure retry safe without
          duplicating an already accepted confirmation.
        </p>
        <p>
          The application enforces at most two reservations per normalized email address in a rolling 24-hour window. It
          stores only an opaque submission identifier, a domain-separated keyed HMAC-SHA-256 of the normalized address, and
          reservation and expiry times in Cloudflare D1. It does not store the raw address, name, phone number, or message in
          D1. A same-identifier retry for the same address does not consume another slot. The handler fails closed when the D1
          binding or query is unavailable. Operator-managed Cloudflare WAF rate limiting remains defense in depth and should
          use a non-interactive response rather than repeat the visible human check. The application code does not
          intentionally log request bodies or contact fields; Cloudflare and other providers may maintain request, delivery,
          and security metadata under their own practices. The handlers fail closed when required Turnstile, ticket, DNS
          validation, quota storage, email, or private-recipient configuration is unavailable. A browser widget or client-side
          success state alone never authorizes delivery.
        </p>
        <p>
          Cloudflare&apos;s{" "}
          <SmartLink href="https://developers.cloudflare.com/d1/reference/data-security/">
            D1 data-security documentation
          </SmartLink>{" "}
          and Resend&apos;s <SmartLink href="https://resend.com/security">security overview</SmartLink> describe safeguards those
          providers state they apply to their services. Those descriptions are provider representations rather than an
          independent portfolio audit, certification, warranty, or guarantee.
        </p>
      </section>

      <section>
        <h2>Reporting a suspected issue</h2>
        <p>
          Send a report to <SmartLink href={`mailto:${contactEmail}`}>{contactEmail}</SmartLink>. To support efficient review,
          include:
        </p>
        <ul>
          <li>The affected portfolio URL or asset.</li>
          <li>Clear, minimal reproduction steps and any relevant browser or environment information.</li>
          <li>The observed and reasonably anticipated impact.</li>
          <li>Supporting evidence, such as a redacted screenshot, request, or response.</li>
        </ul>
        <p>
          Do not include passwords, access tokens, private keys, unnecessary personal information, or other sensitive data.
          Redact evidence wherever possible and provide only what is necessary to explain the issue.
        </p>
      </section>

      <section>
        <h2>Testing boundaries</h2>
        <p>This page does not authorize security testing. In particular, do not:</p>
        <ul>
          <li>Conduct denial-of-service, resource-exhaustion, destructive, or disruptive activity.</li>
          <li>Use high-volume automated scanning or activity that degrades availability for visitors.</li>
          <li>Use social engineering, phishing, impersonation, physical intrusion, or attacks against any person.</li>
          <li>Intrude on privacy or attempt to access, obtain, alter, delete, retain, or disclose data that is not yours.</li>
          <li>Establish persistence, execute malware, exfiltrate information, or move beyond the minimum evidence of an issue.</li>
          <li>
            Test Cloudflare, GitHub, Resend, receiving email providers, linked demonstrations, institutional systems, or any
            other third-party system.
          </li>
        </ul>
        <p>
          Stop immediately if an action may affect another person, expose sensitive information, or impair a system. Do not
          treat this Notice as authorization. If scope or authorization is uncertain, stop and obtain written authorization
          from the relevant system owner and, where appropriate, independent legal advice before proceeding.
        </p>
      </section>

      <section>
        <h2>Coordinated disclosure</h2>
        <p>
          Please allow a reasonable opportunity to acknowledge, investigate, and address a report before sharing it publicly
          or with additional parties. Avoid public disclosure of exploit details while an issue may remain actionable. Any
          timing or communication plan should be coordinated in writing, and reports should continue to exclude sensitive data.
        </p>
      </section>

      <section>
        <h2>No authorization, safe harbor, reward, or bug bounty</h2>
        <p>
          This Notice provides a reporting channel and requested disclosure process only. It does not create or imply
          authorization to test any system, a safe harbor from legal or contractual obligations, a promise not to pursue
          available remedies, a reward, compensation, or a bug-bounty program. Submission of a report does not create a
          contractual, agency, employment, fiduciary, or confidential relationship.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about the scope of this Notice should be sent to{" "}
          <SmartLink href={`mailto:${contactEmail}`}>{contactEmail}</SmartLink> before any testing is considered.
        </p>
      </section>
    </LegalDocument>
  );
}
