import type { GeneratedPortfolioContent } from "@/content/types";
import {
  InteractiveBlobFooter,
  type ProgressiveFooterLink
} from "@/components/layout/InteractiveBlobFooter";

const repositoryKinds = new Set(["repository", "source", "github_repository"]);

function stringSetting(value: string | number | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function findRepositoryUrl(content: GeneratedPortfolioContent): string | undefined {
  return (
    stringSetting(content.siteSettings.repositoryUrl) ??
    content.links.find((link) => repositoryKinds.has(link.kind.toLowerCase()))?.url
  );
}

function createResourceLinks(content: GeneratedPortfolioContent): ProgressiveFooterLink[] {
  const repositoryUrl = findRepositoryUrl(content);
  const licenseName = stringSetting(content.siteSettings.licenseName);
  const licenseUrl = stringSetting(content.siteSettings.licenseUrl);
  const contactEmail = stringSetting(content.siteSettings.legalContactEmail) ?? content.profile.email;
  const links: ProgressiveFooterLink[] = [];

  if (repositoryUrl) {
    links.push({ href: repositoryUrl, label: "Source Code" });
  }

  if (licenseName && licenseUrl) {
    links.push({
      href: licenseUrl,
      label: /license$/i.test(licenseName) ? licenseName : `${licenseName} License`
    });
  }

  if (contactEmail) {
    links.push({ href: `mailto:${contactEmail}`, label: contactEmail });
  }

  return links;
}

export function BlobFooter({ content }: { content: GeneratedPortfolioContent }) {
  const currentYear = new Date().getFullYear();
  const owner = stringSetting(content.siteSettings.copyrightOwner) ?? content.profile.fullName;

  return (
    <InteractiveBlobFooter
      closingStatement="Original portfolio content and media are protected. Site source code is licensed under the MIT License. Third-party names, marks, and materials remain the property of their respective owners."
      compactCopyright={`\u00a9 ${currentYear} ${owner}. All rights reserved except where otherwise stated.`}
      identityDescription="Software engineering, research, and cybersecurity portfolio."
      noticeLinks={[
        { href: "/terms", label: "Site Terms & Accuracy" },
        { href: "/privacy", label: "Privacy Notice" },
        { href: "/security", label: "Security & Responsible Disclosure" }
      ]}
      owner={owner}
      resourceLinks={createResourceLinks(content)}
    />
  );
}
