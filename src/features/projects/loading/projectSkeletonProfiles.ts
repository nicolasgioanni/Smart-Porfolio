import type { ProjectItem } from "@/content/types";
import { getProjectActions } from "@/features/projects/selectors/projectActions";
import { getProjectVisual } from "@/features/projects/selectors/projectVisualRegistry";

export type ProjectSkeletonProfile = {
  actionWidths: readonly number[];
  hasAttribution: boolean;
  hasVisual: boolean;
  id: string;
  summaryWidths: readonly number[];
  hasBadge: boolean;
  visualControlCount: number;
};

export type HomeProjectSkeletonProfile = Pick<ProjectSkeletonProfile, "actionWidths" | "id">;

/**
 * The Projects loader follows the validated detail selection. This keeps both
 * the legacy three-row template and the five-project showcase aligned with
 * their rendered cards without duplicating workbook-owned counts.
 */
export function getProjectSkeletonProfiles(items: readonly ProjectItem[]): ProjectSkeletonProfile[] {
  return items.map((item, index) => {
    const hasKnownVisual = Boolean(getProjectVisual(item.id));

    return {
      actionWidths: getProjectActions(item.links).map((action) => action.label === "Source code" ? 112 : action.label === "Download" ? 94 : 96),
      hasAttribution: Boolean(getProjectVisual(item.id)?.attribution),
      hasBadge: Boolean(getProjectVisual(item.id)?.badge),
      hasVisual: hasKnownVisual || Boolean(item.image),
      id: item.id,
      summaryWidths: index % 2 === 0 ? [100, 86] : [100, 72],
      visualControlCount: hasKnownVisual ? 1 : 0
    };
  });
}

export function getHomeProjectSkeletonProfiles(items: readonly ProjectItem[]): HomeProjectSkeletonProfile[] {
  return items.map((item) => ({
    actionWidths: getProjectActions(item.links).map((action) => action.label === "Source code" ? 92 : action.label === "Download" ? 88 : 84),
    id: item.id
  }));
}
