import { ProjectsPageSkeleton } from "@/components/loading/ProjectsPageSkeleton";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return <ProjectsPageSkeleton />;
}
