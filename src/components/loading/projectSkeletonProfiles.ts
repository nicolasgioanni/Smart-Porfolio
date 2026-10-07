import type { ProjectItem } from "@/content/types";
import { getProjectActions } from "@/lib/projects/projectActions";
import { getProjectVisual } from "@/lib/projects/projectVisualRegistry";

export type ProjectSkeletonProfile = {
  actionWidths: readonly number[];
  hasVisual: boolean;
  id: string;
  summaryWidths: readonly number[];
  tabCount: number;
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
    actionWidths: getProjectActions(item.links).map((action) => (action.label === "Source code" ? 112 : 96)),
    hasVisual: hasKnownVisual || Boolean(item.image),
    id: item.id,
    summaryWidths: index % 2 === 0 ? [100, 86] : [100, 72],
    tabCount: hasKnownVisual ? 2 : 0
    };
  });
}

export function getHomeProjectSkeletonProfiles(items: readonly ProjectItem[]): HomeProjectSkeletonProfile[] {
  return items.map((item) => ({
    actionWidths: getProjectActions(item.links).map((action) => (action.label === "Source code" ? 92 : 84)),
    id: item.id
  }));
}
