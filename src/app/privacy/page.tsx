import type { Metadata } from "next";
import { LegalDocument, resolveLegalContactEmail, resolveLegalEffectiveDate } from "@/components/legal/LegalDocument";
import { SmartLink } from "@/components/navigation/SmartLink";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

const pageTitle = "Privacy Notice";
const pageDescription =
  "Privacy information for this portfolio, including theme storage, hosting request data, email communications, and visitor choices.";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), pageTitle, pageDescription);
}

export default function PrivacyPage() {
  const content = getPortfolioContent();
  const contactEmail = resolveLegalContactEmail(content.siteSettings.legalContactEmail);
  const effectiveDate = resolveLegalEffectiveDate(content.siteSettings.legalEffectiveDate);
  const hostingProvider =
    typeof content.siteSettings.hostingProviderName === "string" && content.siteSettings.hostingProviderName.trim()
      ? content.siteSettings.hostingProviderName.trim()
      : "Vercel";
  const hostingPrivacyUrl =
    typeof content.siteSettings.hostingPrivacyUrl === "string" && content.siteSettings.hostingPrivacyUrl.startsWith("https://")
      ? content.siteSettings.hostingPrivacyUrl
      : "https://vercel.com/legal/privacy-notice";

  return (
    <LegalDocument
      description="What information may be processed when you visit this portfolio or choose to make contact."
      effectiveDate={effectiveDate}
      motionEnabled={content.siteSettings.enableScrollMotion}
      title={pageTitle}
    >
      <section>
        <h2>Scope and portfolio data practices</h2>
        <p>
          This notice applies to this portfolio website. The portfolio has no visitor accounts, submission forms,
          first-party analytics, advertising, tracking pixels, or application-set cookies. It does not ask visitors to enter
          payment information or create a profile.
        </p>
        <p>
          This does not mean that no personal data is ever processed. The hosting provider may process technical request
          information, and information is processed when a visitor chooses to send an email or open an external destination.
        </p>
      </section>

      <section>
        <h2>Appearance preference stored in your browser</h2>
        <p>
          When you select a color theme, the site stores the selected value in your browser&apos;s local storage under the key{" "}
          <code>portfolio-theme</code>. The value is used only to restore your chosen appearance on later visits. It is not used
          for advertising, analytics, cross-site tracking, or identification.
        </p>
        <p>
          The preference remains on your device until you change it or clear this site&apos;s local storage through your browser&apos;s
          site-data or privacy controls. Clearing the value restores the site&apos;s default theme. A separate cookie banner is not
          presented for this user-selected appearance preference; transparent information about the storage remains available
          here. For general regulatory context, see the UK Information Commissioner&apos;s Office guidance on{" "}
          <SmartLink href="https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/">
            storage and access exceptions
          </SmartLink>
          .
        </p>
      </section>

      <section>
        <h2>Hosting and technical request information</h2>
        <p>
          This site is hosted by {hostingProvider}. When a browser requests the site, {hostingProvider} may process standard
          request and network information such as an IP address, approximate location derived from the IP address, system or
          device configuration, request timestamps, referring information, and traffic or diagnostic data. That processing is
          controlled by the hosting provider and is described in the{" "}
          <SmartLink href={hostingPrivacyUrl}>{hostingProvider} Privacy Notice</SmartLink>.
        </p>
      </section>

      <section>
        <h2>Email communications</h2>
        <p>
          Selecting an email link opens your chosen email service or application. If you send a message, the message and any
          information you include—such as your name, email address, organization, attachments, and correspondence—will be
          processed to review and respond to your communication. Email providers involved in transmitting or storing the
          message operate under their own terms and privacy practices.
        </p>
      </section>

      <section>
        <h2>External destinations</h2>
        <p>
          This portfolio links to third-party websites and services, including repositories, institutions, professional
          profiles, publications, and demonstrations. Opening one of those destinations may allow that operator to collect or
          receive information under its own privacy notice. This notice does not govern third-party destinations.
        </p>
      </section>

      <section>
        <h2>Retention and security</h2>
        <p>
          The local theme preference remains in your browser until you remove it. Email correspondence may be retained for as
          long as reasonably necessary to address the communication, maintain appropriate professional records, resolve a
          concern, or satisfy an applicable obligation. Hosting logs and related request information are retained according to
          the hosting provider&apos;s practices.
        </p>
        <p>
          Reasonable measures are used to maintain the portfolio and limit unnecessary collection. No internet transmission,
          browser storage mechanism, hosting service, or email system can be guaranteed completely secure.
        </p>
      </section>

      <section>
        <h2>Questions, corrections, and removal requests</h2>
        <p>
          For a privacy inquiry, or to request correction or removal of published professional information concerning you,
          contact <SmartLink href={`mailto:${contactEmail}`}>{contactEmail}</SmartLink>. Please identify the relevant page or
          material and explain the requested change. A request will be evaluated in light of accuracy, attribution,
          recordkeeping, legal, and legitimate portfolio considerations.
        </p>
      </section>
    </LegalDocument>
  );
}
