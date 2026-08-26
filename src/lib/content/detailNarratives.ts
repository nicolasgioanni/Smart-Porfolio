export type DetailMode = "overview" | "technical";

export type DetailSection = {
  id: string;
  title: string;
  lead: string;
  details: string[];
  signal?: string;
  tools?: string[];
};

export type DetailModeContent = {
  summary: string;
  sections: DetailSection[];
};

export type DetailNarrative = Record<DetailMode, DetailModeContent>;

export const DETAILS_UNAVAILABLE = "Details not yet available.";
