"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/components/motion/useReducedMotionPreference";

export type ResearchExplainerVariant = "aml" | "guide-donor";

type ResearchExplainerProps = {
  variant: ResearchExplainerVariant;
};

type ExplainerContent = {
  caption: string;
  description: string;
  label: string;
  legend?: readonly string[];
};

const explainerContent: Record<ResearchExplainerVariant, ExplainerContent> = {
  aml: {
    caption: "An illustrative experiment: train a detector using clean and manipulated digit images.",
    description:
      "An illustrative adversarial machine learning experiment. A clean handwritten seven and a manipulated copy feed a binary detector during training. The neutral question is whether an image is clean or manipulated; this diagram does not claim an accuracy, detection result, or restored class.",
    label: "Can AI spot an altered image?"
  },
  "guide-donor": {
    caption:
      "A design schematic: an intended change can be paired with an optional silent PAM or seed change to reduce recutting.",
    description:
      "A GuideDonorScheduler design schematic. A requested A to G change on target DNA informs a nearby guide site. A donor design carries the requested change and an optional silent PAM or seed change, then guide and donor values are exported as spreadsheet rows. This is a design diagram, not a biological edit.",
    label: "Design a DNA change",
    legend: ["Requested change", "Optional silent change"]
  }
};

type SceneProps = {
  descriptionId: string;
};

function SevenGlyph({ className, x, y }: { className?: string; x: number; y: number }) {
  return (
    <g aria-hidden="true" className={["research-explainer__seven", className].filter(Boolean).join(" ")}>
      <path className="research-explainer__seven-stroke" d={`M${x} ${y}h66l-40 68`} />
      <path className="research-explainer__seven-stroke research-explainer__seven-stroke--light" d={`M${x + 6} ${y + 10}h45`} />
    </g>
  );
}

function AmlScene({ descriptionId }: SceneProps) {
  return (
    <div className="research-explainer__scene research-explainer__scene--aml">
      <svg
        aria-describedby={descriptionId}
        aria-label="Illustrative binary detector training scene"
        className="research-explainer__diagram"
        role="img"
        viewBox="0 0 360 390"
      >
        <g className="research-explainer__phase research-explainer__phase--one">
          <rect className="research-explainer__aml-card research-explainer__aml-card--clean" height="92" rx="12" width="132" x="18" y="20" />
          <rect className="research-explainer__aml-card research-explainer__aml-card--altered" height="92" rx="12" width="132" x="210" y="20" />
          <SevenGlyph x={51} y={45} />
          <SevenGlyph x={243} y={45} />
          <g className="research-explainer__pixel-patches">
            <rect height="12" rx="2" width="12" x="274" y="70" />
            <rect height="12" rx="2" width="12" x="294" y="91" />
            <rect height="12" rx="2" width="12" x="257" y="97" />
          </g>
        </g>
        <path className="research-explainer__flow-path" d="M84 114C89 151 116 169 145 181" />
        <path className="research-explainer__flow-path" d="M276 114c-5 37-32 55-61 67" />
        <g className="research-explainer__phase research-explainer__phase--two">
          <circle className="research-explainer__data-token research-explainer__data-token--clean" cx="84" cy="114" r="8" />
          <circle className="research-explainer__data-token research-explainer__data-token--altered" cx="276" cy="114" r="8" />
          <circle className="research-explainer__training-node" cx="180" cy="181" r="12" />
        </g>
        <g className="research-explainer__detector research-explainer__phase research-explainer__phase--three">
          <circle className="research-explainer__detector-ring research-explainer__detector-ring--outer" cx="180" cy="250" r="86" />
          <circle className="research-explainer__detector-ring research-explainer__detector-ring--inner" cx="180" cy="250" r="67" />
          <circle className="research-explainer__detector-core" cx="180" cy="250" r="49" />
          <path className="research-explainer__detector-spoke" d="M180 187v16m0 94v16m-63-63h16m94 0h16m-108-45 12 8m66 44 12 8m0-90-12 8m-66 44-12 8" />
        </g>
        <path className="research-explainer__test-path" d="M52 342c45 0 62-12 84-39" />
        <g className="research-explainer__phase research-explainer__phase--four">
          <rect className="research-explainer__aml-card research-explainer__aml-card--test" height="50" rx="8" width="76" x="18" y="318" />
          <path className="research-explainer__mini-seven" d="M37 335h34l-20 27" />
          <circle className="research-explainer__test-token" cx="96" cy="342" r="8" />
          <path className="research-explainer__question-mark" d="M218 332c0-10 16-10 16 0 0 8-8 8-8 15m0 11h.1" />
        </g>
      </svg>
      <div aria-hidden="true" className="research-explainer__scene-labels">
        <span className="research-explainer__scene-label research-explainer__scene-label--clean">Clean image</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--altered">Altered copy</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--train">Train with both</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--detector">Binary<br />detector</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--test">Test image</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--question">Clean or manipulated?</span>
      </div>
    </div>
  );
}

