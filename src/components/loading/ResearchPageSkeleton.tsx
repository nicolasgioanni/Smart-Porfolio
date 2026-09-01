import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { RouteHeaderSkeleton } from "@/components/loading/RouteHeaderSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutes } from "@/components/navigation/siteRoutes";

type ResearchSkeletonMedia = "abstract" | "video-and-abstract";

export type ResearchSkeletonProfile = {
  actionWidths: readonly number[];
  formalTitle: boolean;
  id: "cytocv-miller-lab" | "adversarial-machine-learning" | "yeast-dna-target-selection";
  impact: boolean;
  media: ResearchSkeletonMedia;
  organizationLogo: boolean;
  overviewRows: number;
  resourceWidths: readonly number[];
};

/**
 * Deliberately literal display profiles in `selectResearchDetailContent` order.
 * Loading remains independent of generated content and of modal-only media.
 */
export const researchSkeletonProfiles = [
  {
    actionWidths: [112, 118, 132],
    formalTitle: true,
    id: "cytocv-miller-lab",
    impact: true,
    media: "video-and-abstract",
    organizationLogo: true,
    overviewRows: 4,
    resourceWidths: [112, 126, 118, 104]
  },
  {
    actionWidths: [],
    formalTitle: false,
    id: "adversarial-machine-learning",
    impact: true,
    media: "abstract",
    organizationLogo: true,
    overviewRows: 3,
    resourceWidths: [132, 118, 124]
  },
  {
    actionWidths: [],
    formalTitle: true,
    id: "yeast-dna-target-selection",
    impact: true,
    media: "abstract",
    organizationLogo: true,
    overviewRows: 3,
    resourceWidths: [128]
  }
] as const satisfies readonly ResearchSkeletonProfile[];

function ResearchAbstractSkeleton({ inset = false }: { inset?: boolean }) {
  return (
    <div className={["research-skeleton__abstract", inset ? "research-skeleton__abstract--inset" : null].filter(Boolean).join(" ")}>
      <div className="research-skeleton__abstract-frame">
        <SkeletonBlock className="research-skeleton__abstract-surface" height="100%" radius={0} />
        <SkeletonBlock className="research-skeleton__abstract-hint" height={44} radius="999px" width={44} />
      </div>
    </div>
  );
}

function ResearchVideoSkeleton({ actionWidths }: { actionWidths: readonly number[] }) {
  return (
    <section className="research-skeleton__video">
      <div className="research-skeleton__video-header">
        <SkeletonBlock height={14} width="46%" />
        <SkeletonBlock height={12} width="28%" />
      </div>
      <div className="research-skeleton__video-actions">
        {actionWidths.map((width, index) => <SkeletonBlock height={44} key={index} radius="999px" width={width} />)}
      </div>
      <div className="research-skeleton__video-viewport">
        <SkeletonBlock className="research-skeleton__video-surface" height="100%" radius={0} />
        <div className="research-skeleton__video-controls">
          <SkeletonBlock height={2} radius="999px" width="100%" />
          <div>
            <SkeletonBlock height={16} radius="999px" width={16} />
            <SkeletonBlock height={12} width="24%" />
            <SkeletonBlock height={16} radius="999px" width={16} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ResearchMediaSkeleton({ profile }: { profile: ResearchSkeletonProfile }) {
  if (profile.media === "abstract") return <ResearchAbstractSkeleton />;

  return (
    <div className="research-skeleton__media-stack">
      <ResearchVideoSkeleton actionWidths={profile.actionWidths} />
      <ResearchAbstractSkeleton inset />
    </div>
  );
}

function ResearchCardSkeleton({ index, profile }: { index: number; profile: ResearchSkeletonProfile }) {
  return (
    <article
      className="research-skeleton__project"
      data-visual-side={index % 2 === 0 ? "left" : "right"}
    >
      <div className="research-skeleton__visual">
        <ResearchMediaSkeleton profile={profile} />
      </div>
      <div className="research-skeleton__content">
        <header className="research-skeleton__header">
          <div className="research-skeleton__identity">
            <SkeletonBlock height={14} width={36} />
            {profile.organizationLogo ? <SkeletonBlock height={44} radius="999px" width={44} /> : null}
          </div>
          <SkeletonBlock className="research-skeleton__project-title" height={34} width="72%" />
          {profile.formalTitle ? <SkeletonBlock height={14} width="82%" /> : null}
        </header>
        <div className="research-skeleton__body">
          <SkeletonText rows={2} widths={["100%", "78%"]} />
          {profile.impact ? <SkeletonBlock className="research-skeleton__impact" height={28} radius={10} width="42%" /> : null}
          <div className="research-skeleton__details">
            {Array.from({ length: profile.overviewRows }).map((_, detailIndex) => (
              <SkeletonBlock height={76} key={detailIndex} />
            ))}
          </div>
        </div>
        <div className="research-skeleton__resources">
          {profile.resourceWidths.map((width, resourceIndex) => (
            <SkeletonBlock height={44} key={resourceIndex} radius="999px" width={width} />
          ))}
        </div>
      </div>
    </article>
  );
}

export function ResearchPageSkeleton() {
  return (
    <PageSkeleton pathname={siteRoutes.research}>
      <div aria-hidden="true" className="research-skeleton">
        <div className="research-skeleton__intro">
          <div className="research-skeleton__intro-copy">
            <RouteHeaderSkeleton pathname={siteRoutes.research} />
          </div>
          <div className="research-skeleton__intro-control">
            <SkeletonBlock height={20.4} width={42} />
            <SkeletonBlock height={52} radius="999px" width={196} />
          </div>
        </div>
        {researchSkeletonProfiles.map((profile, index) => <ResearchCardSkeleton index={index} key={profile.id} profile={profile} />)}
      </div>
    </PageSkeleton>
  );
}
