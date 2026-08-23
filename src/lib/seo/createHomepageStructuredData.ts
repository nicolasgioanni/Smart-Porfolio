import type { GeneratedPortfolioContent, PortfolioLink } from "@/content/types";
import {
  ALTERNATE_SITE_NAMES,
  CANONICAL_HOMEPAGE_URL,
  PREFERRED_SITE_NAME,
  SITE_LANGUAGE,
  createCanonicalUrl
} from "@/lib/seo/siteConfig";

type SchemaReference = {
  "@id": string;
};

type WebSiteNode = {
  "@type": "WebSite";
  "@id": string;
  url: string;
  name: string;
  alternateName: readonly string[];
  description: string;
  inLanguage: string;
  author: SchemaReference;
  about: SchemaReference;
};

type ProfilePageNode = {
  "@type": "ProfilePage";
  "@id": string;
  url: string;
  name: string;
  description: string;
  isPartOf: SchemaReference;
  mainEntity: SchemaReference;
};

type NamedSchemaEntity = {
  "@type": "Organization" | "CollegeOrUniversity" | "Place";
  name: string;
};

type PersonNode = {
  "@type": "Person";
  "@id": string;
  name: string;
  url: string;
  image?: string;
  jobTitle: string;
  description: string;
  worksFor?: NamedSchemaEntity;
  alumniOf?: NamedSchemaEntity;
  homeLocation?: NamedSchemaEntity;
  sameAs?: string[];
};

export type HomepageStructuredData = {
  "@context": "https://schema.org";
  "@graph": readonly [WebSiteNode, ProfilePageNode, PersonNode];
};

export const HOMEPAGE_STRUCTURED_DATA_IDS = Object.freeze({
  website: `${CANONICAL_HOMEPAGE_URL}#website`,
  profilePage: `${CANONICAL_HOMEPAGE_URL}#profile-page`,
  person: `${CANONICAL_HOMEPAGE_URL}#person`
});

function clean(value: string | undefined): string | undefined {
  const cleanedValue = value?.trim();
  return cleanedValue || undefined;
}

function resolveCanonicalProfileImage(imagePath: string | undefined): string | undefined {
  if (!imagePath?.startsWith("/") || imagePath.startsWith("//")) return undefined;

  try {
    return createCanonicalUrl(imagePath);
  } catch {
    return undefined;
  }
}

function isMatchingSocialProfile(link: PortfolioLink): boolean {
  const kind = link.kind.trim().toLowerCase();

  if (kind !== "github" && kind !== "linkedin") return false;

  try {
    const url = new URL(link.url);
    if (url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    return kind === "github"
      ? hostname === "github.com" || hostname === "www.github.com"
      : hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

function selectSameAsLinks(links: PortfolioLink[]): string[] {
  return Array.from(new Set(links.filter(isMatchingSocialProfile).map((link) => link.url)));
}

export function createHomepageStructuredData(content: GeneratedPortfolioContent): HomepageStructuredData {
  const fullName = clean(content.profile.fullName) ?? PREFERRED_SITE_NAME;
  const headline = clean(content.profile.currentTitle) ?? content.profile.headline.trim();
  const biography = clean(content.profile.shortBio) ?? clean(content.profile.longBio) ?? content.siteSettings.siteDescription;
  const siteDescription = clean(content.siteSettings.siteDescription) ?? biography;
  const profileImage = resolveCanonicalProfileImage(content.profile.portraitImage);
  const currentOrganization = clean(content.profile.currentCompany);
  const university = clean(content.profile.university);
  const location = clean(content.profile.location);
  const sameAs = selectSameAsLinks(content.links);

  const websiteNode: WebSiteNode = {
    "@type": "WebSite",
    "@id": HOMEPAGE_STRUCTURED_DATA_IDS.website,
    url: CANONICAL_HOMEPAGE_URL,
    name: PREFERRED_SITE_NAME,
    alternateName: ALTERNATE_SITE_NAMES,
    description: siteDescription,
    inLanguage: SITE_LANGUAGE,
    author: { "@id": HOMEPAGE_STRUCTURED_DATA_IDS.person },
    about: { "@id": HOMEPAGE_STRUCTURED_DATA_IDS.person }
  };

  const profilePageNode: ProfilePageNode = {
    "@type": "ProfilePage",
    "@id": HOMEPAGE_STRUCTURED_DATA_IDS.profilePage,
    url: CANONICAL_HOMEPAGE_URL,
    name: `${fullName} Portfolio`,
    description: biography,
    isPartOf: { "@id": HOMEPAGE_STRUCTURED_DATA_IDS.website },
    mainEntity: { "@id": HOMEPAGE_STRUCTURED_DATA_IDS.person }
  };

  const personNode: PersonNode = {
    "@type": "Person",
    "@id": HOMEPAGE_STRUCTURED_DATA_IDS.person,
    name: fullName,
    url: CANONICAL_HOMEPAGE_URL,
    image: profileImage,
    jobTitle: headline,
    description: biography,
    worksFor: currentOrganization
      ? { "@type": "Organization", name: currentOrganization }
      : undefined,
    alumniOf: university
      ? { "@type": "CollegeOrUniversity", name: university }
      : undefined,
    homeLocation: location
      ? { "@type": "Place", name: location }
      : undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined
  };

  return {
    "@context": "https://schema.org",
    "@graph": [websiteNode, profilePageNode, personNode]
  };
}
