import type { ResearchItem } from "@/content/types";
import { GlassIconLink } from "@/components/glass/GlassIconLink";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { LinkIcon } from "@/components/icons/LinkIcon";
import { DetailDisclosureList } from "@/components/portfolio/DetailDisclosureList";
import { ResearchProjectVisual } from "@/components/portfolio/ResearchProjectVisual";
import type { DetailMode } from "@/lib/content/detailNarratives";
import { getLinkKind } from "@/lib/content/displayHelpers";
import { formatProfileOverviewDateRange } from "@/lib/content/profileOverview";
import {
  getResearchDisplayTitle,
  getResearchFormalTitle,
  getResearchModeContent,
  getResearchResourceLabel
} from "@/lib/content/researchNarratives";

type ResearchCardProps = {
  item: ResearchItem;
  mode: DetailMode;
  onToggle: (sectionId: string) => void;
  openSectionId?: string;
  order: number;
};

function getProjectTheme(itemId: string): string {
  if (itemId === "cytocv-miller-lab") return "cytocv";
  if (itemId === "adversarial-machine-learning") return "aml";
  if (itemId === "yeast-dna-target-selection") return "guide-donor";
  return "default";
}

export function ResearchCard({ item, mode, onToggle, openSectionId, order }: ResearchCardProps) {
  const modeContent = getResearchModeContent(item, mode);
  const displayTitle = getResearchDisplayTitle(item);
  const formalTitle = getResearchFormalTitle(item);
  const dateLabel = formatProfileOverviewDateRange(item.startDate, item.endDate);
  const displayLinks = item.links.map((link) => ({
    ...link,
    label: getResearchResourceLabel(item.id, link.label)
  }));
  const publishedLabels = new Set(displayLinks.map((link) => link.label.trim().toLowerCase()));
  const pendingLinks = (item.pendingLinks ?? [])
    .map((label) => getResearchResourceLabel(item.id, label))
    .filter((label) => !publishedLabels.has(label.trim().toLowerCase()));

  return (
    <GlassSurface
      as="article"
      className="research-project"
      data-project={getProjectTheme(item.id)}
      data-visual-side={order % 2 === 0 ? "left" : "right"}
      id={item.id}
    >
      <div className="research-project__visual">
        <ResearchProjectVisual itemId={item.id} order={order} />
      </div>

      <div className="research-project__content">
        <header className="research-project__header">
          <div className="research-project__kicker-row">
            <span className="research-project__kicker">Research {String(order + 1).padStart(2, "0")}</span>
            {item.role ? <span className="research-project__role">{item.role}</span> : null}
          </div>
          <h2 className="research-project__title">{displayTitle}</h2>
          {formalTitle ? <p className="research-project__formal-title">{formalTitle}</p> : null}
          <div className="research-project__metadata">
            {item.organization ? <span>{item.organization}</span> : null}
            {dateLabel ? <span>{dateLabel}</span> : null}
            {item.location ? <span>{item.location}</span> : null}
          </div>
        </header>

        <div className="research-project__body" key={mode}>
          <p className="research-project__summary">{modeContent.summary}</p>
          {item.impact ? <p className="research-project__impact">{item.impact}</p> : null}
          <DetailDisclosureList
            idPrefix="research"
            itemId={item.id}
            mode={mode}
            onToggle={onToggle}
            openSectionId={openSectionId}
            sections={modeContent.sections}
          />
        </div>

        {item.links.length > 0 || pendingLinks.length > 0 ? (
          <div aria-label={`${displayTitle} resources`} className="research-project__resources" role="group">
            {displayLinks.map((link) => (
              <GlassIconLink
                aria-label={`${link.label} for ${displayTitle}`}
                className="research-project__resource"
                key={`${item.id}-${link.url}`}
                kind={getLinkKind(link)}
                label={link.label}
                url={link.url}
              />
            ))}
            {pendingLinks.map((label) => (
              <span
                aria-disabled="true"
                className="research-project__resource research-project__resource--pending"
                key={`${item.id}-${label}`}
                title={`${label} forthcoming`}
              >
                <LinkIcon kind="manuscript" />
                <span>{label} forthcoming</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </GlassSurface>
  );
}
