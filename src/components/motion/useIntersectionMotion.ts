"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";

type IntersectionMotionOptions = {
  enabled?: boolean;
  rootMargin?: string;
  threshold?: number;
};

export function useIntersectionMotion<TElement extends HTMLElement>({
  enabled = true,
  rootMargin = "0px 0px -12% 0px",
  threshold = 0.14
}: IntersectionMotionOptions = {}) {
  const ref = useRef<TElement | null>(null);
  const hasRevealedRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion = useReducedMotionPreference();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!enabled || prefersReducedMotion) {
      hasRevealedRef.current = true;
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (hasRevealedRef.current) return;

        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          hasRevealedRef.current = true;
          setVisible(true);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [enabled, prefersReducedMotion, rootMargin, threshold]);

  return {
    ref,
    visible,
    prefersReducedMotion
  };
}
