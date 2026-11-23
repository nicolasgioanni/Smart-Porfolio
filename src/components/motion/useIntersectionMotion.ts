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
  const [ready, setReady] = useState(false);
  const prefersReducedMotion = useReducedMotionPreference();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!enabled || prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      hasRevealedRef.current = true;
      setVisible(true);
      setReady(false);
      return;
    }

    setReady(true);
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
    ready,
    visible,
    prefersReducedMotion
  };
}
