import { RouteSkeleton } from "@/app/RouteSkeleton";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";
import { siteRoutes } from "@/lib/routing/siteRoutes";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return <RouteSkeleton pathname={siteRoutes.recommendations} />;
}
