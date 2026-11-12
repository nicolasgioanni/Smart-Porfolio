export type CalendarMonth = {
  month: number;
  year: number;
};

function parseCalendarMonth(value: string | undefined): CalendarMonth | undefined {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value?.trim() ?? "");
  if (!match) return undefined;

  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isCurrentExperienceEndDate(value: string | undefined): boolean {
  const normalizedValue = value?.trim().toLowerCase();
  return !normalizedValue || normalizedValue === "present" || normalizedValue === "current";
}

export function formatExperienceDuration(
  startDate: string | undefined,
  endDate: string | undefined,
  currentMonth?: CalendarMonth
): string | undefined {
  const start = parseCalendarMonth(startDate);
  const end = currentMonth ?? parseCalendarMonth(endDate);
  if (!start || !end) return undefined;

  const months = (end.year - start.year) * 12 + end.month - start.month + 1;
  if (months < 1) return undefined;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts = [
    years > 0 ? `${years} ${years === 1 ? "yr" : "yrs"}` : undefined,
    remainingMonths > 0 ? `${remainingMonths} ${remainingMonths === 1 ? "mo" : "mos"}` : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ") || undefined;
}
