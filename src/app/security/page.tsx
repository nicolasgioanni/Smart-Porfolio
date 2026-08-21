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
          application API. Contact requests are handled by a narrowly scoped Cloudflare Pages Function. Cloudflare Turnstile
          supplies bot-protection signals, and Resend delivers the visitor confirmation and private owner notification.
          Hosting, source control, Turnstile, Resend, receiving email systems, linked demonstrations, and other external
          services are independently operated third-party systems and are outside this site&apos;s testing scope.
        </p>
        <p>
          A suspected issue should concern the portfolio pages or assets controlled by Nicolas Gioanni. An issue affecting a
          third-party service must be reported through that provider&apos;s authorized disclosure process.
        </p>
      </section>

      <section>
        <h2>Contact submission safeguards</h2>
        <p>
          Browser-side field checks improve usability but are not treated as a security boundary. The Pages Function performs
          independent schema, type, length, email, and required-acknowledgment validation; verifies the Turnstile token with
          Cloudflare on the server; applies request rate limits and abuse checks; and returns generic errors that do not expose
          provider responses or private configuration.
        </p>
        <p>
          Email delivery uses a fixed, verified sender identity. Automated confirmation mail is sent from
          noreply@mail.nicolasmgioanni.dev and directs follow-up to the public ngioanni@uw.edu address. Visitor-supplied
          addresses are used only as recipients or contact details and cannot control the message sender, reply handling, or
          other mail headers. The private owner destination and all provider secrets remain server-side and are not returned
          to the browser. The handler minimizes sensitive logging and fails closed when required Turnstile, validation,
          rate-limit, email, or private-recipient configuration is unavailable. A browser widget or client-side success state
          alone never authorizes delivery.
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
          Stop immediately if an action may affect another person, expose sensitive information, or impair a system. Obtain
          written authorization from the relevant system owner before conducting any testing not already permitted by law and
          the owner&apos;s published policies.
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
          This notice provides a reporting channel and requested disclosure process only. It does not create or imply
          authorization to test any system, a safe harbor from legal or contractual obligations, a promise not to pursue
          available remedies, a reward, compensation, or a bug-bounty program. Submission of a report does not create a
          contractual, agency, employment, fiduciary, or confidential relationship.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about the scope of this notice should be sent to{" "}
          <SmartLink href={`mailto:${contactEmail}`}>{contactEmail}</SmartLink> before any testing is considered.
        </p>
      </section>
    </LegalDocument>
  );
}
