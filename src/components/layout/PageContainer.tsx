import type { ReactNode } from "react";
import { ScrollReveal } from "@/components/motion/ScrollReveal";

type PageContainerProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  motionEnabled?: boolean;
};

export function PageContainer({ eyebrow, title, description, children, className, motionEnabled = true }: PageContainerProps) {
  return (
    <div className={["page-container", className].filter(Boolean).join(" ")}>
      <ScrollReveal as="header" className="page-container__header" enabled={motionEnabled}>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </ScrollReveal>
      {children}
    </div>
  );
}
