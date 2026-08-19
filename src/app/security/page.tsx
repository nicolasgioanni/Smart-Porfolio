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
          This portfolio is delivered as a statically generated website. It does not provide visitor accounts, payments,
          submission forms, databases, or application APIs. Hosting, source control, email, linked demonstrations, and other
          external services are independently operated third-party systems and are outside this site&apos;s testing scope.
        </p>
        <p>
          A suspected issue should concern the portfolio pages or assets controlled by Nicolas Gioanni. An issue affecting a
          third-party service must be reported through that provider&apos;s authorized disclosure process.
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
            Test Vercel, GitHub, email providers, linked demonstrations, institutional systems, or any other third-party system.
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
