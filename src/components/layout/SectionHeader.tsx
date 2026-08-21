import { GlassButton } from "@/components/glass/GlassButton";
import { GlassLink } from "@/components/glass/GlassLink";

type HeadingLevel = "h1" | "h2" | "h3";
type SectionHeaderVariant = "page" | "section" | "compact";
type SectionHeaderActionVariant = "link" | "button";

type SectionHeaderProps = {
  actionAriaLabel?: string;
  actionHref?: string;
  actionLabel?: string;
  actionVariant?: SectionHeaderActionVariant;
  className?: string;
  description?: string;
  eyebrow?: string;
  headingLevel?: HeadingLevel;
  id?: string;
  title: string;
  variant?: SectionHeaderVariant;
};

export function SectionHeader({
  actionAriaLabel,
  actionHref,
  actionLabel,
  actionVariant = "link",
  className,
  description,
  eyebrow,
  headingLevel = "h2",
  id,
  title,
  variant = "section"
}: SectionHeaderProps) {
  const Heading = headingLevel;
  const actionClassName = actionHref && actionLabel ? `section-header--${actionVariant}-action` : undefined;

  return (
    <header className={["section-header", `section-header--${variant}`, actionClassName, className].filter(Boolean).join(" ")}>
      <div className="section-header__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Heading className={variant === "page" ? "page-title" : "section-heading"} id={id}>
          {title}
        </Heading>
        {description ? <p className={variant === "page" ? "page-description" : "section-description"}>{description}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <div className={["section-header__action", `section-header__action--${actionVariant}`].join(" ")}>
          {actionVariant === "button" ? (
            <GlassButton aria-label={actionAriaLabel} className="section-header__action-button" href={actionHref} variant="secondary">
              {actionLabel}
            </GlassButton>
          ) : (
            <GlassLink aria-label={actionAriaLabel} href={actionHref}>
              {actionLabel}
            </GlassLink>
          )}
        </div>
      ) : null}
    </header>
  );
}
