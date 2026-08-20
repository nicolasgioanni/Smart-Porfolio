import type { Metadata } from "next";
import { LegalDocument, resolveLegalContactEmail, resolveLegalEffectiveDate } from "@/components/legal/LegalDocument";
import { SmartLink } from "@/components/navigation/SmartLink";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

const pageTitle = "Site Terms & Accuracy Notice";
const pageDescription =
  "Terms governing this informational portfolio, including accuracy, verification, intellectual property, and availability notices.";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), pageTitle, pageDescription);
}

export default function TermsPage() {
  const content = getPortfolioContent();
  const contactEmail = resolveLegalContactEmail(content.siteSettings.legalContactEmail);
  const effectiveDate = resolveLegalEffectiveDate(content.siteSettings.legalEffectiveDate);

  return (
    <LegalDocument
      description="How portfolio information may be used, verified, and attributed."
      effectiveDate={effectiveDate}
      motionEnabled={content.siteSettings.enableScrollMotion}
      title={pageTitle}
    >
      <section>
        <h2>Purpose and status</h2>
        <p>
          This website is an informational portfolio maintained by Nicolas Gioanni to present selected professional,
          academic, research, and project work. It is not an official transcript, employment verification, certification,
          offer, contract, or source of legal, financial, security, or other professional advice.
        </p>
        <p>
          Nothing on this site creates an employment, advisory, fiduciary, contractual, or other professional relationship.
          Any discussion of methods, tools, results, or security practices is provided for portfolio context only.
        </p>
      </section>

      <section>
        <h2>Accuracy and independent verification</h2>
        <p>
          Reasonable care is taken when preparing and maintaining this portfolio. Information may nevertheless be selected,
          condensed, reformatted, rounded, delayed, or no longer current, and a project or role may continue to change after
          its most recent published update.
        </p>
        <p>
          Employment, education, credentials, metrics, authorship, project status, and availability should be independently
          confirmed through Nicolas Gioanni at <SmartLink href="mailto:ngioanni@uw.edu">ngioanni@uw.edu</SmartLink> and,
          where appropriate, the relevant institution or organization before being relied upon for a material decision.
        </p>
        <p>
          Descriptions of collaborative work identify Nicolas Gioanni&apos;s portfolio context and do not imply sole authorship
          or ownership where other contributors, institutions, or organizations participated.
        </p>
      </section>

      <section>
        <h2>External destinations</h2>
        <p>
          Links to repositories, demonstrations, publications, institutions, employers, and other third-party destinations
          are provided for context and convenience. Those destinations are independently controlled, may change without
          notice, and are governed by their own terms, privacy notices, security practices, and availability. A link does not
          imply endorsement of every statement, product, or practice at the destination.
        </p>
      </section>

      <section>
        <h2>Intellectual property and licensing</h2>
        <p>
          Original portfolio text, presentation, and media are protected by applicable intellectual-property laws and are
          reserved except where a separate notice states otherwise. Third-party names, marks, logos, quotations, and materials
          remain the property of their respective owners and are used only for identification, attribution, or portfolio
          context.
        </p>
        <p>
          When the website&apos;s source code is made available, it is licensed separately under the MIT License. That software
          license does not grant permission to reuse portfolio text, personal information, recommendation text, third-party
          media, or other content that is not included within the license&apos;s scope. The license file published with the source
          repository controls if there is any inconsistency concerning licensed code.
        </p>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          The site and its linked materials are provided on an as-available basis. Content, links, functionality, and these
          terms may be corrected, updated, suspended, or removed without prior notice. Continued availability of any project,
          demonstration, repository, manuscript, résumé, or third-party destination is not guaranteed.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For verification, attribution, correction, permission, or questions about this notice, contact Nicolas Gioanni at{" "}
          <SmartLink href={`mailto:${contactEmail}`}>{contactEmail}</SmartLink>.
        </p>
      </section>
    </LegalDocument>
  );
}
