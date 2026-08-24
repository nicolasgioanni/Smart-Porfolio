import type {
  EducationItem,
  ExperienceItem,
  GeneratedContentMetadata,
  GeneratedPortfolioContent,
  PortfolioContentLink,
  PortfolioLink,
  ProfileContent,
  ProjectItem,
  ProjectSkill,
  RecommendationItem,
  ResearchItem,
  ResumeEntry,
  SiteSettings,
  SkillItem
} from "@/content/types";
import type { CsvRow } from "@/lib/csv/parseCsv";
import { isHttpsUrl, isSupportedUrl, validatePortfolioContent } from "@/lib/content/validatePortfolioContent";

export type PortfolioSheetName =
  | "profile"
  | "links"
  | "research"
  | "projects"
  | "experience"
  | "recommendations"
  | "education"
  | "skills"
  | "resume"
  | "site_settings";

export type RawPortfolioSheets = Record<PortfolioSheetName, CsvRow[]>;

const profileKeyMap: Record<string, keyof ProfileContent> = {
  full_name: "fullName",
  preferred_name: "preferredName",
  headline: "headline",
  role_engineer_prefixes: "roleEngineerPrefixes",
  role_engineer_suffix: "roleEngineerSuffix",
  role_alternate: "roleAlternate",
  current_title: "currentTitle",
  current_company: "currentCompany",
  current_experience_id: "currentExperienceId",
  previous_experience_id: "previousExperienceId",
  featured_research_id: "featuredResearchId",
  primary_education_id: "primaryEducationId",
  location: "location",
  timezone: "timezone",
  time_zone: "timezone",
  email: "email",
  pronouns: "pronouns",
  university: "university",
  degree: "degree",
  field_of_study: "fieldOfStudy",
  graduation: "graduation",
  short_bio: "shortBio",
  long_bio: "longBio",
  portrait_image: "portraitImage",
  favicon_image: "faviconImage",
  resume_url: "resumeUrl",
  resume_download_label: "resumeDownloadLabel",
  primary_cta_label: "primaryCtaLabel",
  secondary_cta_label: "secondaryCtaLabel"
};

const settingKeyMap: Record<string, keyof SiteSettings> = {
  site_title: "siteTitle",
  site_description: "siteDescription",
  default_theme: "defaultTheme",
  enable_skeletons: "enableSkeletons",
  enable_scroll_motion: "enableScrollMotion",
  enable_glass_effects: "enableGlassEffects",
  enable_recommendations: "enableRecommendations",
  show_empty_recommendations: "showEmptyRecommendations",
  max_home_research_items: "maxHomeResearchItems",
  max_home_project_items: "maxHomeProjectItems",
  max_home_experience_items: "maxHomeExperienceItems",
  max_home_recommendation_items: "maxHomeRecommendationItems",
  max_home_skill_items: "maxHomeSkillItems",
  recommendations_nav_label: "recommendationsNavLabel",
  license_name: "licenseName",
  license_url: "licenseUrl",
  copyright_owner: "copyrightOwner",
  repository_url: "repositoryUrl",
  legal_contact_email: "legalContactEmail",
  legal_effective_date: "legalEffectiveDate",
  hosting_provider_name: "hostingProviderName",
  hosting_privacy_url: "hostingPrivacyUrl"
};

const booleanSettingKeys = new Set<keyof SiteSettings>([
  "enableSkeletons",
  "enableScrollMotion",
  "enableGlassEffects",
  "enableRecommendations",
  "showEmptyRecommendations"
]);

const numberSettingKeys = new Set<keyof SiteSettings>([
  "maxHomeResearchItems",
  "maxHomeProjectItems",
  "maxHomeExperienceItems",
  "maxHomeRecommendationItems",
  "maxHomeSkillItems"
]);

export function normalizeBoolean(value: string | undefined, fieldName = "boolean", defaultValue = false): boolean {
  const normalizedValue = (value ?? "").trim().toLowerCase();

  if (!normalizedValue) return defaultValue;
  if (["true", "yes", "1"].includes(normalizedValue)) return true;
  if (["false", "no", "0"].includes(normalizedValue)) return false;

  throw new Error(`Invalid boolean for ${fieldName}: ${value}`);
}

