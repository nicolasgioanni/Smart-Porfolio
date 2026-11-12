import { ShieldCheckIcon } from "@/components/icons/ShieldCheckIcon";
import { SmartLink } from "@/components/navigation/SmartLink";

type RecommendationVerificationLinkProps = {
  recommenderName: string;
  sourceUrl: string;
  variant: "summary" | "detail";
};

export function RecommendationVerificationLink({
  recommenderName,
  sourceUrl,
  variant
}: RecommendationVerificationLinkProps) {
  const label = variant === "summary" ? "Verified" : "Verified on LinkedIn";

  return (
    <SmartLink
      aria-label={`View ${recommenderName}'s verified recommendation on LinkedIn`}
      className={`recommendation-verification-link recommendation-verification-link--${variant}`}
      href={sourceUrl}
    >
      <ShieldCheckIcon className="recommendation-verification-link__icon" />
      <span className="recommendation-verification-link__text" data-label={label}>{label}</span>
    </SmartLink>
  );
}
