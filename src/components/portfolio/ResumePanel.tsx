import type { ReactNode } from "react";
import { GlassSurface } from "@/components/glass/GlassSurface";

export function ResumePanel({ children }: { children: ReactNode }) {
  return <GlassSurface className="resume-panel" variant="strong">{children}</GlassSurface>;
}