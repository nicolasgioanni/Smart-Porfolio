export type ContentSourceMode = "templates" | "remote" | "mixed";

export type PortfolioContentLink = {
  label: string;
  url: string;
};

export type ProfileContent = {
  fullName: string;
  headline: string;
  location: string;
  email: string;
  shortBio: string;
  preferredName?: string;
  roleEngineerPrefixes?: string;
  roleEngineerSuffix?: string;
  roleAlternate?: string;
  currentTitle?: string;
  currentCompany?: string;
  currentExperienceId?: string;
  previousExperienceId?: string;
  featuredResearchId?: string;
  primaryEducationId?: string;
  pronouns?: string;
  timezone?: string;
  university?: string;
  degree?: string;
  fieldOfStudy?: string;
  graduation?: string;
  longBio?: string;
  portraitImage?: string;
  faviconImage?: string;
  resumeUrl?: string;
  resumeDownloadLabel?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
  [key: string]: string | undefined;
};

export type PortfolioLink = {
  id: string;
  label: string;
  url: string;
  icon?: string;
  kind: string;
  isPrimary: boolean;
  showOnHome: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  order?: number;
};

export type ResearchItem = {
  id: string;
  title: string;
  homeTitle?: string;
  role?: string;
  organization?: string;
  organizationLogo?: string;
  organizationLogoAlt?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  homeSummary?: string;
  profileSummary?: string;
  profileContributions?: string[];
  profileLabs?: string[];
  detailSummary?: string;
  impact?: string;
  bullets: string[];
  skills: string[];
  links: PortfolioContentLink[];
  pendingLinks?: string[];
  image?: string;
  featured: boolean;
  showOnHome: boolean;
  homeOrder?: number;
  detailOrder?: number;
};

export type ProjectItem = {
  id: string;
  title: string;
  subtitle?: string;
  homeSummary?: string;
  homeSkills: ProjectSkill[];
  detailSummary?: string;
  problem?: string;
  solution?: string;
  impact?: string;
  stack: string[];
  links: PortfolioContentLink[];
  image?: string;
  featured: boolean;
  showOnHome: boolean;
  homeOrder?: number;
  detailOrder?: number;
};

export type ProjectSkill = {
  name: string;
  icon?: string;
  summary?: string;
  details?: string;
};

export type ExperienceItem = {
  id: string;
  title: string;
  organization: string;
  organizationLogo?: string;
  organizationLogoAlt?: string;
  type?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  homeSummary?: string;
  detailSummary?: string;
  bullets: string[];
  skills: string[];
  featured: boolean;
  showOnHome: boolean;
  homeOrder?: number;
  detailOrder?: number;
};

export type RecommendationItem = {
  id: string;
  recommenderName: string;
  recommenderTitle?: string;
  recommenderOrganization?: string;
  relationship?: string;
  recommendationDate?: string;
  source?: string;
  sourceUrl?: string;
  linkedinUrl?: string;
  homeQuote?: string;
  fullQuote: string;
  context?: string;
  skills: string[];
  featured: boolean;
  showOnHome: boolean;
  homeOrder?: number;
  detailOrder?: number;
};

export type EducationItem = {
  id: string;
  institution: string;
  institutionLogo?: string;
  institutionLogoAlt?: string;
  degree: string;
  field?: string;
  concentration?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  homeSummary?: string;
  detailSummary?: string;
  bullets: string[];
  featured: boolean;
  showOnHome: boolean;
  homeOrder?: number;
  detailOrder?: number;
};

export type SkillItem = {
  id: string;
  category: string;
  categoryOrder?: number;
  name: string;
  icon?: string;
  priority?: number;
  featured: boolean;
  showOnHome: boolean;
  order?: number;
};

export type ResumeEntry = {
  section: string;
  key: string;
  value: string;
  order?: number;
};

export type SiteSettings = {
  siteTitle: string;
  siteDescription: string;
  defaultTheme: string;
  enableSkeletons: boolean;
  enableScrollMotion: boolean;
  enableGlassEffects: boolean;
  enableRecommendations: boolean;
  showEmptyRecommendations: boolean;
  maxHomeResearchItems: number;
  maxHomeProjectItems: number;
  maxHomeExperienceItems: number;
  maxHomeRecommendationItems: number;
  maxHomeSkillItems: number;
  recommendationsNavLabel: string;
  licenseName?: string;
  licenseUrl?: string;
  copyrightOwner?: string;
  repositoryUrl?: string;
  legalContactEmail?: string;
  legalEffectiveDate?: string;
  hostingProviderName?: string;
  hostingPrivacyUrl?: string;
  [key: string]: string | number | boolean | undefined;
};

export type GeneratedContentMetadata = {
  generatedAt: string;
  sourceMode: ContentSourceMode;
  sources: Record<string, "template" | "remote">;
};

export type GeneratedPortfolioContent = {
  metadata: GeneratedContentMetadata;
  profile: ProfileContent;
  links: PortfolioLink[];
  research: ResearchItem[];
  projects: ProjectItem[];
  experience: ExperienceItem[];
  recommendations: RecommendationItem[];
  education: EducationItem[];
  skills: SkillItem[];
  resume: ResumeEntry[];
  siteSettings: SiteSettings;
};

export type SkillGroup = {
  category: string;
  order?: number;
  skills: SkillItem[];
};

export type ProfileOverviewLogo = {
  alt: string;
  src: string;
};

export type ProfileOverviewWork = {
  id?: string;
  title?: string;
  organization?: string;
  startDate?: string;
  endDate?: string;
  dateLabel?: string;
  summary?: string;
  logo?: ProfileOverviewLogo;
};

export type ProfileOverviewResearch = {
  id: string;
  title: string;
  position?: string;
  contributions?: string[];
  labs?: string[];
  summary?: string;
  links: PortfolioContentLink[];
  pendingLinks: string[];
  logo?: ProfileOverviewLogo;
};

export type ProfileOverviewEducation = {
  id?: string;
  institution?: string;
  degree?: string;
  field?: string;
  concentration?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  graduationLabel?: string;
  logo?: ProfileOverviewLogo;
};

export type ProfileOverviewRole =
  | {
      kind: "rotating";
      engineerPrefixes: string[];
      engineerSuffix: string;
      alternate: string;
    }
  | {
      kind: "static";
      label: string;
    };

export type ProfileOverviewContent = {
  greetingName: string;
  role: ProfileOverviewRole;
  about?: string;
  currentWork?: ProfileOverviewWork;
  education?: ProfileOverviewEducation;
  research?: ProfileOverviewResearch;
};

export type HomePortfolioContent = {
  profile: ProfileContent;
  profileOverview: ProfileOverviewContent;
  links: PortfolioLink[];
  research: ResearchItem[];
  projects: ProjectItem[];
  experience: ExperienceItem[];
  recommendations: RecommendationItem[];
  education: EducationItem[];
  skillGroups: SkillGroup[];
  resume: ResumeEntry[];
  siteSettings: SiteSettings;
};
