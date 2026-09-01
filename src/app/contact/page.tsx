import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";

const contactHeader = routeHeaderContent[siteRoutes.contact];
const pageTitle = contactHeader.title;
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
      description={contactHeader.description}
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
      title={pageTitle}
    >
      <ContactForm contactEmail={contactEmail} turnstileSiteKey={turnstileSiteKey} />
    </PageContainer>
  );
}
