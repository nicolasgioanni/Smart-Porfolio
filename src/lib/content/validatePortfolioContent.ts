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

type UnknownRecord = Record<string, unknown>;

const hasOwn = (value: UnknownRecord, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addShapeError(errors: string[], path: string, expectation: string): void {
  errors.push(`${path} must be ${expectation}`);
}

function validateObjectShape(
  value: unknown,
  path: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  errors: string[]
): value is UnknownRecord {
  if (!isRecord(value)) {
    addShapeError(errors, path, "an object");
    return false;
  }

  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of requiredKeys) {
    if (!hasOwn(value, key)) {
      if (path === "profile") errors.push(`${path}.${key} is required`);
      else addShapeError(errors, `${path}.${key}`, "present");
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) addShapeError(errors, `${path}.${key}`, "a supported field");
  }

  return true;
}

function validateString(value: unknown, path: string, errors: string[], optional = false): void {
  if (optional && value === undefined) return;
  if (typeof value !== "string") addShapeError(errors, path, "a string");
}

function validateBoolean(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "boolean") addShapeError(errors, path, "a boolean");
}

function validateNumber(value: unknown, path: string, errors: string[], optional = false): void {
  if (optional && value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value)) addShapeError(errors, path, "a finite number");
}

function validateStringArray(value: unknown, path: string, errors: string[], optional = false): void {
  if (optional && value === undefined) return;
  if (!Array.isArray(value)) {
    addShapeError(errors, path, "an array of strings");
    return;
  }
  value.forEach((entry, index) => validateString(entry, `${path}[${index}]`, errors));
}

function validateLink(value: unknown, path: string, errors: string[]): void {
  if (!validateObjectShape(value, path, ["label", "url"], [], errors)) return;
  validateString(value.label, `${path}.label`, errors);
  validateString(value.url, `${path}.url`, errors);
}

function validateLinkArray(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    addShapeError(errors, path, "an array of links");
    return;
  }
  value.forEach((entry, index) => validateLink(entry, `${path}[${index}]`, errors));
}

type FieldType = "string" | "boolean" | "number" | "strings" | "links" | "link" | "projectSkills";
type FieldSchema = Record<string, `${FieldType}${"?" | ""}`>;

function validateProjectSkills(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    addShapeError(errors, path, "an array of project skills");
    return;
  }
  value.forEach((skill, index) =>
    validateTypedObject(skill, `${path}[${index}]`, errors, {
      name: "string",
      icon: "string?",
      summary: "string?",
      details: "string?"
    })
  );
}

function validateTypedObject(value: unknown, path: string, errors: string[], fields: FieldSchema): void {
  const requiredKeys = Object.entries(fields).filter(([, field]) => !field.endsWith("?")).map(([key]) => key);
  const optionalKeys = Object.entries(fields).filter(([, field]) => field.endsWith("?")).map(([key]) => key);
  if (!validateObjectShape(value, path, requiredKeys, optionalKeys, errors)) return;

  for (const [key, field] of Object.entries(fields)) {
    const optional = field.endsWith("?");
    const fieldType = field.replace("?", "") as FieldType;
    const fieldValue = value[key];
    const fieldPath = `${path}.${key}`;
    if (!hasOwn(value, key)) continue;
    if (optional && fieldValue === undefined) continue;
    if (fieldType === "string") validateString(fieldValue, fieldPath, errors);
    if (fieldType === "boolean") validateBoolean(fieldValue, fieldPath, errors);
    if (fieldType === "number") validateNumber(fieldValue, fieldPath, errors);
    if (fieldType === "strings") validateStringArray(fieldValue, fieldPath, errors);
    if (fieldType === "links") validateLinkArray(fieldValue, fieldPath, errors);
    if (fieldType === "link") validateLink(fieldValue, fieldPath, errors);
    if (fieldType === "projectSkills") validateProjectSkills(fieldValue, fieldPath, errors);
  }
}

const profileFields = {
  fullName: "string", headline: "string", location: "string", email: "string", shortBio: "string",
  preferredName: "string?", roleEngineerPrefixes: "string?", roleEngineerSuffix: "string?", roleAlternate: "string?",
  currentTitle: "string?", currentCompany: "string?", currentExperienceId: "string?", previousExperienceId: "string?",
  featuredResearchId: "string?", primaryEducationId: "string?", pronouns: "string?", timezone: "string?",
  university: "string?", degree: "string?", fieldOfStudy: "string?", graduation: "string?", longBio: "string?",
  experienceSummary: "string?", portraitImage: "string?", faviconImage: "string?", resumeUrl: "string?",
  resumeDownloadLabel: "string?", primaryCtaLabel: "string?", secondaryCtaLabel: "string?"
} as const satisfies FieldSchema;

