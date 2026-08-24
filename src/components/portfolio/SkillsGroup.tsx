import type { SkillGroup } from "@/content/types";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { PortfolioSkillShowcase } from "@/components/portfolio/PortfolioSkillShowcase";

function formatCategory(category: string): string {
  return category
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function SkillsGroup({ compact = false, group }: { compact?: boolean; group: SkillGroup }) {
  return (
    <PortfolioCard
      as="section"
      className={["skills-group", compact ? "skills-group--compact" : null].filter(Boolean).join(" ")}
      variant="summary"
    >
      <h3 className="skills-group__title">{formatCategory(group.category)}</h3>
      <PortfolioSkillShowcase category={formatCategory(group.category)} skills={group.skills} />
    </PortfolioCard>
  );
}
