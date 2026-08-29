import { RouteSkeleton } from "@/components/loading/RouteSkeleton";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";
import { siteRoutes } from "@/components/navigation/siteRoutes";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return <RouteSkeleton pathname={siteRoutes.research} />;
}
