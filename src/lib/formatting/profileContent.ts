import { formatSingleDate } from "@/lib/formatting/formatDateRange";

function clean(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export function formatProfileOverviewDateRange(startDate: string | undefined, endDate: string | undefined): string | undefined {
  const formattedStartDate = formatSingleDate(clean(startDate));
  const formattedEndDate = formatSingleDate(clean(endDate)) ?? (formattedStartDate ? "Present" : undefined);
  return formattedStartDate && formattedEndDate ? `${formattedStartDate} – ${formattedEndDate}` : formattedStartDate ?? formattedEndDate;
}

export function formatCompactGraduationDate(endDate: string | undefined): string | undefined {
  const formattedEndDate = formatSingleDate(clean(endDate));
  return formattedEndDate ? `Graduated ${formattedEndDate}` : undefined;
}

export function formatEducationProgram(degree: string | undefined, field: string | undefined): string | undefined {
  const cleanDegree = clean(degree);
  const cleanField = clean(field);
  return cleanDegree && cleanField ? `${cleanDegree} in ${cleanField}` : cleanDegree ?? cleanField;
}
