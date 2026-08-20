import type { Metadata } from "next";
import { LegalDocument, resolveLegalContactEmail, resolveLegalEffectiveDate } from "@/components/legal/LegalDocument";
import { SmartLink } from "@/components/navigation/SmartLink";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

const pageTitle = "Privacy Notice";
const pageDescription =
  "Privacy information for this portfolio, including theme storage, hosting request data, contact submissions, email communications, and visitor choices.";

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
      : "Cloudflare";
  const hostingPrivacyUrl =
    typeof content.siteSettings.hostingPrivacyUrl === "string" && content.siteSettings.hostingPrivacyUrl.startsWith("https://")
      ? content.siteSettings.hostingPrivacyUrl
      : "https://www.cloudflare.com/privacypolicy/";

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
          This notice applies to this portfolio website. The portfolio has no visitor accounts, payment processing,
          first-party analytics, advertising, tracking pixels, or application-set cookies. Its contact form provides a
          direct channel for legitimate professional inquiries.
        </p>
        <p>
          This does not mean that no personal data is ever processed. The hosting provider may process technical request
          information, and information is processed when a visitor submits the contact form, chooses to send an email, or
          opens an external destination.
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
        <h2>Contact requests and email communications</h2>
        <p>
          The contact form collects your first name, last name, email address, optional phone number, message, and your
          confirmation of each of the three required acknowledgments shown during review. It also processes a Cloudflare
          Turnstile response and limited request information needed to validate the submission, prevent abuse, and apply rate
          limits. The information is used to review your inquiry, send a receipt, and respond to you.
        </p>
        <p>
          Values remain in your browser while you complete and review the form. They are transmitted over HTTPS to a
          narrowly scoped Cloudflare Pages Function only when you choose <em>Send request</em>. The endpoint verifies the
          Turnstile response and validates the submitted fields and acknowledgments before accepting the request.
        </p>
        <p>
          After acceptance, Resend delivers a transactional confirmation to the email address you supplied and a private
          notification to the portfolio owner. The confirmation summarizes the information you submitted. The private owner
          recipient is server-side configuration and is not included in the page, browser bundle, or endpoint response.
          Cloudflare, Resend, and the receiving email services process information under their own terms and privacy
          practices.
        </p>
        <p>
          Selecting a direct email link instead opens your chosen email service or application. If you send an email, the
          message, attachments, addressing information, and subsequent correspondence are processed to review and respond to
          your communication. Do not submit passwords, payment data, government identifiers, medical information, access
          tokens, or other secrets through either contact method.
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
          The portfolio does not intentionally add contact submissions to a first-party contact database. The Cloudflare
          function processes each accepted request for validation and email delivery. Resend, Cloudflare, receiving email
          services, and the recipient mailboxes may retain messages, delivery records, security signals, or request metadata
          according to their configurations and practices. Contact correspondence may be retained for as long as reasonably
          necessary to respond, maintain appropriate professional records, investigate abuse or a security concern, or meet
          an applicable obligation. No exact retention period is promised where the relevant period is controlled by a
          service provider, mailbox setting, backup cycle, or legitimate operational need.
        </p>
        <p>
          The local theme preference remains in your browser until you remove it. Reasonable measures are used to maintain
          the portfolio and limit unnecessary collection, but no internet transmission, browser storage mechanism, hosting
          service, bot-protection service, or email system can be guaranteed completely secure.
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
