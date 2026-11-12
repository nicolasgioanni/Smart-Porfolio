"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";

type HomeEducationDetailsProps = {
  bullets: string[];
  institution: string;
};

type AnimationGroup = {
  animations: Animation[];
  generation: number;
};

function durationInMilliseconds(value: string, fallback: number): number {
  const duration = Number.parseFloat(value);

  if (!Number.isFinite(duration)) return fallback;
  return value.trim().endsWith("ms") ? duration : duration * 1000;
}

export function HomeEducationDetails({ bullets, institution }: HomeEducationDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationGroup | null>(null);
  const animationGenerationRef = useRef(0);
  const expandedRef = useRef(expanded);
  const previousExpandedRef = useRef(expanded);
  const resizeFrameRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotionPreference();

  expandedRef.current = expanded;

  const clearAnimationStyles = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    content.style.removeProperty("height");
    content.style.removeProperty("opacity");
    content.style.removeProperty("overflow");
  }, []);

  const cancelAnimation = useCallback(() => {
    animationRef.current?.animations.forEach((animation) => animation.cancel());
    animationRef.current = null;
  }, []);

  const finishAnimation = useCallback((animations: Animation[]) => {
    animations.forEach((animation) => animation.cancel());
  }, []);

  const settleImmediately = useCallback(
    (open: boolean) => {
      cancelAnimation();
      clearAnimationStyles();
      setIsOpen(open);
      setExpanded(open);
    },
    [cancelAnimation, clearAnimationStyles]
  );

  const animateDisclosure = useCallback(
    (open: boolean) => {
      const details = detailsRef.current;
      const content = contentRef.current;

      if (!details || !content || typeof content.animate !== "function" || document.visibilityState !== "visible") {
        settleImmediately(open);
        return;
      }

      const currentGroup = animationRef.current;
      const currentHeight = currentGroup ? content.getBoundingClientRect().height : open ? 0 : content.getBoundingClientRect().height;
      const opacity = Number.parseFloat(window.getComputedStyle(content).opacity);
      const currentOpacity = currentGroup && Number.isFinite(opacity) ? opacity : open ? 0 : 1;

      cancelAnimation();

      const targetHeight = open ? measurementRef.current?.getBoundingClientRect().height ?? 0 : 0;
      if (currentHeight === targetHeight && currentOpacity === (open ? 1 : 0)) {
        clearAnimationStyles();
        if (!open) setIsOpen(false);
        return;
      }

      content.style.height = `${currentHeight}px`;
      content.style.opacity = `${currentOpacity}`;
      content.style.overflow = "hidden";

      const styles = window.getComputedStyle(details);
      const animations: Animation[] = [];

      try {
        animations.push(
          content.animate(
            { height: [`${currentHeight}px`, `${targetHeight}px`] },
            {
              duration: durationInMilliseconds(styles.getPropertyValue("--disclosure-height-duration"), 520),
              easing: styles.getPropertyValue("--disclosure-easing").trim() || "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "forwards"
            }
          )
        );
        animations.push(
          content.animate(
            { opacity: [currentOpacity, open ? 1 : 0] },
            {
              duration: durationInMilliseconds(styles.getPropertyValue("--disclosure-opacity-duration"), 320),
              easing: styles.getPropertyValue("--disclosure-easing").trim() || "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "forwards"
            }
          )
        );
      } catch {
        finishAnimation(animations);
        settleImmediately(open);
        return;
      }

      const generation = ++animationGenerationRef.current;
      const nextGroup = { animations, generation };

      animationRef.current = nextGroup;
      void Promise.allSettled(nextGroup.animations.map((animation) => animation.finished)).then(() => {
        if (animationRef.current?.generation !== generation || expandedRef.current !== open) return;

        finishAnimation(nextGroup.animations);
        animationRef.current = null;
        clearAnimationStyles();
        if (!open) setIsOpen(false);
      });
    },
    [cancelAnimation, clearAnimationStyles, finishAnimation, settleImmediately]
  );

  useLayoutEffect(() => {
    if (!enhanced) return;
    if (previousExpandedRef.current === expanded) return;

    previousExpandedRef.current = expanded;
    if (prefersReducedMotion) {
      settleImmediately(expanded);
      return;
    }

    animateDisclosure(expanded);
  }, [animateDisclosure, enhanced, expanded, prefersReducedMotion, settleImmediately]);

  useEffect(() => {
    const open = detailsRef.current?.open ?? false;

    previousExpandedRef.current = open;
    expandedRef.current = open;
    setIsOpen(open);
    setExpanded(open);
    setEnhanced(true);
  }, []);

  useEffect(() => {
    if (!prefersReducedMotion || !animationRef.current) return;
    settleImmediately(expandedRef.current);
  }, [prefersReducedMotion, settleImmediately]);

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (!animationRef.current || resizeFrameRef.current !== null) return;

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        if (animationRef.current) animateDisclosure(expandedRef.current);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeFrameRef.current !== null) window.cancelAnimationFrame(resizeFrameRef.current);
    };
  }, [animateDisclosure, isOpen]);

  useEffect(
    () => () => {
      cancelAnimation();
      if (resizeFrameRef.current !== null) window.cancelAnimationFrame(resizeFrameRef.current);
    },
    [cancelAnimation]
  );

  const onSummaryClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!enhanced) return;

    const open = !expandedRef.current;
    const content = contentRef.current;
    const reducedMotion =
      prefersReducedMotion ||
      (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const canAnimate =
      !reducedMotion &&
      document.visibilityState === "visible" &&
      Boolean(content && typeof content.animate === "function");

    event.preventDefault();
    if (!canAnimate) {
      settleImmediately(open);
      return;
    }

    setExpanded(open);
    if (open) setIsOpen(true);
  };

  return (
    <details
      className="home-education-item__disclosure"
      data-enhanced={enhanced ? "true" : undefined}
      data-expanded={enhanced ? expanded : undefined}
      open={enhanced ? isOpen : undefined}
      ref={detailsRef}
    >
      <summary
        aria-expanded={enhanced ? expanded : undefined}
        className="home-education-item__disclosure-summary hover-base-1 hover-base-1--compact hover-base-1--inline"
        onClick={onSummaryClick}
      >
        <span className="home-education-item__disclosure-label-more">Show more</span>
        <span className="home-education-item__disclosure-label-less">Show less</span>
      </summary>
      <div
        aria-hidden={enhanced && !expanded ? true : undefined}
        className="home-education-item__disclosure-content"
        inert={enhanced && !expanded ? true : undefined}
        ref={contentRef}
      >
        <div className="home-education-item__disclosure-measure" ref={measurementRef}>
          <ul aria-label={`${institution} education details`} className="home-education-item__details">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
