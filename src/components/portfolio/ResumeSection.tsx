import type { ReactNode } from "react";
import { GlassSurface } from "@/components/glass/GlassSurface";

export function ResumeSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <GlassSurface as="section" className="resume-section" variant="default">
      <h2 className="section-heading">{title}</h2>
      {children}
    </GlassSurface>
  );
}