const collectionFields = {
  links: { id: "string", label: "string", url: "string", icon: "string?", kind: "string", isPrimary: "boolean", showOnHome: "boolean", showInHeader: "boolean", showInFooter: "boolean", order: "number?" },
  research: { id: "string", title: "string", homeTitle: "string?", role: "string?", organization: "string?", organizationLogo: "string?", organizationLogoAlt: "string?", location: "string?", startDate: "string?", endDate: "string?", homeSummary: "string?", profileSummary: "string?", profileByline: "string?", profileLabs: "strings?", detailSummary: "string?", impact: "string?", bullets: "strings", skills: "strings", links: "links", pendingLinks: "strings?", graphicalAbstract: "string?", graphicalAbstractAlt: "string?", video: "string?", featured: "boolean", showOnHome: "boolean", homeOrder: "number?", detailOrder: "number?" },
  projects: { id: "string", title: "string", subtitle: "string?", homeSummary: "string?", homeSkills: "projectSkills", detailSummary: "string?", problem: "string?", solution: "string?", impact: "string?", stack: "strings", links: "links", image: "string?", featured: "boolean", showOnHome: "boolean", homeOrder: "number?", detailOrder: "number?" },
  experience: { id: "string", title: "string", organization: "string", organizationLogo: "string?", organizationLogoAlt: "string?", type: "string?", location: "string?", startDate: "string?", endDate: "string?", homeSummary: "string?", detailSummary: "string?", bullets: "strings", skills: "strings", links: "links", featured: "boolean", showOnHome: "boolean", homeOrder: "number?", detailOrder: "number?" },
  recommendations: { id: "string", recommenderName: "string", recommenderTitle: "string?", recommenderOrganization: "string?", relationship: "string?", recommendationDate: "string?", source: "string?", sourceUrl: "string?", linkedinUrl: "string?", homeQuote: "string?", fullQuote: "string", fullQuoteLink: "link?", context: "string?", skills: "strings", featured: "boolean", showOnHome: "boolean", homeOrder: "number?", detailOrder: "number?" },
  education: { id: "string", institution: "string", institutionLogo: "string?", institutionLogoAlt: "string?", degree: "string", field: "string?", concentration: "string?", location: "string?", startDate: "string?", endDate: "string?", homeSummary: "string?", detailSummary: "string?", bullets: "strings", featured: "boolean", showOnHome: "boolean", homeOrder: "number?", detailOrder: "number?" },
  skills: { id: "string", category: "string", categoryOrder: "number?", name: "string", icon: "string?", proficiency: "string?", summary: "string?", whereUsed: "string?", priority: "number?", featured: "boolean", showOnHome: "boolean", order: "number?" },
  resume: { section: "string", key: "string", value: "string", order: "number?" }
} as const satisfies Record<string, FieldSchema>;

const siteSettingsFields = {
  siteTitle: "string", siteDescription: "string", defaultTheme: "string", enableSkeletons: "boolean",
  enableScrollMotion: "boolean", enableGlassEffects: "boolean", enableRecommendations: "boolean",
  showEmptyRecommendations: "boolean", maxHomeResearchItems: "number", maxHomeProjectItems: "number",
  maxHomeExperienceItems: "number", maxHomeRecommendationItems: "number", maxHomeSkillItems: "number",
  recommendationsNavLabel: "string", licenseName: "string?", licenseUrl: "string?", copyrightOwner: "string?",
  repositoryUrl: "string?", legalContactEmail: "string?", legalEffectiveDate: "string?", hostingProviderName: "string?",
  hostingPrivacyUrl: "string?"
} as const satisfies FieldSchema;

