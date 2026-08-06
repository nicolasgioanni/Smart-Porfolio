import type { ExperienceItem } from "@/content/types";
import { EmptyState } from "@/components/portfolio/EmptyState";
import { formatProfileOverviewDateRange } from "@/lib/content/profileOverview";

const initialsStopWords = new Set(["and", "at", "for", "of", "on", "the"]);

type ExperienceOrganizationGroup = {
  items: ExperienceItem[];
  organization: string;
  organizationLogo?: string;
  organizationLogoAlt?: string;
};

function getOrganizationInitials(name: string): string {
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

function groupExperienceByOrganization(items: ExperienceItem[]): ExperienceOrganizationGroup[] {
  const groups = new Map<string, ExperienceOrganizationGroup>();

  for (const item of items) {
    const organizationKey = item.organization.trim().toLowerCase();
    const existingGroup = groups.get(organizationKey);

    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.organizationLogo ??= item.organizationLogo;
      existingGroup.organizationLogoAlt ??= item.organizationLogoAlt;
      continue;
    }

    groups.set(organizationKey, {
      items: [item],
      organization: item.organization,
      organizationLogo: item.organizationLogo,
      organizationLogoAlt: item.organizationLogoAlt
    });
  }

  return Array.from(groups.values());
}

export function HomeFeaturedExperience({ items }: { items: ExperienceItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="Experience entries will appear here when content is available." />;
  }

  const organizationGroups = groupExperienceByOrganization(items);

  return (
    <div className="home-experience-list">
      {organizationGroups.map((group) => (
        <section className="home-experience-group" key={group.organization.toLowerCase()}>
          <div className="home-experience-group__mark">
            {group.organizationLogo ? (
              <img
                alt={group.organizationLogoAlt ?? `${group.organization} logo`}
                className="home-experience-group__logo"
                decoding="async"
                height="48"
                loading="lazy"
                src={group.organizationLogo}
                width="48"
              />
            ) : (
              <span aria-hidden="true" className="home-experience-group__initials">
                {getOrganizationInitials(group.organization)}
              </span>
            )}
          </div>

          <div className="home-experience-group__content">
            <h3 className="home-experience-group__organization">{group.organization}</h3>
            <div className="home-experience-group__roles" data-multiple={group.items.length > 1 ? "true" : "false"}>
              {group.items.map((item) => {
                const dateLabel = formatProfileOverviewDateRange(item.startDate, item.endDate);

                return (
                  <article className="home-experience-role" key={item.id}>
                    <div className="home-experience-role__body">
                      <h4 className="home-experience-role__title">{item.title}</h4>
                      {dateLabel ? <p className="home-experience-role__dates">{dateLabel}</p> : null}
                      {item.location ? <p className="home-experience-role__location">{item.location}</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
