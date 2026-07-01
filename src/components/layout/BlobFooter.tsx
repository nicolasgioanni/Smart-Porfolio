import type { GeneratedPortfolioContent, PortfolioLink } from "@/content/types";
import { GlassBlob } from "@/components/glass/GlassBlob";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { GlassLink } from "@/components/glass/GlassLink";
import { SocialLinkGroup } from "@/components/navigation/SocialLinkGroup";
import { sortGeneric } from "@/lib/content/sortPortfolioContent";

const conciseFooterKinds = new Set(["github", "linkedin", "email", "resume"]);
const repositoryKinds = new Set(["repository", "source", "github_repository"]);

function stringSetting(value: string | number | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function findRepositoryLink(content: GeneratedPortfolioContent): PortfolioLink | undefined {
  const repositoryUrl = stringSetting(content.siteSettings.repositoryUrl);

  if (repositoryUrl) {
    return {
      id: "site-settings-repository",
      label: "Source available on GitHub",
      url: repositoryUrl,
      kind: "github_repository",
      isPrimary: false,
      showOnHome: false,
      showInHeader: false,
      showInFooter: true
    };
  }

  return content.links.find((link) => repositoryKinds.has(link.kind.toLowerCase()));
}

function selectConciseFooterLinks(links: PortfolioLink[], repositoryLink: PortfolioLink | undefined): PortfolioLink[] {
  const selectedLinks = links.filter((link) => link.showInFooter && conciseFooterKinds.has(link.kind.toLowerCase()));
  const uniqueLinks = new Map<string, PortfolioLink>();

  for (const link of sortGeneric(selectedLinks)) {
    uniqueLinks.set(link.url, link);
  }

  if (repositoryLink) {
    uniqueLinks.delete(repositoryLink.url);
  }

  return Array.from(uniqueLinks.values()).slice(0, 4);
}

function createLicenseText(content: GeneratedPortfolioContent): { label: string; url?: string } {
  const licenseName = stringSetting(content.siteSettings.licenseName);
  const licenseUrl = stringSetting(content.siteSettings.licenseUrl);

  if (!licenseName || licenseName.toLowerCase() === "all rights reserved") {
    return { label: "All rights reserved." };
  }

  return { label: `Licensed under ${licenseName}.`, url: licenseUrl };
}

export function BlobFooter({ content }: { content: GeneratedPortfolioContent }) {
  const currentYear = new Date().getFullYear();
  const owner = stringSetting(content.siteSettings.copyrightOwner) ?? content.profile.fullName;
  const repositoryLink = findRepositoryLink(content);
  const footerLinks = selectConciseFooterLinks(content.links, repositoryLink);
  const license = createLicenseText(content);

  return (
    <footer className="blob-footer">
      <GlassBlob className="blob-footer__island" tone="footer">
        <div className="blob-footer__primary">
          <p className="blob-footer__copyright">
            {"\u00a9"} {currentYear} {owner}. All rights reserved.
          </p>
          <p className="blob-footer__meta">
            {license.url ? <GlassLink href={license.url}>{license.label}</GlassLink> : <span>{license.label}</span>}
            {repositoryLink ? <GlassIconLink kind="github" label="Source available on GitHub" url={repositoryLink.url} /> : null}
          </p>
        </div>

        <div className="blob-footer__secondary">
          {footerLinks.length > 0 ? <SocialLinkGroup compact label="Footer links" links={footerLinks} /> : null}
        </div>
      </GlassBlob>
    </footer>
  );
}
