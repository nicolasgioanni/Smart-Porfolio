import { getHomeMobileSummary } from "@/lib/content/homeMobileSummaries";

export function HomeCardSummary({ kind, id, summary, className }: {
  kind: "research" | "projects";
  id: string;
  summary: string;
  className: string;
}) {
  return (
    <p className={className}>
      <span className="home-card-summary__full">{summary}</span>
      <span className="home-card-summary__mobile">{getHomeMobileSummary(kind, id, summary)}</span>
    </p>
  );
}
