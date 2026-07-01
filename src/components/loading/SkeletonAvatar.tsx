import { SkeletonBlock } from "@/components/loading/SkeletonBlock";

type SkeletonAvatarProps = {
  size?: number;
};

export function SkeletonAvatar({ size = 84 }: SkeletonAvatarProps) {
  return <SkeletonBlock className="skeleton-avatar" height={size} radius="999px" width={size} />;
}
