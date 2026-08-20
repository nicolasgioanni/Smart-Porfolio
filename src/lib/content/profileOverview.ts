import type {
  EducationItem,
  ExperienceItem,
  GeneratedPortfolioContent,
  PortfolioLink,
  ProfileContent,
  ProfileOverviewContent,
  ProfileOverviewEducation,
  ProfileOverviewLogo,
  ProfileOverviewResearch,
  ProfileOverviewRole,
  ProfileOverviewWork,
  ResearchItem
} from "@/content/types";
import { getLinkKind } from "@/lib/content/displayHelpers";
import { sortForHome } from "@/lib/content/sortPortfolioContent";
import { isSupportedUrl } from "@/lib/content/validatePortfolioContent";
import { formatSingleDate } from "@/lib/formatting/formatDateRange";

export type ProfileEducationDisplay = {
  id: string;
  institution?: string;
  institutionLogo?: string;
  institutionLogoAlt?: string;
  degree?: string;
  field?: string;
  concentration?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
};

export type ProfileIdentityItem = {
  id: string;
  href?: string;
  kind: string;
  label: string;
};

const contactTargets: Array<{ id: string; kinds: string[] }> = [
  { id: "github", kinds: ["github"] },
  { id: "linkedin", kinds: ["linkedin"] },
  { id: "email", kinds: ["email"] },
  { id: "resume", kinds: ["resume", "file"] },
  { id: "portfolio", kinds: ["portfolio", "website"] }
];

const identityLinkTargets: Array<{ id: string; kinds: string[] }> = [
  { id: "email", kinds: ["email"] },
  { id: "portfolio", kinds: ["portfolio", "website"] },
  { id: "linkedin", kinds: ["linkedin"] },
  { id: "github", kinds: ["github"] }
];

