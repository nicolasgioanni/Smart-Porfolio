import { useMediaQuery } from "@/components/responsive/useMediaQuery";

export function useReducedMotionPreference(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
