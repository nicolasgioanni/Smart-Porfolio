import { SkeletonBlock } from "@/components/loading/SkeletonBlock";

type SkeletonButtonProps = {
  width?: number | string;
};

export function SkeletonButton({ width = 136 }: SkeletonButtonProps) {
  return <SkeletonBlock className="skeleton-button" height={42} radius="999px" width={width} />;
}
