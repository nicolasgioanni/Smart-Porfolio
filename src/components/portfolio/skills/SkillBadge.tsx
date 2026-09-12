import { SkillIcon } from "@/components/icons/SkillIcon";

type SkillBadgeProps = {
  name: string;
  icon?: string;
};

export function SkillBadge({ icon, name }: SkillBadgeProps) {
  return (
    <span className="skill-badge">
      {icon ? <SkillIcon icon={icon} /> : null}
      <span className="skill-badge__label">{name}</span>
    </span>
  );
}
