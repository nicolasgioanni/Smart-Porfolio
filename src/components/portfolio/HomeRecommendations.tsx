import type { RecommendationItem } from "@/content/types";
import { GlassButton } from "@/components/glass/GlassButton";
import { RecommendationCard } from "@/components/portfolio/RecommendationCard";

export function HomeRecommendations({ items, showAction = true }: { items: RecommendationItem[]; showAction?: boolean }) {
  if (items.length === 0) return null;

  return (
    <div className="home-recommendations">
      <div className="home-recommendations__grid">
        {items.map((item) => (
          <RecommendationCard item={item} key={item.id} variant="summary" />
        ))}
      </div>
      {showAction ? (
        <div className="home-recommendations__actions">
          <GlassButton href="/recommendations" variant="secondary">
            See all recommendations
          </GlassButton>
        </div>
      ) : null}
    </div>
  );
}
