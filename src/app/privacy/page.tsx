import type { Metadata } from "next";
import { LegalDocument, resolveLegalContactEmail, resolveLegalEffectiveDate } from "@/components/legal/LegalDocument";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import { SmartLink } from "@/components/navigation/SmartLink";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";

const privacyHeader = routeHeaderContent[siteRoutes.privacy];
const pageTitle = privacyHeader.title;
const pageDescription =
  "Privacy information for this portfolio, including theme storage, hosting request data, contact submissions, email communications, and visitor choices.";
const privacyNoticeEffectiveDate = resolveLegalEffectiveDate("2026-09-09");

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.privacy,
    title: pageTitle,
    description: pageDescription
  });
}

export default function PrivacyPage() {
  const content = getPortfolioContent();
  const contactEmail = resolveLegalContactEmail(content.siteSettings.legalContactEmail);
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
      description={privacyHeader.description}
      eyebrow={privacyHeader.eyebrow}
      effectiveDate={privacyNoticeEffectiveDate}
      motionEnabled={content.siteSettings.enableScrollMotion}
      title={pageTitle}
    >
      <section>
        <h2>Scope and portfolio data practices</h2>
        <p>
          This Notice applies to this portfolio website. The portfolio has no visitor accounts, payment processing,
          first-party analytics, advertising, or tracking pixels. It does not use advertising, analytics, or cross-site
          tracking cookies. Its contact form uses one short-lived, essential verification cookie to enforce an upfront
          human-verification gate and provides a direct channel for legitimate professional inquiries.
        </p>
        <p>
          The portfolio owner does not sell or rent personal information, use it for targeted or cross-context behavioral
          advertising, or use contact-submission information for unrelated marketing.
        </p>
        <p>
          This does not mean that no personal data is ever processed. The hosting provider may process technical request
          information, and information is processed when a visitor submits the contact form, chooses to send an email, or
          opens an external destination.
        </p>
      </section>

      <section>
        <h2>Browser storage and essential verification cookie</h2>
        <p>
          The site reads your browser or device light-or-dark color preference locally. In System mode, it uses that signal to
          select Light or Dark and follows later changes. The system preference is not written to browser storage or retained
          as a site preference, and the theme feature does not transmit it to the portfolio owner or use it for advertising,
          analytics, cross-site tracking, or identification.
        </p>
        <p>
          If you explicitly select Light, My mode, or Dark, the site stores that palette value in your browser&apos;s local storage
          under the key <code>portfolio-theme</code> so the manual override can be restored on later visits. Choosing System or
          clearing the value removes the override and resumes device-preference following. The site does not present a separate
          consent banner for this user-selected appearance setting or the essential verification cookie described below. Both
          mechanisms support a visitor-requested feature or necessary abuse prevention, and neither is used by the portfolio
          owner for advertising, analytics, or cross-site tracking. The UK Information Commissioner&apos;s Office
          guidance on{" "}
          <SmartLink href="https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/">
            storage and access exceptions
          </SmartLink>
          {" "}is provided as UK-specific regulatory background.
        </p>
        <p>
          After you complete the visible security gate and Cloudflare verifies the Turnstile check, the site sets a signed
          contact-verification cookie for up to 30 minutes. The cookie is restricted to this host and sent only over secure
          connections, is unavailable to browser scripts, and is limited to same-site requests. It contains a verification
          ticket bound to one opaque submission identifier, not your name, email address, phone number, message,
          acknowledgments, or other contact content. It is cleared after successful delivery. If delivery fails, it remains
          available until its original expiry so you can retry without repeating the security check.
        </p>
      </section>

      <section>
        <h2>Hosting and technical request information</h2>
        <p>
          This site is hosted by {hostingProvider}. When a browser requests the site, {hostingProvider} may process standard
          request and network information such as an IP address, approximate location derived from the IP address, system or
          device configuration, request timestamps, referring information, and traffic or diagnostic data. {hostingProvider}{" "}
          processes this information in connection with hosting, routing, security, diagnostics, and related service
          operation. {hostingProvider} describes its own processing in the{" "}
          <SmartLink href={hostingPrivacyUrl}>{hostingProvider} Privacy Policy</SmartLink>. That provider policy governs the
          provider&apos;s own processing; this Notice describes the portfolio owner&apos;s practices.
        </p>
      </section>

      <section>
        <h2>Contact requests and email communications</h2>
        <p>
          The contact form collects your first name, last name, email address, optional phone number, a message of up to 500
          characters, and your confirmation of both required acknowledgments shown during review. It also processes a Cloudflare
          Turnstile response, an opaque submission identifier, and limited request information needed to validate the
          submission and prevent abuse. After verification, the form opens automatically after a brief success state unless
          you activate Continue sooner. Opening the form records a form-start timestamp. The final request also includes that
          timestamp and a hidden anti-spam field. These values are used to identify implausibly
          fast or automated submissions; the hidden field is expected to remain empty for ordinary visitors. The information
          is used to review your inquiry, send a receipt, respond to you, and protect the contact channel.
        </p>
        <p>
          Loading and completing the visible upfront Turnstile gate causes the browser to communicate with Cloudflare before
          contact fields are entered. Cloudflare&apos;s{" "}
          <SmartLink href="https://www.cloudflare.com/turnstile-privacy-policy/">
            Turnstile Privacy Addendum
          </SmartLink>{" "}
          identifies limited browser and network signals, including the IP address, TLS fingerprint, user-agent header, site
          key, and associated origin, that Cloudflare processes for bot detection and service improvement. Cloudflare&apos;s{" "}
          <SmartLink href="https://developers.cloudflare.com/turnstile/">Turnstile technical overview</SmartLink> states that
          the service does not access, store, or transmit user communications, form entries, or page input.
        </p>
        <p>
          In this implementation, contact fields are not supplied to Turnstile. The form creates an opaque identifier for the
          new message and supplies that identifier as Turnstile custom data. When you complete the gate, the widget creates a
          fresh, single-use token, and the browser sends only that
          token and the opaque submission identifier over HTTPS to <code>/api/contact/verify</code>. That narrowly scoped
          Cloudflare Pages Function may include the connecting IP address when it asks Cloudflare to verify the token. It
          requires successful verification, the expected action and hostname, and matching custom data before establishing
          the short-lived verification cookie. Contact fields remain unavailable until verification succeeds, then the form
          opens automatically after a brief delay or sooner when you activate Continue.
        </p>
        <p>
          Your contact-field values remain in your browser while you complete and review the form. They are transmitted over
          HTTPS to <code>/api/contact</code> only when you choose <em>Send request</em>. That endpoint validates the signed
          verification ticket, matching submission identifier, submitted fields, and acknowledgments. For mail-domain
          validation, the server sends only the domain portion of the supplied address and the requested DNS record type. It
          does not send the local part of the address or other contact fields to Cloudflare&apos;s DNS-over-HTTPS resolver.
          Cloudflare describes resolver logging and retention in its{" "}
          <SmartLink href="https://developers.cloudflare.com/1.1.1.1/privacy/public-dns-resolver/">
            1.1.1.1 Public DNS Resolver privacy commitments
          </SmartLink>. This check improves input quality but does not prove that a particular mailbox exists or belongs to
          the submitter. The endpoint does not send the Turnstile response through Cloudflare verification a second time.
          After an email-provider attempt or uncertain delivery outcome, reviewed fields are locked so the request can be
          retried with the same submission identifier and idempotent delivery payloads. A still-valid signed ticket permits only that
          same locked delivery retry without another Turnstile check. If the ticket expires first, the form returns to the
          visible gate and requires a fresh token while preserving the locked delivery identity and content. Successful
          refresh returns to the locked review and does not send automatically.
        </p>
        <p>
          Before email delivery, an eligible request reserves one of two allowed attempts for that normalized address during
          a rolling 24-hour window. The reservation stores only the opaque submission identifier, keyed email value, opaque keyed full-payload
          fingerprint, reservation time, and expiry time in Cloudflare D1; it does not store the name, raw email address,
          phone number, or message. The same identifier can retry without taking another slot only when its address and
          payload fingerprints match, while a provider or network failure keeps the original reservation until it expires.
          The server normalizes the address by trimming it and converting it to lowercase, then stores a keyed HMAC-SHA-256
          value rather than the address itself. It separately fingerprints the normalized delivery payload so a changed
          same-identifier retry is rejected without storing the field values.
        </p>
        <p>
          After acceptance, Resend is asked first to deliver a transactional confirmation to the email address you supplied.
          Only after Resend accepts that request is it asked to deliver the private notification to the portfolio owner. The
          confirmation summarizes the information you submitted and links to this Privacy Notice and the Site Terms &amp;
          Accuracy Notice. Acceptance by Resend does not guarantee final mailbox delivery; a receiving system can reject or
          bounce the message later. The private owner recipient is server-side configuration and is not included in the page,
          browser bundle, or endpoint response.
        </p>
        <p>
          To create and deliver those messages, Resend receives the submitted name, email address, optional phone number,
          message, sender and recipient addressing data, and opaque submission-scoped idempotency keys. This implementation
          does not send Resend the Turnstile token, verification cookie, keyed D1 email value, form-start timestamp, hidden
          anti-spam value, or acknowledgment flags.
        </p>
        <p>
          Resend&apos;s{" "}
          <SmartLink href="https://resend.com/legal/dpa">Data Processing Addendum</SmartLink> describes Customer Data as
          including email addresses, message content, and related metadata, and explains Resend&apos;s processor or service-provider
          role for that data. Resend separately publishes a{" "}
          <SmartLink href="https://resend.com/security/gdpr">GDPR overview</SmartLink> addressing storage, international
          transfers, and data-subject support; a{" "}
          <SmartLink href="https://resend.com/legal/privacy-policy">Privacy Policy</SmartLink> for information it controls in
          connection with its own sites, accounts, and services; and a current{" "}
          <SmartLink href="https://resend.com/legal/subprocessors">subprocessor list</SmartLink>. Visitors should direct
          questions about a portfolio submission to the portfolio owner first rather than treating those materials as a
          separate agreement with Resend.
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
          receive information under its own privacy notice. This Notice does not govern third-party destinations.
        </p>
        <p>
          Provider materials linked in this Notice are independently maintained and may be revised by their respective
          providers. They are supplied for transparency and reference only; they do not replace or become part of this Notice,
          and the portfolio does not adopt provider statements as its own promises.
        </p>
      </section>

      <section>
        <h2>Retention and security</h2>
        <p>
          Full contact submissions are not added to a first-party contact database. Cloudflare D1 retains the pseudonymous
          reservation record described above for the rolling 24-hour limit. Once its expiry time passes it no longer counts
          toward the limit and is removed during subsequent reservation cleanup; an expired row may therefore remain until
          later contact traffic triggers cleanup. Deletion from the active D1 table may not immediately remove historical
          recovery copies maintained by Cloudflare; Cloudflare&apos;s{" "}
          <SmartLink href="https://developers.cloudflare.com/d1/reference/time-travel/">
            D1 Time Travel documentation
          </SmartLink>{" "}
          describes its current plan-dependent recovery windows.
        </p>
        <p>
          Resend, Cloudflare and its DNS and D1 services, receiving email services, and the recipient mailboxes may separately
          retain messages, delivery records, security signals, queries, or request metadata according to their configurations
          and practices. The portfolio owner retains contact correspondence only for as long as reasonably necessary to
          address the inquiry, maintain appropriate professional records, investigate abuse or a security concern, or satisfy
          an applicable obligation. Because the relevant period depends on the correspondence and on provider, mailbox,
          backup, and operational settings, this Notice does not represent a fixed deletion date.
        </p>
        <p>
          A manually selected theme override remains in your browser until you choose System or remove it. The contact-verification cookie is cleared
          after successful delivery or expires after 30 minutes; a failed delivery leaves it available only for a retry during
          that original period. Cloudflare&apos;s{" "}
          <SmartLink href="https://developers.cloudflare.com/d1/reference/data-security/">
            D1 data-security documentation
          </SmartLink>{" "}
          and Resend&apos;s <SmartLink href="https://resend.com/security">security overview</SmartLink> describe safeguards those
          providers state they apply to their services. Those descriptions are provider representations, not an independent
          portfolio audit or a guarantee. Reasonable measures are used to maintain the portfolio and limit unnecessary
          collection, but no internet transmission, browser storage mechanism, hosting service, bot-protection service, or
          email system can be guaranteed completely secure.
        </p>
      </section>

      <section>
        <h2>Questions and privacy requests</h2>
        <p>
          To ask a question about this Notice or request access to, correction of, or deletion of personal information under
          the portfolio owner&apos;s control, contact <SmartLink href={`mailto:${contactEmail}`}>{contactEmail}</SmartLink>.
          Please identify the relevant submission, page, or material without sending additional sensitive information. A
          request may be verified and will be evaluated subject to applicable law, security, recordkeeping, and legitimate
          operational needs. If a request concerns Customer Data submitted through the portfolio and held by a service
          provider, contact the portfolio owner first so provider assistance can be sought where appropriate. A provider&apos;s
          privacy materials identify its own channel for processing it controls independently.
        </p>
      </section>

      <section>
        <h2>Changes to this Notice</h2>
        <p>
          This Notice may be revised to reflect changes in the portfolio, its service providers, or applicable requirements. A
          revised version will be posted here with an updated effective date. Where applicable law requires another form of
          notice or consent, that requirement will be followed.
        </p>
      </section>
    </LegalDocument>
  );
}