const targetBases = ["C", "T", "A", "A", "C", "T", "G", "C", "T"];
const donorBases = ["C", "T", "A", "G", "C", "T", "G", "C", "C"];

function DnaRibbon({ donor = false, y }: { donor?: boolean; y: number }) {
  const bases = donor ? donorBases : targetBases;

  return (
    <g aria-hidden="true" className={donor ? "research-explainer__donor-ribbon" : "research-explainer__dna-ribbon"}>
      <path className="research-explainer__dna-strand" d={`M34 ${y + 22}c38-18 65 18 103 0s65 18 103 0 65 18 88 0`} />
      {bases.map((base, index) => {
        const x = 39 + index * 33;
        const requested = index === 3;
        const optional = donor && index === 8;
        return (
          <g className={requested ? "research-explainer__change-marker research-explainer__change-marker--requested" : optional ? "research-explainer__change-marker research-explainer__change-marker--optional" : "research-explainer__base"} key={`${donor ? "donor" : "target"}-${base}-${index}`}>
            <rect height="28" rx="6" width="25" x={x} y={y} />
            <text className="research-explainer__base-letter" x={x + 12.5} y={y + 19}>{base}</text>
          </g>
        );
      })}
    </g>
  );
}

function GuideDonorScene({ descriptionId }: SceneProps) {
  return (
    <div className="research-explainer__scene research-explainer__scene--guide-donor">
      <svg
        aria-describedby={descriptionId}
        aria-label="Guide and donor design scene"
        className="research-explainer__diagram"
        role="img"
        viewBox="0 0 360 390"
      >
        <g className="research-explainer__phase research-explainer__phase--one">
          <DnaRibbon y={53} />
          <path className="research-explainer__requested-arrow" d="M150 43v-18m-7 7 7-7 7 7" />
        </g>
        <g className="research-explainer__phase research-explainer__phase--two">
          <path className="research-explainer__guide-bracket" d="M139 99v14h46V99m-46 0v-9m46 9v-9" />
          <path className="research-explainer__guide-path" d="M300 136c-43 0-76-5-110-25" />
          <circle className="research-explainer__guide-token" cx="300" cy="136" r="8" />
        </g>
        <path className="research-explainer__donor-path" d="M162 118v62" />
        <g className="research-explainer__phase research-explainer__phase--three">
          <DnaRibbon donor y={186} />
          <circle className="research-explainer__donor-token" cx="162" cy="118" r="7" />
        </g>
        <g className="research-explainer__phase research-explainer__phase--four">
          <path className="research-explainer__export-path" d="M185 113c52 35 66 133-1 203" />
          <path className="research-explainer__export-path" d="M150 214c10 50 42 95 34 124" />
          <rect className="research-explainer__export-sheet" height="84" rx="8" width="146" x="151" y="278" />
          <path className="research-explainer__sheet-grid" d="M163 305h122M163 327h122M163 349h122M205 291v58" />
          <circle className="research-explainer__export-token research-explainer__export-token--guide" cx="185" cy="113" r="7" />
          <circle className="research-explainer__export-token research-explainer__export-token--donor" cx="150" cy="214" r="7" />
        </g>
      </svg>
      <div aria-hidden="true" className="research-explainer__scene-labels">
        <span className="research-explainer__scene-label research-explainer__scene-label--target">Target DNA</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--requested">A → G</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--guide">Guide site</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--donor">Donor design</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--export">Export designs</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--guide-row">Guide</span>
        <span className="research-explainer__scene-label research-explainer__scene-label--donor-row">Donor</span>
      </div>
    </div>
  );
}

