import type { PortfolioLink, ProfileContent } from "@/content/types";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";

type ProfileSummaryProps = {
  profile: ProfileContent;
  links: PortfolioLink[];
};

export function ProfileSummary({ profile, links }: ProfileSummaryProps) {
  return <PortfolioHero links={links} profile={profile} />;
}