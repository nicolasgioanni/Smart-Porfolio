import { HomePageSkeleton } from "@/components/loading/HomePageSkeleton";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return <HomePageSkeleton />;
}
