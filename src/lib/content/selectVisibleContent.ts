export type HomeVisibleItem = {
  featured: boolean;
  showOnHome: boolean;
};

export function resolveItemLimit(maxItems: number | undefined, fallback: number): number {
  return maxItems && maxItems > 0 ? maxItems : fallback;
}

export function selectHomeCandidates<TItem extends HomeVisibleItem>(items: TItem[]): TItem[] {
  const visibleItems = items.filter((item) => item.showOnHome);
  if (visibleItems.length > 0) return visibleItems;

  const featuredItems = items.filter((item) => item.featured);
  return featuredItems.length > 0 ? featuredItems : items;
}
