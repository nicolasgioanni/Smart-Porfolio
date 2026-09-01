export type ProjectSkeletonProfile = {
  actionWidths: readonly number[];
  chipWidths: readonly number[];
  deepDiveLines: readonly (readonly number[])[];
  id: "notepal" | "clair" | "leetnotes";
};

/**
 * Literal presentation data in resolved detail order. Keeping it local means
 * the loading boundary never waits on generated portfolio content.
 */
export const projectSkeletonProfiles = [
  {
    actionWidths: [112, 96],
    chipWidths: [60, 78, 59, 54, 90, 82, 70, 70, 86, 62],
    deepDiveLines: [[100, 84], [100, 88]],
    id: "notepal"
  },
  {
    actionWidths: [112],
    chipWidths: [66, 59, 82, 40, 54, 82],
    deepDiveLines: [[100, 86], [100, 84]],
    id: "clair"
  },
  {
    actionWidths: [112],
    chipWidths: [59, 102, 100, 44, 54],
    deepDiveLines: [[100, 86], [100, 90]],
    id: "leetnotes"
  }
] as const satisfies readonly ProjectSkeletonProfile[];
