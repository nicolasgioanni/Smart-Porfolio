import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";

export function HomePageSkeleton() {
  return (
    <PageSkeleton showHeader={false} variant="home">
      <div aria-hidden="true" className="home-skeleton">
        <section className="home-skeleton__hero">
          <div className="home-skeleton__profile">
            <div className="home-skeleton__portrait-column">
              <SkeletonBlock className="home-skeleton__portrait" height={280} radius="999px" width={280} />
              <SkeletonBlock height={28} width="68%" />
              <SkeletonBlock height={16} width="42%" />
            </div>
            <div className="home-skeleton__identity-list">
              <SkeletonBlock height={16} width="78%" />
              <SkeletonBlock height={16} width="64%" />
            </div>
          </div>
          <div className="home-skeleton__introduction">
            <SkeletonBlock height={60} radius={18} width="min(100%, 430px)" />
            <SkeletonBlock height={32} width="min(72%, 300px)" />
          </div>
          <div className="home-skeleton__details">
            <section className="home-skeleton__summary-panel">
              <SkeletonBlock height={14} width="26%" />
              <SkeletonText rows={3} widths={["100%", "92%", "68%"]} />
            </section>
            <section className="home-skeleton__work-panel">
              <SkeletonBlock height={14} width="30%" />
              <div className="home-skeleton__entity">
                <SkeletonBlock height={48} radius="999px" width={48} />
                <div>
                  <SkeletonBlock height={22} width="72%" />
                  <SkeletonBlock height={16} width="52%" />
                  <SkeletonBlock height={14} width="42%" />
                </div>
              </div>
            </section>
            <div className="home-skeleton__academic-grid">
              {Array.from({ length: 2 }).map((_, index) => (
                <section className="home-skeleton__academic-panel" key={index}>
                  <SkeletonBlock height={14} width="42%" />
                  <div className="home-skeleton__entity">
                    <SkeletonBlock height={48} radius="999px" width={48} />
                    <div>
                      <SkeletonBlock height={20} width="86%" />
                      <SkeletonBlock height={14} width="68%" />
                      <SkeletonBlock height={14} width="54%" />
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <div className="home-skeleton__overview">
          <section className="home-skeleton__section home-skeleton__section--rows" data-skeleton-section="experience">
            <div className="home-skeleton__section-header">
              <SkeletonBlock height={28} width="26%" />
              <SkeletonBlock height={36} radius={12} width={58} />
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="home-skeleton__row" key={index}>
                <SkeletonBlock height={48} radius="999px" width={48} />
                <div>
                  <SkeletonBlock height={20} width="54%" />
                  <SkeletonBlock height={14} width="72%" />
                  <SkeletonBlock height={14} width="42%" />
                </div>
              </div>
            ))}
          </section>
          <HomeEducationSection />
          <HomeCardSection section="research" width="20%" />
          <HomeCardSection section="projects" width="22%" />
          <section className="home-skeleton__section home-skeleton__section--skills" data-skeleton-section="skills">
            <div className="home-skeleton__section-header">
              <SkeletonBlock height={28} width="18%" />
            </div>
            <div className="home-skeleton__skill-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <article className="home-skeleton__skill-group" key={index}>
                  <SkeletonBlock height={22} width="64%" />
                  <div className="home-skeleton__skill-chips">
                    {[0, 1, 2, 3].map((skillIndex) => (
                      <SkeletonBlock height={42} key={skillIndex} radius={12} />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section
            className="home-skeleton__section home-skeleton__section--cards"
            data-skeleton-section="recommendations"
          >
            <div className="home-skeleton__section-header">
              <SkeletonBlock height={28} width="28%" />
              <SkeletonBlock height={36} radius={12} width={58} />
            </div>
            <div className="home-skeleton__card-grid home-skeleton__card-grid--recommendations">
              {Array.from({ length: 3 }).map((_, index) => (
                <HomeCard key={index} recommendation />
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageSkeleton>
  );
}

function HomeEducationSection() {
  return (
    <section className="home-skeleton__section home-skeleton__section--education" data-skeleton-section="education">
      <div className="home-skeleton__section-header">
        <SkeletonBlock height={28} width="22%" />
      </div>
      <div className="home-skeleton__row">
        <SkeletonBlock height={48} radius="999px" width={48} />
        <div>
          <SkeletonBlock height={20} width="58%" />
          <SkeletonBlock height={14} width="76%" />
          <SkeletonBlock height={14} width="54%" />
          <SkeletonBlock height={14} width="44%" />
        </div>
      </div>
    </section>
  );
}

function HomeCardSection({ section, width }: { section: "projects" | "research"; width: string }) {
  return (
    <section
      className="home-skeleton__section home-skeleton__section--cards"
      data-skeleton-section={section}
    >
      <div className="home-skeleton__section-header">
        <SkeletonBlock height={28} width={width} />
        <SkeletonBlock height={36} radius={12} width={58} />
      </div>
      <div className="home-skeleton__card-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <HomeCard key={index} />
        ))}
      </div>
    </section>
  );
}

function HomeCard({ recommendation = false }: { recommendation?: boolean }) {
  return (
    <article className="home-skeleton__card">
      <SkeletonBlock height={22} width="76%" />
      <SkeletonBlock height={14} width="58%" />
      <SkeletonText rows={recommendation ? 4 : 3} widths={["100%", "92%", "78%", "64%"]} />
      <div className="home-skeleton__card-actions">
        <SkeletonBlock height={32} radius="999px" width={recommendation ? 116 : 92} />
        {recommendation ? <SkeletonBlock height={32} radius="999px" width={132} /> : null}
      </div>
    </article>
  );
}
