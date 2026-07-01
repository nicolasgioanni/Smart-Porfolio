import { ResearchPageSkeleton } from "@/components/loading/ResearchPageSkeleton";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return <ResearchPageSkeleton />;
}
