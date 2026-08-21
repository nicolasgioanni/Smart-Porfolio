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

export function isIsoDate(value: string): boolean {
  const trimmedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return false;
  }

  const parsedDate = new Date(`${trimmedValue}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === trimmedValue;
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

function validateProfileReference(referenceId: string | undefined, items: Array<{ id: string }>, fieldName: string, errors: string[]): void {
  if (!referenceId) return;

  if (!items.some((item) => item.id === referenceId)) {
    errors.push(`profile.${fieldName} references an unknown id: ${referenceId}`);
  }
}

function validateProfileReferences(content: GeneratedPortfolioContent, errors: string[]): void {
  validateProfileReference(content.profile.currentExperienceId, content.experience, "currentExperienceId", errors);
  validateProfileReference(content.profile.previousExperienceId, content.experience, "previousExperienceId", errors);
  validateProfileReference(content.profile.featuredResearchId, content.research, "featuredResearchId", errors);
  validateProfileReference(content.profile.primaryEducationId, content.education, "primaryEducationId", errors);
}

function validateProfileRoleConfiguration(content: GeneratedPortfolioContent, errors: string[]): void {
  const { roleAlternate, roleEngineerPrefixes, roleEngineerSuffix } = content.profile;
  const configuredValues = [roleEngineerPrefixes, roleEngineerSuffix, roleAlternate].filter(
    (value) => Boolean(value?.trim())
  );

  if (configuredValues.length === 0) return;

  if (configuredValues.length !== 3) {
    errors.push(
      "profile role rotation requires roleEngineerPrefixes, roleEngineerSuffix, and roleAlternate together"
    );
    return;
  }

  const prefixes = roleEngineerPrefixes!
    .split("|")
    .map((prefix) => prefix.trim())
    .filter(Boolean);

  if (prefixes.length === 0) {
    errors.push("profile.roleEngineerPrefixes must contain at least one pipe-delimited role prefix");
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

    if (item.organizationLogo && !isSupportedUrl(item.organizationLogo, { allowMailto: false })) {
      errors.push(`research.${item.id} has an invalid organizationLogo URL: ${item.organizationLogo}`);
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

    for (const [index, skill] of item.homeSkills.entries()) {
      const hasSummary = Boolean(skill.summary?.trim());
      const hasDetails = Boolean(skill.details?.trim());

      if (hasSummary !== hasDetails) {
        errors.push(`projects.${item.id}.homeSkills[${index}] must provide summary and details together`);
      }
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

    if (item.organizationLogo && !isSupportedUrl(item.organizationLogo, { allowMailto: false })) {
      errors.push(`experience.${item.id} has an invalid organizationLogo URL: ${item.organizationLogo}`);
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

    if (item.fullQuoteLink) {
      const { label, url } = item.fullQuoteLink;

      if (!label || item.fullQuote.indexOf(label) < 0 || item.fullQuote.indexOf(label) !== item.fullQuote.lastIndexOf(label)) {
        errors.push(`recommendations.${item.id} must include its fullQuoteLink label exactly once in fullQuote: ${label}`);
      }

      if (!isHttpsUrl(url)) {
        errors.push(`recommendations.${item.id} has an invalid fullQuoteLink URL: ${url}`);
      }
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

    if (item.institutionLogo && !isSupportedUrl(item.institutionLogo, { allowMailto: false })) {
      errors.push(`education.${item.id} has an invalid institutionLogo URL: ${item.institutionLogo}`);
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

  if (typeof content.siteSettings.repositoryUrl === "string" && content.siteSettings.repositoryUrl && !isHttpsUrl(content.siteSettings.repositoryUrl)) {
    errors.push(`siteSettings.repositoryUrl has an invalid URL: ${content.siteSettings.repositoryUrl}`);
  }

  if (
    typeof content.siteSettings.legalContactEmail === "string" &&
    content.siteSettings.legalContactEmail &&
    !isSupportedUrl(`mailto:${content.siteSettings.legalContactEmail}`, { allowRootRelative: false })
  ) {
    errors.push(`siteSettings.legalContactEmail has an invalid email address: ${content.siteSettings.legalContactEmail}`);
  }

  if (
    typeof content.siteSettings.legalEffectiveDate === "string" &&
    content.siteSettings.legalEffectiveDate &&
    !isIsoDate(content.siteSettings.legalEffectiveDate)
  ) {
    errors.push(`siteSettings.legalEffectiveDate has an invalid ISO date: ${content.siteSettings.legalEffectiveDate}`);
  }

  if (
    typeof content.siteSettings.hostingPrivacyUrl === "string" &&
    content.siteSettings.hostingPrivacyUrl &&
    !isHttpsUrl(content.siteSettings.hostingPrivacyUrl)
  ) {
    errors.push(`siteSettings.hostingPrivacyUrl has an invalid URL: ${content.siteSettings.hostingPrivacyUrl}`);
  }

  validateUniqueIds(content.links, "links", errors);
  validateUniqueIds(content.research, "research", errors);
  validateUniqueIds(content.projects, "projects", errors);
  validateUniqueIds(content.experience, "experience", errors);
  validateUniqueIds(content.recommendations, "recommendations", errors);
  validateUniqueIds(content.education, "education", errors);
  validateUniqueIds(content.skills, "skills", errors);
  validateProfileReferences(content, errors);
  validateProfileRoleConfiguration(content, errors);
  validateTopLevelLinks(content.links, errors);
  validateResearch(content.research, errors);
  validateProjects(content.projects, errors);
  validateExperience(content.experience, errors);
  validateRecommendations(content.recommendations, errors);
  validateEducation(content.education, errors);

  for (const skill of content.skills) {
    if (!skill.category) errors.push(`skills.${skill.id} is missing category`);
    if (!skill.name) errors.push(`skills.${skill.id} is missing name`);

    const popupFields = [skill.proficiency, skill.summary, skill.whereUsed];
    const popupFieldCount = popupFields.filter((value) => Boolean(value?.trim())).length;

    if (popupFieldCount > 0 && popupFieldCount < popupFields.length) {
      errors.push(`skills.${skill.id} must provide proficiency, summary, and whereUsed together`);
    }
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
