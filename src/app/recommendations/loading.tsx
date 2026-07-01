import { RecommendationsPageSkeleton } from "@/components/loading/RecommendationsPageSkeleton";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return <RecommendationsPageSkeleton />;
}
