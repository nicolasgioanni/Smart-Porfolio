export function formatSingleDate(value: string | undefined): string | undefined {
  if (!value) return undefined;

  if (/^\d{4}$/.test(value)) return value;

  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, 1))
    );
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, day))
    );
  }

  return value;
}

export function formatDateRange(startDate?: string, endDate?: string): string {
  const formattedStartDate = formatSingleDate(startDate);
  const formattedEndDate = formatSingleDate(endDate) ?? (formattedStartDate ? "Present" : undefined);

  if (formattedStartDate && formattedEndDate) return `${formattedStartDate} to ${formattedEndDate}`;
  if (formattedStartDate) return formattedStartDate;
  if (formattedEndDate) return formattedEndDate;

  return "";
}
