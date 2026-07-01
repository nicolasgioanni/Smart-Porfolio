import type {
  EducationItem,
  ExperienceItem,
  GeneratedPortfolioContent,
  PortfolioContentLink,
  PortfolioLink,
  ProjectItem,
  RecommendationItem,
  ResearchItem
} from "@/content/types";

function isSafeRootRelativePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\0")) {
    return false;
  }

  try {
    const decodedPath = decodeURIComponent(value.split(/[?#]/)[0] ?? value);
    return !decodedPath.split("/").some((segment) => segment === "..");
  } catch {
    return false;
  }
}

export function isSupportedUrl(value: string, options: { allowMailto?: boolean; allowRootRelative?: boolean } = {}): boolean {
  const allowMailto = options.allowMailto ?? true;
  const allowRootRelative = options.allowRootRelative ?? true;
  const trimmedValue = value.trim();

  if (!trimmedValue || /\s/.test(trimmedValue)) {
    return false;
  }

  if (allowRootRelative && trimmedValue.startsWith("/") && !trimmedValue.startsWith("//")) {
    return isSafeRootRelativePath(trimmedValue);
  }

  if (allowMailto && trimmedValue.toLowerCase().startsWith("mailto:")) {
    const emailValue = trimmedValue.slice("mailto:".length);
    return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(emailValue);
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function isHttpsUrl(value: string): boolean {
  const trimmedValue = value.trim();

  if (!trimmedValue || /\s/.test(trimmedValue)) {
    return false;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    return parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function collectContentLinks(links: PortfolioContentLink[], location: string, errors: string[]): void {
  for (const link of links) {
    if (!link.label) {
      errors.push(`${location} has a link without a label`);
    }

    if (!isSupportedUrl(link.url)) {
      errors.push(`${location} has an invalid URL: ${link.url}`);
    }
  }
}

function validateUniqueIds(items: Array<{ id: string }>, collectionName: string, errors: string[]): void {
  const seenIds = new Set<string>();

  for (const item of items) {
    if (!item.id) {
      errors.push(`${collectionName} contains an item without an id`);
      continue;
    }

    if (seenIds.has(item.id)) {
      errors.push(`${collectionName} contains duplicate id: ${item.id}`);
    }

    seenIds.add(item.id);
  }
}

function validateTopLevelLinks(links: PortfolioLink[], errors: string[]): void {
  for (const link of links) {
    if (!link.label) {
      errors.push(`links.${link.id} is missing label`);
    }

    if (!isSupportedUrl(link.url)) {
      errors.push(`links.${link.id} has an invalid URL: ${link.url}`);
    }
  }
}

function validateResearch(items: ResearchItem[], errors: string[]): void {
  for (const item of items) {
    if (!item.title) {
      errors.push(`research.${item.id} is missing title`);
    }

    if (item.image && !isSupportedUrl(item.image)) {
      errors.push(`research.${item.id} has an invalid image URL: ${item.image}`);
    }

    collectContentLinks(item.links, `research.${item.id}`, errors);
  }
}

function validateProjects(items: ProjectItem[], errors: string[]): void {
  for (const item of items) {
    if (!item.title) {
      errors.push(`projects.${item.id} is missing title`);
    }

    if (item.image && !isSupportedUrl(item.image)) {
      errors.push(`projects.${item.id} has an invalid image URL: ${item.image}`);
    }

    collectContentLinks(item.links, `projects.${item.id}`, errors);
  }
}

function validateExperience(items: ExperienceItem[], errors: string[]): void {
  for (const item of items) {
    if (!item.title) {
      errors.push(`experience.${item.id} is missing title`);
    }

    if (!item.organization) {
      errors.push(`experience.${item.id} is missing organization`);
    }
  }
}

function validateRecommendations(items: RecommendationItem[], errors: string[]): void {
  for (const item of items) {
    if (!item.recommenderName) {
      errors.push(`recommendations.${item.id} is missing recommenderName`);
    }

    if (!item.fullQuote) {
      errors.push(`recommendations.${item.id} is missing fullQuote`);
    }

    if (item.sourceUrl && !isHttpsUrl(item.sourceUrl)) {
      errors.push(`recommendations.${item.id} has an invalid sourceUrl: ${item.sourceUrl}`);
    }

    if (item.linkedinUrl && !isHttpsUrl(item.linkedinUrl)) {
      errors.push(`recommendations.${item.id} has an invalid linkedinUrl: ${item.linkedinUrl}`);
    }
  }
}

function validateEducation(items: EducationItem[], errors: string[]): void {
  for (const item of items) {
    if (!item.institution) {
      errors.push(`education.${item.id} is missing institution`);
    }

    if (!item.degree) {
      errors.push(`education.${item.id} is missing degree`);
    }
  }
}

export function validatePortfolioContent(content: GeneratedPortfolioContent): GeneratedPortfolioContent {
  const errors: string[] = [];

  if (!content.profile.fullName) errors.push("profile.fullName is required");
  if (!content.profile.headline) errors.push("profile.headline is required");
  if (!content.profile.location) errors.push("profile.location is required");
  if (!content.profile.email) errors.push("profile.email is required");
  if (!content.profile.shortBio) errors.push("profile.shortBio is required");

  if (content.profile.resumeUrl && !isSupportedUrl(content.profile.resumeUrl)) {
    errors.push(`profile.resumeUrl has an invalid URL: ${content.profile.resumeUrl}`);
  }

  if (content.profile.portraitImage && !isSupportedUrl(content.profile.portraitImage)) {
    errors.push(`profile.portraitImage has an invalid URL: ${content.profile.portraitImage}`);
  }

  if (content.profile.faviconImage && !isSupportedUrl(content.profile.faviconImage)) {
    errors.push(`profile.faviconImage has an invalid URL: ${content.profile.faviconImage}`);
  }

  if (typeof content.siteSettings.licenseUrl === "string" && content.siteSettings.licenseUrl && !isHttpsUrl(content.siteSettings.licenseUrl)) {
    errors.push(`siteSettings.licenseUrl has an invalid URL: ${content.siteSettings.licenseUrl}`);
  }

  if (typeof content.siteSettings.repositoryUrl === "string" && content.siteSettings.repositoryUrl && !isSupportedUrl(content.siteSettings.repositoryUrl)) {
    errors.push(`siteSettings.repositoryUrl has an invalid URL: ${content.siteSettings.repositoryUrl}`);
  }

  validateUniqueIds(content.links, "links", errors);
  validateUniqueIds(content.research, "research", errors);
  validateUniqueIds(content.projects, "projects", errors);
  validateUniqueIds(content.experience, "experience", errors);
  validateUniqueIds(content.recommendations, "recommendations", errors);
  validateUniqueIds(content.education, "education", errors);
  validateUniqueIds(content.skills, "skills", errors);
  validateTopLevelLinks(content.links, errors);
  validateResearch(content.research, errors);
  validateProjects(content.projects, errors);
  validateExperience(content.experience, errors);
  validateRecommendations(content.recommendations, errors);
  validateEducation(content.education, errors);

  for (const skill of content.skills) {
    if (!skill.category) errors.push(`skills.${skill.id} is missing category`);
    if (!skill.name) errors.push(`skills.${skill.id} is missing name`);
  }

  for (const entry of content.resume) {
    if (!entry.section) errors.push("resume contains an entry without section");
    if (!entry.key) errors.push("resume contains an entry without key");
    if (!entry.value) errors.push(`resume.${entry.section}.${entry.key} is missing value`);
  }

  if (errors.length > 0) {
    throw new Error(`Portfolio content validation failed:\n- ${errors.join("\n- ")}`);
  }

  return content;
}
