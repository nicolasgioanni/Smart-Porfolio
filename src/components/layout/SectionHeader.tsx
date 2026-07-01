import { GlassLink } from "@/components/glass/GlassLink";

type HeadingLevel = "h1" | "h2" | "h3";
type SectionHeaderVariant = "page" | "section" | "compact";

type SectionHeaderProps = {
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  description?: string;
  eyebrow?: string;
  headingLevel?: HeadingLevel;
  id?: string;
  title: string;
  variant?: SectionHeaderVariant;
};

export function SectionHeader({
  actionHref,
  actionLabel,
  className,
  description,
  eyebrow,
  headingLevel = "h2",
  id,
  title,
  variant = "section"
}: SectionHeaderProps) {
  const Heading = headingLevel;

  return (
    <header className={["section-header", `section-header--${variant}`, className].filter(Boolean).join(" ")}>
      <div className="section-header__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Heading className={variant === "page" ? "page-title" : "section-heading"} id={id}>
          {title}
        </Heading>
        {description ? <p className={variant === "page" ? "page-description" : "section-description"}>{description}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <div className="section-header__action">
          <GlassLink href={actionHref}>{actionLabel}</GlassLink>
        </div>
      ) : null}
    </header>
  );
}
