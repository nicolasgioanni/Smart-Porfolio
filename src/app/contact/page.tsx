import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

const pageTitle = "Contact";
const pageDescription =
  "Send Nicolas Gioanni a prioritized professional contact request.";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.contact,
    title: pageTitle,
    description: pageDescription
  });
}

export default function ContactPage() {
  const content = getPortfolioContent();
  const contactEmail = content.siteSettings.legalContactEmail?.trim() || content.profile.email;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  return (
    <PageContainer
      className="page-container--contact"
      description="My University of Washington inbox is public and receives a high volume of email. For the fastest response and priority review, send a quick request through this form."
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
      title={pageTitle}
    >
      <ContactForm contactEmail={contactEmail} turnstileSiteKey={turnstileSiteKey} />
    </PageContainer>
  );
}
