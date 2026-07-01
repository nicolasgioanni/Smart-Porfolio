import { ExperiencePageSkeleton } from "@/components/loading/ExperiencePageSkeleton";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return <ExperiencePageSkeleton />;
}
