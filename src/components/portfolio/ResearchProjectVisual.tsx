import type { ReactNode } from "react";

type ResearchProjectVisualProps = {
  itemId: string;
  order: number;
};

type VisualDefinition = {
  caption: string;
  code: string;
  label: string;
  status: string;
  visual: () => ReactNode;
};

function CytoCvVisual() {
  return (
    <svg aria-label="Multichannel yeast segmentation diagram" className="research-visual__svg" role="img" viewBox="0 0 480 340">
      <defs>
        <pattern height="24" id="cytocv-grid" patternUnits="userSpaceOnUse" width="24">
          <path className="research-visual__grid-line" d="M24 0H0V24" fill="none" />
        </pattern>
        <clipPath id="cytocv-lens">
          <circle cx="235" cy="164" r="118" />
        </clipPath>
      </defs>
      <rect className="research-visual__grid" fill="url(#cytocv-grid)" height="340" width="480" />
      <circle className="research-visual__orbit" cx="235" cy="164" r="132" />
      <circle className="research-visual__lens" cx="235" cy="164" r="118" />
      <g clipPath="url(#cytocv-lens)">
        <path className="research-visual__cell research-visual__cell--primary" d="M126 183C120 128 153 88 204 84c54-4 91 30 92 80 1 55-34 91-85 96-51 6-79-23-85-77Z" />
        <path className="research-visual__cell research-visual__cell--secondary" d="M280 117c37-25 82-9 91 27 9 39-21 70-58 66-29-3-44-24-37-53 4-16 1-25 4-40Z" />
        <path className="research-visual__mask research-visual__mask--blue" d="M146 177c-3-39 21-68 59-72 39-4 67 18 70 55 4 39-20 68-58 74-38 6-68-18-71-57Z" />
        <path className="research-visual__mask research-visual__mask--green" d="M294 127c26-15 54-3 59 22 5 26-14 45-39 42-20-2-30-17-25-37 3-10 2-16 5-27Z" />
        <path className="research-visual__nucleus" d="M176 141c21-20 59-15 70 9 10 23-9 49-37 50-29 1-51-35-33-59Z" />
        <path className="research-visual__axis" d="m203 164 112-9" />
        <circle className="research-visual__puncta research-visual__puncta--red" cx="203" cy="164" r="6" />
        <circle className="research-visual__puncta research-visual__puncta--red" cx="315" cy="155" r="6" />
        <circle className="research-visual__puncta research-visual__puncta--green" cx="226" cy="154" r="4" />
        <circle className="research-visual__puncta research-visual__puncta--green" cx="289" cy="159" r="4" />
      </g>
      <path className="research-visual__measure" d="M203 286v14m112-14v14M203 293h112" />
      <circle className="research-visual__node" cx="203" cy="293" r="3" />
      <circle className="research-visual__node" cx="315" cy="293" r="3" />
      <g className="research-visual__channel-bank">
        <path d="M30 70h38" />
        <path d="M30 86h56" />
        <path d="M30 102h30" />
        <circle cx="22" cy="70" r="3" />
        <circle cx="22" cy="86" r="3" />
        <circle cx="22" cy="102" r="3" />
      </g>
    </svg>
  );
}

function AmlVisual() {
  const attacks = ["EVA", "EXT", "INV", "BDR"];
  const defenses = ["DET", "JPEG", "NOISE", "DISTILL"];
  const rowY = [64, 112, 160, 208];
  const datasets = [
    { label: "MNIST", width: 76, x: 98 },
    { label: "F-MNIST", width: 88, x: 190 },
    { label: "CIFAR-10", width: 88, x: 294 }
  ];

  return (
    <svg aria-label="Eight-prototype adversarial attack and defense matrix" className="research-visual__svg" role="img" viewBox="0 0 480 340">
      <defs>
        <pattern height="24" id="aml-grid" patternUnits="userSpaceOnUse" width="24">
          <path className="research-visual__grid-line" d="M24 0H0V24" fill="none" />
        </pattern>
        <marker id="aml-arrow" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
          <path d="M0 0l6 3-6 3Z" fill="context-stroke" />
        </marker>
      </defs>
      <rect className="research-visual__grid" fill="url(#aml-grid)" height="340" width="480" />
      <text className="research-visual__aml-rail-title" x="96" y="42">ATTACKS</text>
      <text className="research-visual__aml-rail-title" x="384" y="42">DEFENSES</text>
      <g className="research-visual__aml-links research-visual__aml-links--attack">
        {rowY.map((y) => <path d={`M146 ${y + 16}C178 ${y + 16} 180 151 196 151`} key={`attack-${y}`} markerEnd="url(#aml-arrow)" />)}
      </g>
      <g className="research-visual__aml-links research-visual__aml-links--defense">
        {rowY.map((y) => <path d={`M284 151C300 151 302 ${y + 16} 334 ${y + 16}`} key={`defense-${y}`} markerEnd="url(#aml-arrow)" />)}
      </g>
      {attacks.map((label, index) => (
        <g className="research-visual__aml-node research-visual__aml-node--attack" key={label}>
          <rect height="32" rx="7" width="100" x="46" y={rowY[index]} />
          <circle cx="62" cy={rowY[index]! + 16} r="4" />
          <text x="98" y={rowY[index]! + 20}>{label}</text>
          {label === "BDR" ? (
            <g className="research-visual__backdoor-trigger">
              <rect height="3" width="3" x="130" y={rowY[index]! + 20} />
              <rect height="3" width="3" x="134" y={rowY[index]! + 20} />
              <rect height="3" width="3" x="134" y={rowY[index]! + 24} />
            </g>
          ) : null}
        </g>
      ))}
      {defenses.map((label, index) => (
        <g className="research-visual__aml-node research-visual__aml-node--defense" key={label}>
          <rect height="32" rx="7" width="100" x="334" y={rowY[index]} />
          <circle cx="350" cy={rowY[index]! + 16} r="4" />
          <text x="388" y={rowY[index]! + 20}>{label}</text>
        </g>
      ))}
      <g className="research-visual__aml-core">
        <circle cx="240" cy="151" r="49" />
        <circle cx="240" cy="151" r="35" />
        <text x="240" y="150">MODEL</text>
        <text x="240" y="165">8 PROTOTYPES</text>
      </g>
      {datasets.map(({ label, width, x }) => (
        <g className="research-visual__aml-dataset" key={label}>
          <rect height="25" rx="12.5" width={width} x={x} y="282" />
          <text x={x + width / 2} y="298">{label}</text>
        </g>
      ))}
    </svg>
  );
}