function clean(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function createProfileOverviewRole(profile: ProfileContent): ProfileOverviewRole {
  const engineerPrefixes = clean(profile.roleEngineerPrefixes);
  const engineerSuffix = clean(profile.roleEngineerSuffix);
  const alternate = clean(profile.roleAlternate);
  const configuredValueCount = [engineerPrefixes, engineerSuffix, alternate].filter(Boolean).length;

  if (configuredValueCount === 0) {
    return { kind: "static", label: profile.headline.trim() };
  }

  if (configuredValueCount !== 3) {
    throw new Error(
      "Profile role rotation requires roleEngineerPrefixes, roleEngineerSuffix, and roleAlternate together"
    );
  }

  const parsedPrefixes = engineerPrefixes!
    .split("|")
    .map((prefix) => prefix.trim())
    .filter(Boolean);

  if (parsedPrefixes.length === 0) {
    throw new Error("Profile role rotation requires at least one pipe-delimited engineer prefix");
  }

  return {
    kind: "rotating",
    engineerPrefixes: parsedPrefixes,
    engineerSuffix: engineerSuffix!,
    alternate: alternate!
  };
}

function getProfileGreetingName(profile: ProfileContent): string {
  return clean(profile.preferredName) ?? clean(profile.fullName)?.split(/\s+/)[0] ?? "";
}

function createSyntheticLink(id: string, label: string, url: string, kind: string): PortfolioLink {
  return {
    id,
    label,
    url,
    kind,
    isPrimary: false,
    showOnHome: true,
    showInHeader: false,
    showInFooter: false
  };
}

function getNormalizedLinkKind(link: PortfolioLink): string {
  return (link.kind || getLinkKind(link)).toLowerCase();
}

function matchesLinkTarget(link: PortfolioLink, targetKinds: string[]): boolean {
  const configuredKind = getNormalizedLinkKind(link);
  const inferredKind = getLinkKind(link).toLowerCase();

  return targetKinds.includes(configuredKind) || targetKinds.includes(inferredKind);
}

function getLinkDisplayLabel(link: PortfolioLink): string {
  const kind = getNormalizedLinkKind(link);
  const url = link.url.trim();

  if (kind === "email" || url.toLowerCase().startsWith("mailto:")) {
    return url.replace(/^mailto:/i, "");
  }

  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const lastPathPart = pathParts[pathParts.length - 1];

    if (kind === "github" && lastPathPart) return `@${lastPathPart}`;
    if (kind === "linkedin" && lastPathPart) return `in/${lastPathPart}`;

    return `${parsedUrl.origin}${parsedUrl.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function createWorkLabel(title: string | undefined, company: string | undefined): string | undefined {
  const cleanTitle = clean(title);
  const cleanCompany = clean(company);

  if (cleanTitle && cleanCompany) return `${cleanTitle} at ${cleanCompany}`;
  return cleanTitle ?? cleanCompany;
}

type ProfileOverviewSelectableItem = {
  id: string;
  featured: boolean;
  showOnHome: boolean;
  homeOrder?: number;
  startDate?: string;
  endDate?: string;
};

function isCurrentItem(item: ProfileOverviewSelectableItem): boolean {
  const endDate = clean(item.endDate)?.toLowerCase();
  return !endDate || endDate === "present" || endDate === "current";
}

function selectHomeCandidate<TItem extends ProfileOverviewSelectableItem>(items: TItem[]): TItem | undefined {
  const homeItems = items.filter((item) => item.showOnHome);
  const featuredItems = items.filter((item) => item.featured);
  const candidates = homeItems.length > 0 ? homeItems : featuredItems.length > 0 ? featuredItems : items;

  return sortForHome(candidates)[0];
}

export function getCurrentExperience(experience: ExperienceItem[] = [], preferredId?: string): ExperienceItem | undefined {
  const currentExperience = experience.filter(isCurrentItem);
  const cleanPreferredId = clean(preferredId);
  const explicitlySelectedExperience = cleanPreferredId
    ? currentExperience.find((item) => item.id === cleanPreferredId)
    : undefined;

  return explicitlySelectedExperience ?? selectHomeCandidate(currentExperience);
}

function createOverviewLogo(src: string | undefined, alt: string | undefined, fallbackName: string | undefined): ProfileOverviewLogo | undefined {
  const cleanSrc = clean(src);
  const cleanFallbackName = clean(fallbackName);

  if (!cleanSrc) return undefined;

  return {
    src: cleanSrc,
    alt: clean(alt) ?? (cleanFallbackName ? `${cleanFallbackName} logo` : "")
  };
}

export function formatProfileOverviewDateRange(startDate: string | undefined, endDate: string | undefined): string | undefined {
  const formattedStartDate = formatSingleDate(clean(startDate));
  const formattedEndDate = formatSingleDate(clean(endDate)) ?? (formattedStartDate ? "Present" : undefined);

  if (formattedStartDate && formattedEndDate) return `${formattedStartDate} \u2013 ${formattedEndDate}`;
  return formattedStartDate ?? formattedEndDate;
}

export function formatCompactGraduationDate(endDate: string | undefined): string | undefined {
  const formattedEndDate = formatSingleDate(clean(endDate));

  return formattedEndDate ? `Graduated ${formattedEndDate}` : undefined;
}

export function formatEducationProgram(degree: string | undefined, field: string | undefined): string | undefined {
  const cleanDegree = clean(degree);
  const cleanField = clean(field);

  if (cleanDegree && cleanField) return `${cleanDegree} in ${cleanField}`;
  return cleanDegree ?? cleanField;
}

type ProfileOverviewWorkOverrides = {
  title?: string;
  organization?: string;
};

function createWorkOverview(
  selectedExperience: ExperienceItem | undefined,
  overrides: ProfileOverviewWorkOverrides = {}
): ProfileOverviewWork | undefined {
  const title = clean(overrides.title) ?? clean(selectedExperience?.title);
  const organization = clean(overrides.organization) ?? clean(selectedExperience?.organization);

  if (!title && !organization) return undefined;

  return {
    id: selectedExperience?.id,
    title,
    organization,
    startDate: clean(selectedExperience?.startDate),
    endDate: clean(selectedExperience?.endDate),
    dateLabel: formatProfileOverviewDateRange(selectedExperience?.startDate, selectedExperience?.endDate),
    summary: clean(selectedExperience?.homeSummary),
    logo: createOverviewLogo(
      selectedExperience?.organizationLogo,
      selectedExperience?.organizationLogoAlt,
      selectedExperience?.organization
    )
  };
}

function createCurrentWorkOverview(profile: ProfileContent, experience: ExperienceItem[]): ProfileOverviewWork | undefined {
  const currentExperience = getCurrentExperience(experience, profile.currentExperienceId);

  if (currentExperience) return createWorkOverview(currentExperience);

  return createWorkOverview(undefined, {
    title: profile.currentTitle,
    organization: profile.currentCompany
  });
}

export function getSelectedResearch(research: ResearchItem[] = [], preferredId?: string): ResearchItem | undefined {
  const homeResearch = research.filter((item) => item.showOnHome);

  if (homeResearch.length > 0) return sortForHome(homeResearch)[0];

  const cleanPreferredId = clean(preferredId);
  const explicitlySelectedResearch = cleanPreferredId
    ? research.find((item) => item.id === cleanPreferredId)
    : undefined;

  return explicitlySelectedResearch ?? sortForHome(research)[0];
}

function createResearchOverview(profile: ProfileContent, research: ResearchItem[]): ProfileOverviewResearch | undefined {
  const selectedResearch = getSelectedResearch(research, profile.featuredResearchId);

  if (!selectedResearch) return undefined;

  const links = selectedResearch.links.filter((link) => Boolean(clean(link.label)) && isSupportedUrl(link.url));
  const publishedLabels = new Set(links.map((link) => link.label.trim().toLowerCase()));
  const pendingLinks = (selectedResearch.pendingLinks ?? [])
    .map((label) => label.trim())
    .filter(
      (label, index, labels) =>
        Boolean(label) &&
        !publishedLabels.has(label.toLowerCase()) &&
        labels.findIndex((candidate) => candidate.toLowerCase() === label.toLowerCase()) === index
    );

  return {
    id: selectedResearch.id,
    title: clean(selectedResearch.homeTitle) ?? selectedResearch.title,
    summary:
      clean(selectedResearch.profileSummary) ??
      clean(selectedResearch.homeSummary) ??
      clean(selectedResearch.detailSummary),
    links,
    pendingLinks,
    logo: createOverviewLogo(
      selectedResearch.organizationLogo,
      selectedResearch.organizationLogoAlt,
      selectedResearch.organization
    )
  };
}

function createEducationOverview(profile: ProfileContent, education: EducationItem[]): ProfileOverviewEducation | undefined {
  const selectedEducation = getPrimaryEducation(education, profile);
  const institution = clean(profile.university) ?? clean(selectedEducation?.institution);
  const degree = clean(profile.degree) ?? clean(selectedEducation?.degree);
  const field = clean(profile.fieldOfStudy) ?? clean(selectedEducation?.field);
  const endDate = clean(profile.graduation) ?? clean(selectedEducation?.endDate);

  if (!institution && !degree && !field && !endDate && !selectedEducation) return undefined;

  return {
    id: selectedEducation?.id,
    institution,
    degree,
    field,
    concentration: clean(selectedEducation?.concentration),
    location: clean(selectedEducation?.location),
    startDate: clean(selectedEducation?.startDate),
    endDate,
    graduationLabel: formatCompactGraduationDate(endDate),
    logo: createOverviewLogo(selectedEducation?.institutionLogo, selectedEducation?.institutionLogoAlt, selectedEducation?.institution)
  };
}

export function createProfileOverviewContent(
  content: Pick<GeneratedPortfolioContent, "profile" | "experience" | "research" | "education">
): ProfileOverviewContent {
  return {
    greetingName: getProfileGreetingName(content.profile),
    role: createProfileOverviewRole(content.profile),
    about: createShortAboutText(content.profile),
    currentWork: createCurrentWorkOverview(content.profile, content.experience),
    education: createEducationOverview(content.profile, content.education),
    research: createResearchOverview(content.profile, content.research)
  };
}

export function getCurrentWorkLabel(profile: ProfileContent, experience: ExperienceItem[] = []): string | undefined {
  const currentExperience = getCurrentExperience(experience, profile.currentExperienceId);

  return currentExperience
    ? createWorkLabel(currentExperience.title, currentExperience.organization)
    : createWorkLabel(profile.currentTitle, profile.currentCompany);
}

export function getPrimaryEducation(education: EducationItem[] = [], profile?: ProfileContent): ProfileEducationDisplay | undefined {
  const preferredEducationId = clean(profile?.primaryEducationId);
  const explicitlySelectedEducation = preferredEducationId
    ? education.find((item) => item.id === preferredEducationId)
    : undefined;
  const primaryEducation = explicitlySelectedEducation ?? selectHomeCandidate(education);

  if (primaryEducation) {
    return {
      id: primaryEducation.id,
      institution: primaryEducation.institution,
      institutionLogo: primaryEducation.institutionLogo,
      institutionLogoAlt: primaryEducation.institutionLogoAlt,
      degree: primaryEducation.degree,
      field: primaryEducation.field,
      concentration: primaryEducation.concentration,
      location: primaryEducation.location,
      startDate: primaryEducation.startDate,
      endDate: primaryEducation.endDate
    };
  }

  if (!profile) return undefined;

  const institution = clean(profile.university);
  const degree = clean(profile.degree);
  const field = clean(profile.fieldOfStudy);
  const endDate = clean(profile.graduation);

  if (!institution && !degree && !field && !endDate) return undefined;

  return {
    id: "profile-education",
    institution,
    degree,
    field,
    endDate
  };
}

export function getEducationDisplayLabel(education: ProfileEducationDisplay): string | undefined {
  const degreeLabel = formatEducationProgram(education.degree, education.field);
  const dateLabel = formatSingleDate(clean(education.endDate));
  const displayParts = [degreeLabel, clean(education.location), dateLabel].filter(Boolean);

  return displayParts.length > 0 ? displayParts.join(" / ") : undefined;
}

export function getEducationLogo(education: ProfileEducationDisplay | undefined): { alt: string; src: string } | undefined {
  const src = clean(education?.institutionLogo);

  if (!src) return undefined;

  return {
    src,
    alt: clean(education?.institutionLogoAlt) ?? (education?.institution ? `${education.institution} logo` : "")
  };
}

export function getProfileContactLinks(links: PortfolioLink[], profile: ProfileContent): PortfolioLink[] {
  const selectedLinks: PortfolioLink[] = [];
  const usedUrls = new Set<string>();

  for (const target of contactTargets) {
    const matchingLink = links.find((link) => matchesLinkTarget(link, target.kinds) && !usedUrls.has(link.url));

    if (matchingLink) {
      selectedLinks.push(matchingLink);
      usedUrls.add(matchingLink.url);
    } else if (target.id === "email") {
      const email = clean(profile.email);
      if (!email) continue;

      const emailUrl = email.toLowerCase().startsWith("mailto:") ? email : `mailto:${email}`;
      const emailLink = createSyntheticLink("profile-email", "Email", emailUrl, "email");
      selectedLinks.push(emailLink);
      usedUrls.add(emailLink.url);
    } else if (target.id === "resume") {
      const resumeUrl = clean(profile.resumeUrl);
      if (!resumeUrl) continue;

      const resumeLink = createSyntheticLink("profile-resume", profile.resumeDownloadLabel ?? "Resume", resumeUrl, "resume");
      selectedLinks.push(resumeLink);
      usedUrls.add(resumeLink.url);
    }
  }

  return selectedLinks;
}

export function getProfileIdentityItems(profile: ProfileContent, links: PortfolioLink[]): ProfileIdentityItem[] {
  const identityItems: ProfileIdentityItem[] = [];
  const usedUrls = new Set<string>();
  const location = clean(profile.location);
  const timezone = clean(profile.timezone);

  if (location) {
    identityItems.push({ id: "location", kind: "location", label: location });
  }

  if (timezone) {
    identityItems.push({ id: "timezone", kind: "timezone", label: timezone });
  }

  for (const target of identityLinkTargets) {
    const matchingLink = links.find((link) => matchesLinkTarget(link, target.kinds) && !usedUrls.has(link.url));

    if (matchingLink) {
      identityItems.push({
        id: matchingLink.id,
        href: matchingLink.url,
        kind: getNormalizedLinkKind(matchingLink),
        label: getLinkDisplayLabel(matchingLink)
      });
      usedUrls.add(matchingLink.url);
    } else if (target.id === "email") {
      const email = clean(profile.email);
      if (!email) continue;

      const href = email.toLowerCase().startsWith("mailto:") ? email : `mailto:${email}`;
      identityItems.push({ id: "profile-email", href, kind: "email", label: href.replace(/^mailto:/i, "") });
      usedUrls.add(href);
    }
  }

  return identityItems;
}

export function createShortAboutText(profile: ProfileContent, maxLength = 240): string | undefined {
  const shortBio = clean(profile.shortBio);

  if (shortBio) return shortBio;

  const longBio = clean(profile.longBio);

  if (!longBio) return undefined;
  if (longBio.length <= maxLength) return longBio;

  const truncatedBio = longBio.slice(0, maxLength).trimEnd();
  const lastSpaceIndex = truncatedBio.lastIndexOf(" ");
  const wordSafeBio = lastSpaceIndex > 80 ? truncatedBio.slice(0, lastSpaceIndex) : truncatedBio;

  return `${wordSafeBio.replace(/[.,;:!?]$/, "")}...`;
}
