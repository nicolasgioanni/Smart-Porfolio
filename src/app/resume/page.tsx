import type { Metadata } from "next";
import { GlassButton } from "@/components/glass/GlassButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import { ResumePanel } from "@/components/portfolio/resume/ResumePanel";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";

const resumeHeader = routeHeaderContent[siteRoutes.resume];

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.resume,
    title: resumeHeader.title,
    description: "Request Nicolas Gioanni's private resume by email or through the priority contact form."
  });
}

export default function ResumePage() {
  const content = getPortfolioContent();
  const contactEmail = content.siteSettings.legalContactEmail?.trim() || content.profile.email;
  const resumeRequestEmail = `mailto:${contactEmail}?subject=Resume%20Request`;

  return (
    <PageContainer
      title={resumeHeader.title}
      description={resumeHeader.description}
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ResumePanel>
        <div className="resume-panel__content resume-access__content">
          <p className="eyebrow">Private access</p>
          <h2>Request my resume</h2>
          <p>
            Email me directly at <a href={resumeRequestEmail}>{contactEmail}</a> to request the most current copy.
          </p>
          <p>For the fastest response and priority review, send a short request through the contact form.</p>
        </div>
        <div className="resume-access__actions">
          <GlassButton href="/contact" variant="primary">
            Open contact form
          </GlassButton>
          <GlassButton href={resumeRequestEmail} variant="secondary">
            Email resume request
          </GlassButton>
        </div>
      </ResumePanel>
    </PageContainer>
  );
}