export function normalizeNumber(value: string | undefined, fieldName = "number"): number | undefined {
  const normalizedValue = (value ?? "").trim();

  if (!normalizedValue) return undefined;

  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Invalid number for ${fieldName}: ${value}`);
  }

  return parsedValue;
}

export function normalizePipeDelimitedList(value: string | undefined): string[] {
  return (value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

const iconKeyPattern = /^[a-z0-9][a-z0-9-]*$/;

function normalizeIconKey(value: string | undefined, fieldName: string): string | undefined {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) return undefined;

  if (!iconKeyPattern.test(normalizedValue)) {
    throw new Error(`${fieldName} must be a lowercase icon key containing only letters, numbers, and hyphens`);
  }

  return normalizedValue;
}

function normalizeProjectSkills(value: string | undefined, row: CsvRow, fieldName: string): ProjectSkill[] {
  const entries = normalizePipeDelimitedList(value);

  if (entries.length > 3) {
    throw new Error(`${fieldName} must contain at most 3 skills`);
  }

  for (let index = entries.length; index < 3; index += 1) {
    const fieldPosition = index + 1;
    const hasSummary = Boolean(text(row, `home_skill_${fieldPosition}_summary`));
    const hasDetails = Boolean(text(row, `home_skill_${fieldPosition}_details`));

    if (hasSummary || hasDetails) {
      throw new Error(`${fieldName} has popup copy for missing skill position ${fieldPosition}`);
    }
  }

  return entries.map((entry, index) => {
    const separatorIndex = entry.indexOf("=");
    const name = (separatorIndex >= 0 ? entry.slice(0, separatorIndex) : entry).trim();
    const icon = separatorIndex >= 0 ? entry.slice(separatorIndex + 1).trim() : undefined;
    const fieldPosition = index + 1;
    const summary = text(row, `home_skill_${fieldPosition}_summary`);
    const details = text(row, `home_skill_${fieldPosition}_details`);

    if (!name) {
      throw new Error(`${fieldName}[${index}] is missing a skill name`);
    }

    return {
      name,
      icon: normalizeIconKey(icon, `${fieldName}[${index}].icon`),
      ...(summary ? { summary } : {}),
      ...(details ? { details } : {})
    };
  });
}

function inferLinkLabel(url: string): string {
  if (url.startsWith("mailto:")) return "Email";
  if (url.startsWith("/")) {
    const pathParts = url.split("/").filter(Boolean);
    return pathParts[pathParts.length - 1] ?? "Link";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

export function normalizeLinkList(value: string | undefined, fieldName = "links"): PortfolioContentLink[] {
  return normalizePipeDelimitedList(value).map((item) => {
    const separatorIndex = item.indexOf("=");
    const label = separatorIndex > 0 ? item.slice(0, separatorIndex).trim() : inferLinkLabel(item);
    const url = separatorIndex > 0 ? item.slice(separatorIndex + 1).trim() : item.trim();

    if (!label) {
      throw new Error(`Invalid link label for ${fieldName}: ${item}`);
    }

    if (!isSupportedUrl(url)) {
      throw new Error(`Invalid link URL for ${fieldName}: ${url}`);
    }

    return { label, url };
  });
}

function text(row: CsvRow, fieldName: string): string | undefined {
  const value = row[fieldName]?.trim();
  return value ? value : undefined;
}

function requiredText(row: CsvRow, fieldName: string, location: string): string {
  const value = text(row, fieldName);

  if (!value) {
    throw new Error(`${location} is missing required field: ${fieldName}`);
  }

  return value;
}

function validateUniqueRowId(id: string, collectionName: string, seenIds: Set<string>): void {
  if (seenIds.has(id)) {
    throw new Error(`${collectionName} contains duplicate id: ${id}`);
  }

  seenIds.add(id);
}

function normalizeProfile(rows: CsvRow[]): ProfileContent {
  const profile = {} as ProfileContent;

  for (const row of rows) {
    const key = requiredText(row, "key", "profile");
    const value = text(row, "value");

    if (!value) continue;

    const mappedKey = profileKeyMap[key] ?? key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    profile[mappedKey] = value;
  }

  return profile;
}

function normalizeLinks(rows: CsvRow[]): PortfolioLink[] {
  const seenIds = new Set<string>();

  return rows.map((row, index) => {
    const location = `links row ${index + 2}`;
    const id = requiredText(row, "id", location);
    const url = requiredText(row, "url", location);

    validateUniqueRowId(id, "links", seenIds);

    if (!isSupportedUrl(url)) {
      throw new Error(`${location} has invalid url: ${url}`);
    }

    return {
      id,
      label: requiredText(row, "label", location),
      url,
      icon: text(row, "icon"),
      kind: text(row, "kind") ?? "external",
      isPrimary: normalizeBoolean(row.is_primary, `${location}.is_primary`),
      showOnHome: normalizeBoolean(row.show_on_home, `${location}.show_on_home`),
      showInHeader: normalizeBoolean(row.show_in_header, `${location}.show_in_header`),
      showInFooter: normalizeBoolean(row.show_in_footer, `${location}.show_in_footer`),
      order: normalizeNumber(row.order, `${location}.order`)
    };
  });
}

function normalizeResearch(rows: CsvRow[]): ResearchItem[] {
  const seenIds = new Set<string>();

  return rows.map((row, index) => {
    const location = `research row ${index + 2}`;
    const id = requiredText(row, "id", location);
    const legacyProfileByline = normalizePipeDelimitedList(row.profile_contributions).join(" & ") || undefined;

    validateUniqueRowId(id, "research", seenIds);

    return {
      id,
      title: requiredText(row, "title", location),
      homeTitle: text(row, "home_title"),
      role: text(row, "role"),
      organization: text(row, "organization"),
      organizationLogo: text(row, "organization_logo"),
      organizationLogoAlt: text(row, "organization_logo_alt"),
      location: text(row, "location"),
      startDate: text(row, "start_date"),
      endDate: text(row, "end_date"),
      homeSummary: text(row, "home_summary"),
      profileSummary: text(row, "profile_summary"),
      profileByline: text(row, "profile_byline") ?? legacyProfileByline,
      profileLabs: normalizePipeDelimitedList(row.profile_labs),
      detailSummary: text(row, "detail_summary"),
      impact: text(row, "impact"),
      bullets: normalizePipeDelimitedList(row.bullets),
      skills: normalizePipeDelimitedList(row.skills),
      links: normalizeLinkList(row.links, `${location}.links`),
      pendingLinks: normalizePipeDelimitedList(row.pending_links),
      image: text(row, "image"),
      featured: normalizeBoolean(row.featured, `${location}.featured`),
      showOnHome: normalizeBoolean(row.show_on_home, `${location}.show_on_home`),
      homeOrder: normalizeNumber(row.home_order, `${location}.home_order`),
      detailOrder: normalizeNumber(row.detail_order, `${location}.detail_order`)
    };
  });
}

function normalizeProjects(rows: CsvRow[]): ProjectItem[] {
  const seenIds = new Set<string>();

  return rows.map((row, index) => {
    const location = `projects row ${index + 2}`;
    const id = requiredText(row, "id", location);

    validateUniqueRowId(id, "projects", seenIds);

    return {
      id,
      title: requiredText(row, "title", location),
      subtitle: text(row, "subtitle"),
      homeSummary: text(row, "home_summary"),
      homeSkills: normalizeProjectSkills(row.home_skills, row, `${location}.home_skills`),
      detailSummary: text(row, "detail_summary"),
      problem: text(row, "problem"),
      solution: text(row, "solution"),
      impact: text(row, "impact"),
      stack: normalizePipeDelimitedList(row.stack),
      links: normalizeLinkList(row.links, `${location}.links`),
      image: text(row, "image"),
      featured: normalizeBoolean(row.featured, `${location}.featured`),
      showOnHome: normalizeBoolean(row.show_on_home, `${location}.show_on_home`),
      homeOrder: normalizeNumber(row.home_order, `${location}.home_order`),
      detailOrder: normalizeNumber(row.detail_order, `${location}.detail_order`)
    };
  });
}
function normalizeExperience(rows: CsvRow[]): ExperienceItem[] {
  const seenIds = new Set<string>();

  return rows.map((row, index) => {
    const location = `experience row ${index + 2}`;
    const id = requiredText(row, "id", location);

    validateUniqueRowId(id, "experience", seenIds);

    return {
      id,
      title: requiredText(row, "title", location),
      organization: requiredText(row, "organization", location),
      organizationLogo: text(row, "organization_logo"),
      organizationLogoAlt: text(row, "organization_logo_alt"),
      type: text(row, "type"),
      location: text(row, "location"),
      startDate: text(row, "start_date"),
      endDate: text(row, "end_date"),
      homeSummary: text(row, "home_summary"),
      detailSummary: text(row, "detail_summary"),
      bullets: normalizePipeDelimitedList(row.bullets),
      skills: normalizePipeDelimitedList(row.skills),
      featured: normalizeBoolean(row.featured, `${location}.featured`),
      showOnHome: normalizeBoolean(row.show_on_home, `${location}.show_on_home`),
      homeOrder: normalizeNumber(row.home_order, `${location}.home_order`),
      detailOrder: normalizeNumber(row.detail_order, `${location}.detail_order`)
    };
  });
}

function normalizeRecommendationHttpsUrl(value: string | undefined, fieldName: string): string | undefined {
  const normalizedValue = value?.trim();

  if (!normalizedValue) return undefined;

  if (!isHttpsUrl(normalizedValue)) {
    throw new Error(`${fieldName} must be a safe https URL: ${value}`);
  }

  return normalizedValue;
}

function normalizeRecommendationFullQuoteLink(
  labelValue: string | undefined,
  urlValue: string | undefined,
  fullQuote: string,
  location: string
): PortfolioContentLink | undefined {
  const label = labelValue?.trim();
  const url = urlValue?.trim();

  if (!label && !url) return undefined;

  if (!label || !url) {
    throw new Error(`${location}.full_quote_link_label and ${location}.full_quote_link_url must both be provided`);
  }

  if (!isHttpsUrl(url)) {
    throw new Error(`${location}.full_quote_link_url must be a safe https URL: ${urlValue}`);
  }

  if (fullQuote.indexOf(label) < 0 || fullQuote.indexOf(label) !== fullQuote.lastIndexOf(label)) {
    throw new Error(`${location}.full_quote_link_label must appear exactly once in full_quote: ${label}`);
  }

  return { label, url };
}

function normalizeRecommendations(rows: CsvRow[]): RecommendationItem[] {
  const seenIds = new Set<string>();

  return rows.map((row, index) => {
    const location = `recommendations row ${index + 2}`;
    const id = requiredText(row, "id", location);
    const fullQuote = requiredText(row, "full_quote", location);

    validateUniqueRowId(id, "recommendations", seenIds);

    return {
      id,
      recommenderName: requiredText(row, "recommender_name", location),
      recommenderTitle: text(row, "recommender_title"),
      recommenderOrganization: text(row, "recommender_organization"),
      relationship: text(row, "relationship"),
      recommendationDate: text(row, "recommendation_date"),
      source: text(row, "source"),
      sourceUrl: normalizeRecommendationHttpsUrl(row.source_url, `${location}.source_url`),
      linkedinUrl: normalizeRecommendationHttpsUrl(row.linkedin_url, `${location}.linkedin_url`),
      homeQuote: text(row, "home_quote"),
      fullQuote,
      fullQuoteLink: normalizeRecommendationFullQuoteLink(
        row.full_quote_link_label,
        row.full_quote_link_url,
        fullQuote,
        location
      ),
      context: text(row, "context"),
      skills: normalizePipeDelimitedList(row.skills),
      featured: normalizeBoolean(row.featured, `${location}.featured`),
      showOnHome: normalizeBoolean(row.show_on_home, `${location}.show_on_home`),
      homeOrder: normalizeNumber(row.home_order, `${location}.home_order`),
      detailOrder: normalizeNumber(row.detail_order, `${location}.detail_order`)
    };
  });
}

function normalizeEducation(rows: CsvRow[]): EducationItem[] {
  const seenIds = new Set<string>();

  return rows.map((row, index) => {
    const location = `education row ${index + 2}`;
    const id = requiredText(row, "id", location);

    validateUniqueRowId(id, "education", seenIds);

    return {
      id,
      institution: requiredText(row, "institution", location),
      institutionLogo: text(row, "institution_logo"),
      institutionLogoAlt: text(row, "institution_logo_alt"),
      degree: requiredText(row, "degree", location),
      field: text(row, "field"),
      concentration: text(row, "concentration"),
      location: text(row, "location"),
      startDate: text(row, "start_date"),
      endDate: text(row, "end_date"),
      homeSummary: text(row, "home_summary"),
      detailSummary: text(row, "detail_summary"),
      bullets: normalizePipeDelimitedList(row.bullets),
      featured: normalizeBoolean(row.featured, `${location}.featured`),
      showOnHome: normalizeBoolean(row.show_on_home, `${location}.show_on_home`),
      homeOrder: normalizeNumber(row.home_order, `${location}.home_order`),
      detailOrder: normalizeNumber(row.detail_order, `${location}.detail_order`)
    };
  });
}

function normalizeSkills(rows: CsvRow[]): SkillItem[] {
  const seenIds = new Set<string>();

  return rows.map((row, index) => {
    const location = `skills row ${index + 2}`;
    const id = requiredText(row, "id", location);

    validateUniqueRowId(id, "skills", seenIds);

    return {
      id,
      category: requiredText(row, "category", location),
      categoryOrder: normalizeNumber(row.category_order, `${location}.category_order`),
      name: requiredText(row, "name", location),
      icon: normalizeIconKey(row.icon, `${location}.icon`),
      proficiency: text(row, "proficiency"),
      summary: text(row, "summary"),
      whereUsed: text(row, "where_used"),
      priority: normalizeNumber(row.priority, `${location}.priority`),
      featured: normalizeBoolean(row.featured, `${location}.featured`),
      showOnHome: normalizeBoolean(row.show_on_home, `${location}.show_on_home`),
      order: normalizeNumber(row.order, `${location}.order`)
    };
  });
}

function normalizeResume(rows: CsvRow[]): ResumeEntry[] {
  return rows.map((row, index) => {
    const location = `resume row ${index + 2}`;

    return {
      section: requiredText(row, "section", location),
      key: requiredText(row, "key", location),
      value: requiredText(row, "value", location),
      order: normalizeNumber(row.order, `${location}.order`)
    };
  });
}

function normalizeSiteSettings(rows: CsvRow[]): SiteSettings {
  const settings: SiteSettings = {
    siteTitle: "Portfolio",
    siteDescription: "A professional portfolio with experience, projects, research, and technical skills.",
    defaultTheme: "navy",
    enableSkeletons: true,
    enableScrollMotion: false,
    enableGlassEffects: true,
    enableRecommendations: true,
    showEmptyRecommendations: false,
    maxHomeResearchItems: 2,
    maxHomeProjectItems: 3,
    maxHomeExperienceItems: 3,
    maxHomeRecommendationItems: 3,
    recommendationsNavLabel: "Recommendations",
    maxHomeSkillItems: 12
  };

  for (const row of rows) {
    const key = requiredText(row, "key", "site_settings");
    const rawValue = text(row, "value");

    if (!rawValue) continue;

    const mappedKey = settingKeyMap[key] ?? key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

    if (booleanSettingKeys.has(mappedKey)) {
      settings[mappedKey] = normalizeBoolean(rawValue, `site_settings.${key}`);
    } else if (numberSettingKeys.has(mappedKey)) {
      settings[mappedKey] = normalizeNumber(rawValue, `site_settings.${key}`) ?? 0;
    } else {
      settings[mappedKey] = rawValue;
    }
  }

  return settings;
}

export function normalizePortfolioContent(
  sheets: RawPortfolioSheets,
  metadata: GeneratedContentMetadata
): GeneratedPortfolioContent {
  const content: GeneratedPortfolioContent = {
    metadata,
    profile: normalizeProfile(sheets.profile),
    links: normalizeLinks(sheets.links),
    research: normalizeResearch(sheets.research),
    projects: normalizeProjects(sheets.projects),
    experience: normalizeExperience(sheets.experience),
    recommendations: normalizeRecommendations(sheets.recommendations),
    education: normalizeEducation(sheets.education),
    skills: normalizeSkills(sheets.skills),
    resume: normalizeResume(sheets.resume),
    siteSettings: normalizeSiteSettings(sheets.site_settings)
  };

  return validatePortfolioContent(content);
}

export { isSupportedUrl };
