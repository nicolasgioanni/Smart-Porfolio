import type { ProfileContent, SiteSettings } from "@/content/types";
import type { CsvRow } from "@/lib/csv/parseCsv";

type KeySheetName = "profile" | "site_settings";

const profileKeyEntries = [
  ["full_name", "fullName"], ["preferred_name", "preferredName"], ["headline", "headline"],
  ["role_engineer_prefixes", "roleEngineerPrefixes"], ["role_engineer_suffix", "roleEngineerSuffix"],
  ["role_alternate", "roleAlternate"], ["current_title", "currentTitle"], ["current_company", "currentCompany"],
  ["current_experience_id", "currentExperienceId"], ["previous_experience_id", "previousExperienceId"],
  ["featured_research_id", "featuredResearchId"], ["primary_education_id", "primaryEducationId"],
  ["location", "location"], ["timezone", "timezone"], ["time_zone", "timezone"], ["email", "email"],
  ["pronouns", "pronouns"], ["university", "university"], ["degree", "degree"],
  ["field_of_study", "fieldOfStudy"], ["graduation", "graduation"], ["short_bio", "shortBio"],
  ["long_bio", "longBio"], ["experience_summary", "experienceSummary"], ["portrait_image", "portraitImage"],
  ["favicon_image", "faviconImage"], ["resume_url", "resumeUrl"],
  ["resume_download_label", "resumeDownloadLabel"], ["primary_cta_label", "primaryCtaLabel"],
  ["secondary_cta_label", "secondaryCtaLabel"]
] as const satisfies ReadonlyArray<readonly [string, keyof ProfileContent]>;

const siteSettingKeyEntries = [
  ["site_title", "siteTitle"], ["site_description", "siteDescription"], ["default_theme", "defaultTheme"],
  ["enable_skeletons", "enableSkeletons"], ["enable_scroll_motion", "enableScrollMotion"],
  ["enable_glass_effects", "enableGlassEffects"], ["enable_recommendations", "enableRecommendations"],
  ["show_empty_recommendations", "showEmptyRecommendations"], ["max_home_research_items", "maxHomeResearchItems"],
  ["max_home_project_items", "maxHomeProjectItems"], ["max_home_experience_items", "maxHomeExperienceItems"],
  ["max_home_recommendation_items", "maxHomeRecommendationItems"], ["max_home_skill_items", "maxHomeSkillItems"],
  ["recommendations_nav_label", "recommendationsNavLabel"], ["license_name", "licenseName"],
  ["license_url", "licenseUrl"], ["copyright_owner", "copyrightOwner"], ["repository_url", "repositoryUrl"],
  ["legal_contact_email", "legalContactEmail"], ["legal_effective_date", "legalEffectiveDate"],
  ["hosting_provider_name", "hostingProviderName"], ["hosting_privacy_url", "hostingPrivacyUrl"]
] as const satisfies ReadonlyArray<readonly [string, keyof SiteSettings]>;

const profileKeyMap = new Map<string, string>(profileKeyEntries);
const siteSettingKeyMap = new Map<string, string>(siteSettingKeyEntries);

export function getCanonicalContentKey(sheetName: KeySheetName, key: string): string | undefined {
  return (sheetName === "profile" ? profileKeyMap : siteSettingKeyMap).get(key);
}

export function validateContentKeyRows(rows: CsvRow[], sheetName: KeySheetName, source: string = sheetName): void {
  const seenCanonicalKeys = new Set<string>();

  for (const row of rows) {
    const authoredKey = row.key?.trim() ?? "";
    const canonicalKey = getCanonicalContentKey(sheetName, authoredKey);

    if (!canonicalKey) {
      throw new Error(`${source} contains an unknown key: ${authoredKey || "(blank)"}`);
    }

    if (seenCanonicalKeys.has(canonicalKey)) {
      throw new Error(`${source} contains a duplicate key after alias normalization: ${canonicalKey}`);
    }

    seenCanonicalKeys.add(canonicalKey);
  }
}