/** Server rendering keeps each connected instrument scene complete. */
export function ResearchExplainer({ variant }: ResearchExplainerProps) {
  const content = explainerContent[variant];
  const prefersReducedMotion = useReducedMotionPreference();
  const viewportRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const [hasEnhanced, setHasEnhanced] = useState(false);
  const [supportsPlayback, setSupportsPlayback] = useState(false);
  const [timelineReady, setTimelineReady] = useState(false);
  const [viewportVisible, setViewportVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [retainStaticControl, setRetainStaticControl] = useState(false);
  const componentId = useId().replaceAll(":", "");
  const descriptionId = `research-explainer-${componentId}-description`;

  useEffect(() => {
    if (prefersReducedMotion || typeof window.IntersectionObserver !== "function") {
      setSupportsPlayback(false);
      setTimelineReady(false);
      setViewportVisible(false);
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setSupportsPlayback(false);
      setTimelineReady(false);
      setViewportVisible(false);
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setTimelineReady(true);
        setViewportVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.25));
      },
      { threshold: [0, 0.25] }
    );

    setHasEnhanced(true);
    setSupportsPlayback(true);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  useEffect(() => {
    const updateDocumentVisibility = () => setDocumentVisible(!document.hidden);

    updateDocumentVisibility();
    document.addEventListener("visibilitychange", updateDocumentVisibility);
    return () => document.removeEventListener("visibilitychange", updateDocumentVisibility);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion && document.activeElement === controlRef.current) setRetainStaticControl(true);
  }, [prefersReducedMotion]);

  const playback = !supportsPlayback || prefersReducedMotion
    ? "complete"
    : userPaused
      ? "paused"
      : viewportVisible && documentVisible
        ? "playing"
        : "waiting";
  const Scene = variant === "aml" ? AmlScene : GuideDonorScene;
  const controlDisabled = !supportsPlayback || prefersReducedMotion;
  const loopLabel = controlDisabled ? "Workflow overview" : "12s loop";
  const controlLabel = controlDisabled
    ? `${content.label} is static because reduced motion is enabled`
    : userPaused
      ? `Resume ${content.label} animation`
      : `Pause ${content.label} animation`;
  const controlKeepsFocus = typeof document !== "undefined" && document.activeElement === controlRef.current;
  const shouldRenderControl = hasEnhanced && (!controlDisabled || retainStaticControl || controlKeepsFocus);

  return (
    <figure
      className="research-explainer"
      data-animation-ready={timelineReady}
      data-playback={playback}
      data-research-explainer={variant}
    >
      <p className="research-media-title research-explainer__title">{content.label}</p>
      <div className="research-explainer__viewport" ref={viewportRef} tabIndex={-1}>
        <Scene descriptionId={descriptionId} />
      </div>
      <div className="research-explainer__footer">
        <span className="research-explainer__loop">{loopLabel}</span>
        <div className="research-explainer__control-slot">
          {shouldRenderControl ? (
            <button
              aria-disabled={controlDisabled}
              aria-label={controlLabel}
              className="research-explainer__playback-control hover-base-1 hover-base-1--compact"
              onClick={() => {
                if (!controlDisabled) setUserPaused((paused) => !paused);
              }}
              onBlur={() => {
                setRetainStaticControl(false);
              }}
              ref={controlRef}
              title={controlLabel}
              type="button"
            >
              <span aria-hidden="true">{userPaused || controlDisabled ? "▶" : "Ⅱ"}</span>
            </button>
          ) : null}
        </div>
      </div>
      {content.legend ? (
        <ul aria-label="Guide and donor marker key" className="research-explainer__legend">
          {content.legend.map((label, index) => (
            <li key={label}>
              <span aria-hidden="true" className={`research-explainer__key-swatch research-explainer__key-swatch--${index === 0 ? "requested" : "optional"}`} />
              {label}
            </li>
          ))}
        </ul>
      ) : null}
      <figcaption className="research-explainer__caption">{content.caption}</figcaption>
      <p className="visually-hidden" id={descriptionId}>{content.description}</p>
    </figure>
  );
}