function validateGeneratedContentShape(input: unknown, errors: string[]): input is GeneratedPortfolioContent {
  const sourceNames = ["profile", "links", "research", "projects", "experience", "recommendations", "education", "skills", "resume", "site_settings"] as const;
  const topLevelKeys = ["metadata", "profile", "links", "research", "projects", "experience", "recommendations", "education", "skills", "resume", "siteSettings"] as const;
  if (!validateObjectShape(input, "content", topLevelKeys, [], errors)) return false;
  validateTypedObject(input.profile, "profile", errors, profileFields);
  validateTypedObject(input.siteSettings, "siteSettings", errors, siteSettingsFields);

  if (validateObjectShape(input.metadata, "metadata", ["generatedAt", "contentHash", "sourceMode", "sources"], [], errors)) {
    validateString(input.metadata.generatedAt, "metadata.generatedAt", errors);
    validateString(input.metadata.contentHash, "metadata.contentHash", errors);
    validateString(input.metadata.sourceMode, "metadata.sourceMode", errors);
    if (typeof input.metadata.generatedAt === "string" && (Number.isNaN(Date.parse(input.metadata.generatedAt)) || new Date(input.metadata.generatedAt).toISOString() !== input.metadata.generatedAt)) {
      addShapeError(errors, "metadata.generatedAt", "an ISO timestamp");
    }
    if (typeof input.metadata.contentHash === "string" && !/^[a-f0-9]{64}$/.test(input.metadata.contentHash)) {
      addShapeError(errors, "metadata.contentHash", "a lowercase SHA-256 hash");
    }
    if (typeof input.metadata.sourceMode === "string" && !["templates", "remote", "mixed"].includes(input.metadata.sourceMode)) addShapeError(errors, "metadata.sourceMode", "templates, remote, or mixed");
    if (validateObjectShape(input.metadata.sources, "metadata.sources", sourceNames, [], errors)) {
      const workbookSourceValues: Array<"template" | "remote"> = [];
      for (const name of sourceNames) {
        const source = input.metadata.sources[name];
        validateString(source, `metadata.sources.${name}`, errors);
        if (typeof source === "string" && source !== "template" && source !== "remote") addShapeError(errors, `metadata.sources.${name}`, "template or remote");
        if (name === "resume") {
          if (source !== "template") errors.push("metadata.sources.resume must be template");
        } else if (source === "template" || source === "remote") {
          workbookSourceValues.push(source);
        }
      }
      if (
        input.metadata.sourceMode === "templates" && workbookSourceValues.some((source) => source !== "template") ||
        input.metadata.sourceMode === "remote" && workbookSourceValues.some((source) => source !== "remote") ||
        input.metadata.sourceMode === "mixed" && (!workbookSourceValues.includes("template") || !workbookSourceValues.includes("remote"))
      ) {
        errors.push("metadata.sourceMode must match metadata.sources");
      }
    }
  }

  for (const [collection, fields] of Object.entries(collectionFields)) {
    const value = input[collection];
    if (!Array.isArray(value)) {
      addShapeError(errors, collection, "an array");
      continue;
    }
    value.forEach((item, index) => validateTypedObject(item, `${collection}[${index}]`, errors, fields));
  }

  return errors.length === 0;
}

function decodePathToFixedPoint(value: string): string | undefined {
  let decodedPath = value;

  try {
    while (true) {
      const nextPath = decodeURIComponent(decodedPath);
      if (nextPath === decodedPath) return decodedPath;
      decodedPath = nextPath;
    }
  } catch {
    return undefined;
  }
}

function isSafeRootRelativePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\0")) {
    return false;
  }

  const decodedPath = decodePathToFixedPoint(value.split(/[?#]/)[0] ?? value);
  return Boolean(
    decodedPath &&
      !decodedPath.includes("\\") &&
      !decodedPath.includes("\0") &&
      !decodedPath.split("/").some((segment) => segment === "..")
  );
}

const supportedResearchAbstractExtensions = [".avif", ".jpg", ".jpeg", ".png", ".webp"] as const;
const supportedResearchVideoExtensions = [".mp4", ".webm"] as const;
const supportedResearchCaptionExtensions = [".vtt"] as const;
const supportedResearchTranscriptExtensions = [".txt"] as const;

function isSupportedResearchMediaPath(value: string, extensions: readonly string[]): boolean {
  const trimmedValue = value.trim();

  if (
    !trimmedValue ||
    trimmedValue !== value ||
    /\s/.test(trimmedValue) ||
    trimmedValue.includes("?") ||
    trimmedValue.includes("#") ||
    !isSafeRootRelativePath(trimmedValue)
  ) {
    return false;
  }

  const decodedPath = decodePathToFixedPoint(trimmedValue);
  if (!decodedPath) return false;

  const lowerPath = decodedPath.toLowerCase();
  const researchMediaPrefix = "/images/research/";

  if (/[\\\0\s?#]/.test(decodedPath)) return false;

  return (
    decodedPath.startsWith(researchMediaPrefix) &&
    extensions.some(
      (extension) =>
        lowerPath.endsWith(extension) && decodedPath.length > researchMediaPrefix.length + extension.length
    )
  );
}

export function isSupportedResearchGraphicalAbstractPath(value: string): boolean {
  return isSupportedResearchMediaPath(value, supportedResearchAbstractExtensions);
}

export function isSupportedResearchVideoPath(value: string): boolean {
  return isSupportedResearchMediaPath(value, supportedResearchVideoExtensions);
}

export function isSupportedResearchCaptionPath(value: string): boolean {
  return isSupportedResearchMediaPath(value, supportedResearchCaptionExtensions);
}

export function isSupportedResearchTranscriptPath(value: string): boolean {
  return isSupportedResearchMediaPath(value, supportedResearchTranscriptExtensions);
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
      errors.push(`${location} has an invalid URL`);
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
      errors.push(`links.${link.id} has an invalid URL`);
    }
  }
}

function validateResearch(items: ResearchItem[], errors: string[]): void {
  for (const item of items) {
    if (!item.title) {
      errors.push(`research.${item.id} is missing title`);
    }

    const hasGraphicalAbstract = Boolean(item.graphicalAbstract);
    const hasGraphicalAbstractAlt = Boolean(item.graphicalAbstractAlt?.trim());

    if (hasGraphicalAbstract !== hasGraphicalAbstractAlt) {
      errors.push(`research.${item.id} must provide graphicalAbstract and graphicalAbstractAlt together`);
    }

    if (
      item.graphicalAbstract &&
      !isSupportedResearchGraphicalAbstractPath(item.graphicalAbstract)
    ) {
      errors.push(`research.${item.id} has an invalid graphicalAbstract path`);
    }

    if (item.video && !isSupportedResearchVideoPath(item.video)) {
      errors.push(`research.${item.id} has an invalid video path`);
    }

    if (item.video && !hasGraphicalAbstract) {
      errors.push(`research.${item.id} requires graphicalAbstract when video is provided`);
    }

    if (item.organizationLogo && !isSupportedUrl(item.organizationLogo, { allowMailto: false })) {
      errors.push(`research.${item.id} has an invalid organizationLogo URL`);
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
      errors.push(`projects.${item.id} has an invalid image URL`);
    }

    if (item.homeSkills.length > 3) {
      errors.push(`projects.${item.id}.homeSkills must contain at most 3 skills`);
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
      errors.push(`experience.${item.id} has an invalid organizationLogo URL`);
    }

    collectContentLinks(item.links, `experience.${item.id}`, errors);
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
      errors.push(`recommendations.${item.id} has an invalid sourceUrl`);
    }

    if (item.linkedinUrl && !isHttpsUrl(item.linkedinUrl)) {
      errors.push(`recommendations.${item.id} has an invalid linkedinUrl`);
    }

    if (item.fullQuoteLink) {
      const { label, url } = item.fullQuoteLink;

      if (!label || item.fullQuote.indexOf(label) < 0 || item.fullQuote.indexOf(label) !== item.fullQuote.lastIndexOf(label)) {
        errors.push(`recommendations.${item.id} must include its fullQuoteLink label exactly once in fullQuote: ${label}`);
      }

      if (!isHttpsUrl(url)) {
        errors.push(`recommendations.${item.id} has an invalid fullQuoteLink URL`);
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
      errors.push(`education.${item.id} has an invalid institutionLogo URL`);
    }
  }
}

export function validatePortfolioContent(input: unknown): GeneratedPortfolioContent {
  const errors: string[] = [];

  if (!validateGeneratedContentShape(input, errors)) {
    throw new Error(`Portfolio content validation failed:\n- ${errors.join("\n- ")}`);
  }

  const content = input as GeneratedPortfolioContent;

  if (!content.profile.fullName) errors.push("profile.fullName is required");
  if (!content.profile.headline) errors.push("profile.headline is required");
  if (!content.profile.location) errors.push("profile.location is required");
  if (!content.profile.email) errors.push("profile.email is required");
  if (!content.profile.shortBio) errors.push("profile.shortBio is required");

  if (content.profile.resumeUrl && !isSupportedUrl(content.profile.resumeUrl)) {
    errors.push("profile.resumeUrl has an invalid URL");
  }

  if (content.profile.portraitImage && !isSupportedUrl(content.profile.portraitImage)) {
    errors.push("profile.portraitImage has an invalid URL");
  }

  if (content.profile.faviconImage && !isSupportedUrl(content.profile.faviconImage)) {
    errors.push("profile.faviconImage has an invalid URL");
  }

  if (typeof content.siteSettings.licenseUrl === "string" && content.siteSettings.licenseUrl && !isHttpsUrl(content.siteSettings.licenseUrl)) {
    errors.push("siteSettings.licenseUrl has an invalid URL");
  }

  if (typeof content.siteSettings.repositoryUrl === "string" && content.siteSettings.repositoryUrl && !isHttpsUrl(content.siteSettings.repositoryUrl)) {
    errors.push("siteSettings.repositoryUrl has an invalid URL");
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
    errors.push("siteSettings.hostingPrivacyUrl has an invalid URL");
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
