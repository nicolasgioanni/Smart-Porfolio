import type { EducationItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { formatEducationProgram, formatProfileOverviewDateRange } from "@/lib/content/profileOverview";

const initialsStopWords = new Set(["and", "at", "for", "of", "on", "the"]);

function getInstitutionInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
    .filter((word) => word && !initialsStopWords.has(word.toLowerCase()));
  const firstWord = words[0];

  if (!firstWord) return "?";

  if (/^[A-Z]{2,4}$/.test(firstWord)) {
    return `${firstWord}${words[1]?.[0] ?? ""}`.slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function HomeEducationSummary({ items }: { items: EducationItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="Education rows will appear here when content is available." />;
  }

  return (
    <div className="home-education-list">
      {items.map((item) => {
        const dateLabel = formatProfileOverviewDateRange(item.startDate, item.endDate);
        const programLabel = formatEducationProgram(item.degree, item.field);

        return (
          <article className="home-education-item" key={item.id}>
            <div
              className={[
                "home-education-item__mark",
                item.institutionLogo ? "home-education-item__mark--image" : null
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {item.institutionLogo ? (
                <img
                  alt={item.institutionLogoAlt ?? `${item.institution} logo`}
                  className="home-education-item__logo"
                  decoding="async"
                  height="48"
                  loading="lazy"
                  src={item.institutionLogo}
                  width="48"
                />
              ) : (
                <span aria-hidden="true" className="home-education-item__initials">
                  {getInstitutionInitials(item.institution)}
                </span>
              )}
            </div>

            <div className="home-education-item__content">
              <h3 className="home-education-item__institution">{item.institution}</h3>
              {programLabel ? <p className="home-education-item__program">{programLabel}</p> : null}
              {item.concentration ? (
                <p className="home-education-item__concentration">Concentration: {item.concentration}</p>
              ) : null}
              {dateLabel ? <p className="home-education-item__dates">{dateLabel}</p> : null}
              {item.location ? <p className="home-education-item__location">{item.location}</p> : null}
              {item.bullets.length > 0 ? (
                <ul aria-label={`${item.institution} education details`} className="home-education-item__details">
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
