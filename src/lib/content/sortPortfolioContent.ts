type HomeSortableItem = {
  featured: boolean;
  homeOrder?: number;
  title?: string;
  institution?: string;
  id?: string;
  startDate?: string;
};

type DetailSortableItem = {
  featured: boolean;
  detailOrder?: number;
  title?: string;
  institution?: string;
  id?: string;
  startDate?: string;
};

type RecommendationSortableItem = {
  featured: boolean;
  homeOrder?: number;
  detailOrder?: number;
  recommendationDate?: string;
  recommenderName?: string;
  id?: string;
};

type GenericSortableItem = {
  order?: number;
  priority?: number;
  category?: string;
  name?: string;
  label?: string;
  section?: string;
  key?: string;
};

function missingLast(value: number | undefined): number {
  return value ?? Number.MAX_SAFE_INTEGER;
}

function compareText(left: string | undefined, right: string | undefined): number {
  return (left ?? "").localeCompare(right ?? "");
}

function compareStartDateDescending(left: string | undefined, right: string | undefined): number {
  return (right ?? "").localeCompare(left ?? "");
}

function compareDisplayName(
  left: { title?: string; institution?: string; id?: string },
  right: { title?: string; institution?: string; id?: string }
): number {
  return compareText(left.title ?? left.institution ?? left.id, right.title ?? right.institution ?? right.id);
}

export function sortForHome<TItem extends HomeSortableItem>(items: TItem[]): TItem[] {
  return [...items].sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;

    const orderDifference = missingLast(left.homeOrder) - missingLast(right.homeOrder);
    if (orderDifference !== 0) return orderDifference;

    const dateDifference = compareStartDateDescending(left.startDate, right.startDate);
    if (dateDifference !== 0) return dateDifference;

    return compareDisplayName(left, right);
  });
}

export function sortForDetail<TItem extends DetailSortableItem>(items: TItem[]): TItem[] {
  return [...items].sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;

    const orderDifference = missingLast(left.detailOrder) - missingLast(right.detailOrder);
    if (orderDifference !== 0) return orderDifference;

    const dateDifference = compareStartDateDescending(left.startDate, right.startDate);
    if (dateDifference !== 0) return dateDifference;

    return compareDisplayName(left, right);
  });
}

function compareRecommendationName(left: RecommendationSortableItem, right: RecommendationSortableItem): number {
  return compareText(left.recommenderName ?? left.id, right.recommenderName ?? right.id);
}

export function sortRecommendationsForHome<TItem extends RecommendationSortableItem>(items: TItem[]): TItem[] {
  return [...items].sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;

    const orderDifference = missingLast(left.homeOrder) - missingLast(right.homeOrder);
    if (orderDifference !== 0) return orderDifference;

    const dateDifference = compareStartDateDescending(left.recommendationDate, right.recommendationDate);
    if (dateDifference !== 0) return dateDifference;

    return compareRecommendationName(left, right);
  });
}

export function sortRecommendationsForDetail<TItem extends RecommendationSortableItem>(items: TItem[]): TItem[] {
  return [...items].sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;

    const orderDifference = missingLast(left.detailOrder) - missingLast(right.detailOrder);
    if (orderDifference !== 0) return orderDifference;

    const dateDifference = compareStartDateDescending(left.recommendationDate, right.recommendationDate);
    if (dateDifference !== 0) return dateDifference;

    return compareRecommendationName(left, right);
  });
}

export function sortGeneric<TItem extends GenericSortableItem>(items: TItem[]): TItem[] {
  return [...items].sort((left, right) => {
    const priorityDifference = missingLast(left.priority) - missingLast(right.priority);
    if (priorityDifference !== 0) return priorityDifference;

    const orderDifference = missingLast(left.order) - missingLast(right.order);
    if (orderDifference !== 0) return orderDifference;

    const categoryDifference = compareText(left.category ?? left.section, right.category ?? right.section);
    if (categoryDifference !== 0) return categoryDifference;

    return compareText(left.name ?? left.label ?? left.key, right.name ?? right.label ?? right.key);
  });
}
