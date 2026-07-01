export function formatList(items: string[], maxItems?: number): string {
  const visibleItems = maxItems && maxItems > 0 ? items.slice(0, maxItems) : items;
  const remainingCount = maxItems && items.length > maxItems ? items.length - maxItems : 0;
  const formattedItems = visibleItems.join(", ");

  if (remainingCount > 0) {
    return `${formattedItems} and ${remainingCount} more`;
  }

  return formattedItems;
}
