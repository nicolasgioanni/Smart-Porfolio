import { ResumePageSkeleton } from "@/components/loading/ResumePageSkeleton";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return <ResumePageSkeleton />;
}