function GuideDonorVisual() {
  const rungs = [72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312, 336, 360, 384, 408];

  return (
    <svg aria-label="Guide and donor sequence design diagram" className="research-visual__svg" role="img" viewBox="0 0 480 340">
      <defs>
        <pattern height="24" id="guide-grid" patternUnits="userSpaceOnUse" width="24">
          <path className="research-visual__grid-line" d="M24 0H0V24" fill="none" />
        </pattern>
      </defs>
      <rect className="research-visual__grid" fill="url(#guide-grid)" height="340" width="480" />
      <path className="research-visual__dna research-visual__dna--top" d="M49 102c58-62 116 62 174 0s116 62 174 0c14-15 27-20 35-19" />
      <path className="research-visual__dna research-visual__dna--bottom" d="M49 154c58 62 116-62 174 0s116-62 174 0c14 15 27 20 35 19" />
      <g className="research-visual__rungs">
        {rungs.map((x, index) => {
          const y1 = 128 + Math.sin(index * 0.92) * 26;
          const y2 = 128 - Math.sin(index * 0.92) * 26;
          return <path d={`M${x} ${y1.toFixed(1)}V${y2.toFixed(1)}`} key={x} />;
        })}
      </g>
      <rect className="research-visual__guide-window" height="82" rx="8" width="82" x="204" y="87" />
      <path className="research-visual__cut" d="M244 72v112m-9-8 9 9 9-9" />
      <path className="research-visual__flow" d="M244 188v31m-7-8 7 8 7-8" />
      <g className="research-visual__donor">
        <rect height="44" rx="8" width="352" x="64" y="230" />
        <path d="M83 252h108m96 0h108" />
        <rect height="28" rx="4" width="96" x="191" y="238" />
        <path d="m227 246 12 12 24-24" />
      </g>
      <g className="research-visual__export">
        <path d="M330 296h86m-86 12h62m-62 12h74" />
        <circle cx="316" cy="296" r="3" />
        <circle cx="316" cy="308" r="3" />
        <circle cx="316" cy="320" r="3" />
      </g>
      <path className="research-visual__coordinate" d="M64 294h196m-196-5v10m196-10v10" />
    </svg>
  );
}

function FallbackVisual() {
  return (
    <svg aria-label="Research system diagram" className="research-visual__svg" role="img" viewBox="0 0 480 340">
      <path className="research-visual__orbit" d="M102 170c0-75 62-136 138-136s138 61 138 136-62 136-138 136-138-61-138-136Z" />
      <path className="research-visual__boundary" d="M80 254 400 86" />
      <circle className="research-visual__node" cx="150" cy="217" r="8" />
      <circle className="research-visual__node" cx="240" cy="170" r="8" />
      <circle className="research-visual__node" cx="330" cy="123" r="8" />
    </svg>
  );
}

const visualDefinitions: Record<string, VisualDefinition> = {
  "cytocv-miller-lab": {
    caption: "Segmentation · fluorescence · review",
    code: "CV",
    label: "Bioimage analysis",
    status: "Multichannel",
    visual: CytoCvVisual
  },
  "adversarial-machine-learning": {
    caption: "Attack · defend · evaluate",
    code: "AML",
    label: "Model robustness",
    status: "8 prototypes",
    visual: AmlVisual
  },
  "yeast-dna-target-selection": {
    caption: "Guide · donor · validate",
    code: "GDS",
    label: "Sequence design",
    status: "Strand-aware",
    visual: GuideDonorVisual
  }
};

const fallbackDefinition: VisualDefinition = {
  caption: "Observe · test · learn",
  code: "R&D",
  label: "Research system",
  status: "Active",
  visual: FallbackVisual
};

export function ResearchProjectVisual({ itemId, order }: ResearchProjectVisualProps) {
  const definition = visualDefinitions[itemId] ?? fallbackDefinition;
  const Visual = definition.visual;

  return (
    <figure className="research-visual">
      <div className="research-visual__header">
        <span>R&amp;D / {String(order + 1).padStart(2, "0")}</span>
        <span className="research-visual__status">
          <span aria-hidden="true" className="research-visual__status-dot" />
          {definition.status}
        </span>
      </div>
      <div className="research-visual__canvas">
        <Visual />
      </div>
      <figcaption className="research-visual__caption">
        <span aria-hidden="true" className="research-visual__monogram">
          {definition.code}
        </span>
        <span>
          <strong>{definition.label}</strong>
          {definition.caption}
        </span>
      </figcaption>
    </figure>
  );
}
