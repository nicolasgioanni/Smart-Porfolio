import type { PortfolioLink, ProfileContent, ProfileOverviewContent } from "@/content/types";
import { PortfolioHero } from "@/components/portfolio/home/PortfolioHero";

type ProfileSummaryProps = {
  profile: ProfileContent;
  links: PortfolioLink[];
  overview: ProfileOverviewContent;
};

export function ProfileSummary({ profile, links, overview }: ProfileSummaryProps) {
  return <PortfolioHero links={links} overview={overview} profile={profile} />;
}
