import type { ResearchItem } from "@/content/types";
import {
  DETAILS_UNAVAILABLE,
  type DetailMode,
  type DetailModeContent,
  type DetailNarrative
} from "@/lib/content/detailNarratives";
import { getSummary } from "@/lib/content/displayHelpers";

const researchNarratives: Record<string, DetailNarrative> = {
  "cytocv-miller-lab": {
    overview: {
      summary:
        "CytoCV is an open-source platform that turns yeast microscopy stacks into reviewable per-cell fluorescence measurements and structured exports.",
      sections: [
        {
          id: "ownership",
          title: "Research collaboration",
          lead: "Led architecture, implementation, deployment, and maintenance with SEE Lab and Miller Lab collaborators.",
          details: [
            "Translated biology-facing requirements into a repeatable workflow for microscopy analysis.",
            "Coordinated the platform work across research, software, and deployment needs."
          ],
          signal: "Lead engineer"
        },
        {
          id: "analysis",
          title: "Bioimage analysis",
          lead: "Engineered cell segmentation and configurable fluorescence analysis for multichannel yeast microscopy.",
          details: [
            "The workflow uses DIC images to identify cells and aligns fluorescence channels for per-cell measurements.",
            "Selectable overlays let researchers review analysis results before export."
          ],
          signal: "Mask R-CNN"
        },
        {
          id: "workflow",
          title: "Research workflow",
          lead: "Delivered authenticated review, background processing, persistent results, and CSV or XLSX exports.",
          details: [
            "Researchers can upload DeltaVision or TIFF image stacks, monitor analysis, inspect overlays, and download structured data.",
            "Protected artifacts and retention controls support repeatable shared-lab use."
          ],
          signal: "End to end"
        },
        {
          id: "release",
          title: "Open research software",
          lead: "Released CytoCV v2.0.0 as a citable software artifact while continuing manuscript preparation.",
          details: [
            "The public release includes citation metadata, reproducibility documentation, and a versioned software DOI.",
            "The journal manuscript is still in preparation and is shown as forthcoming."
          ],
          signal: "Citable v2.0.0"
        }
      ]
    },
    technical: {
      summary:
        "Architected a Django system with DIC-guided Mask R-CNN inference, worker-backed analysis, PostgreSQL persistence, and production Linux delivery.",
      sections: [
        {
          id: "ingestion",
          title: "Microscopy ingestion",
          lead: "Built channel-aware DeltaVision and TIFF ingestion with metadata mapping, validation, and previews.",
          details: [
            "Mapped DIC and fluorescence channels into a consistent analysis model and rejected unsupported uploads early.",
            "Generated review-ready previews while preserving the original research artifacts."
          ],
          tools: ["Python", "Django", "tifffile", "NumPy"]
        },
        {
          id: "segmentation",
          title: "Vision pipeline",
          lead: "Engineered DIC-guided Mask R-CNN inference and postprocessing for cells and mother-daughter pairs.",
          details: [
            "Applied contour, geometry, and mask postprocessing to turn instance predictions into reviewable biological objects.",
            "Computed puncta distance, CEN-dot localization, biorientation, contour intensity, and nuclear or cell-pair intensity."
          ],
          signal: "Multichannel CV",
          tools: ["TensorFlow", "Keras", "Mask R-CNN", "OpenCV", "scikit-image"]
        },
        {
          id: "platform",
          title: "Research platform",
          lead: "Designed background jobs, progress and cancellation flows, protected artifacts, and durable result storage.",
          details: [
            "Django JSON endpoints connect the browser interface to deterministic analysis jobs.",
            "Authentication, retention controls, and PostgreSQL persistence support shared research workflows."
          ],
          tools: ["JavaScript", "PostgreSQL", "pandas", "openpyxl"]
        },
        {
          id: "delivery",
          title: "Production and release",
          lead: "Led Linux deployment, regression testing, technical documentation, and the citable v2.0.0 release.",
          details: [
            "Operated the production stack with Gunicorn, Nginx, systemd, and automated delivery.",
            "Maintained methods, reproducibility, and figure documentation alongside the deployed application."
          ],
          signal: "Production R&D",
          tools: ["Linux", "Gunicorn", "Nginx", "GitHub Actions", "Docker"]
        }
      ]
    }
  },
  "adversarial-machine-learning": {
    overview: {
      summary:
        "An independent study in adversarial machine learning that prototyped four attack families and four defensive strategies across standard image-classification benchmarks.",
      sections: [
        {
          id: "scope",
          title: "Study scope",
          lead: "Built eight focused prototypes spanning adversarial attacks and defensive techniques.",
          details: [
            "The study covered evasion, model extraction, model inversion, and backdoor poisoning.",
            "Defenses included adversarial-input detection, input preprocessing, output perturbation, and defensive distillation."
          ],
          signal: "4 attacks · 4 defenses"
        },
        {
          id: "benchmarks",
          title: "Model benchmarks",
          lead: "Ran experiments across MNIST, Fashion-MNIST, and CIFAR-10 image-classification tasks.",
          details: [
            "Each prototype isolates one threat or mitigation so its behavior can be inspected independently.",
            "The benchmark set supports comparison across grayscale and color-image models."
          ],
          signal: "3 datasets"
        },
        {
          id: "evaluation",
          title: "Evaluation",
          lead: "Measured attack success alongside clean, attacked, and defended model accuracy.",
          details: [
            "Captured experiment metrics and visual outputs to compare the effect of each attack or defense.",
            "Kept clean performance visible when assessing whether a mitigation helped."
          ],
          signal: "Comparative testing"
        }
      ]
    },
    technical: {
      summary:
        "Integrated ART primitives with TensorFlow and Keras models to test DeepFool, extraction, inversion, poisoning, detection, preprocessing, postprocessing, and distillation workflows.",
      sections: [
        {
          id: "evasion-extraction",
          title: "Evasion and extraction",
          lead: "Generated DeepFool adversarial examples and built a Copycat CNN model-extraction experiment.",
          details: [
            "Tested DeepFool against a Fashion-MNIST classifier and compared predictions before and after perturbation.",
            "Trained a substitute classifier from queried outputs in the extraction workflow."
          ],
          tools: ["ART", "TensorFlow/Keras", "Fashion-MNIST"]
        },
        {
          id: "inversion-poisoning",
          title: "Inversion and poisoning",
          lead: "Built MIFace model-inversion and corner-trigger backdoor-poisoning experiments.",
          details: [
            "Reconstructed representative inputs through model inversion.",
            "Injected a visual trigger into training samples and measured its targeted effect."
          ],
          tools: ["MIFace", "Backdoor poisoning", "MNIST", "CIFAR-10"]
        },
        {
          id: "detection",
          title: "Detection and preprocessing",
          lead: "Trained an adversarial-input detector and compared JPEG preprocessing against attacked samples.",
          details: [
            "Generated detector training data from FGM adversarial samples.",
            "Evaluated whether input transformation changed downstream predictions."
          ],
          tools: ["FGM", "JPEG compression", "NumPy"]
        },
        {
          id: "robustness",
          title: "Robustness strategies",
          lead: "Compared Gaussian-noise postprocessing and defensive distillation with explicit accuracy metrics.",
          details: [
            "Tracked clean, attacked, and defended behavior instead of reporting a defense in isolation.",
            "Used Matplotlib outputs to make experiment effects inspectable."
          ],
          tools: ["Gaussian noise", "Defensive distillation", "Matplotlib"]
        }
      ]
    }
  },
  "yeast-dna-target-selection": {
    overview: {
      summary:
        "Guide Donor Scheduler converts yeast FASTA sequences and requested amino-acid substitutions into CRISPR guide and donor constructs with researcher-ready XLS output.",
      sections: [
        {
          id: "workflow",
          title: "Research workflow",
          lead: "Automated yeast CRISPR guide and donor design from FASTA input to spreadsheet output.",
          details: [
            "The tool accepts requested mutations, searches the associated yeast sequences, and prepares candidate designs.",
            "Researchers receive an organized spreadsheet instead of assembling each design by hand."
          ],
          signal: "FASTA to XLS"
        },
        {
          id: "selection",
          title: "Guide and donor design",
          lead: "Selects 20-base guides near NGG PAM sites and constructs 132-base donor sequences.",
          details: [
            "The pipeline chooses mutation-adjacent guide candidates and builds the corresponding donor context.",
            "Silent changes can be introduced to reduce the chance of Cas9 cutting the edited sequence again."
          ],
          signal: "20 bp · 132 bp"
        },
        {
          id: "delivery",
          title: "Researcher-ready output",
          lead: "Ranks and validates selected sequences before exporting traceable, color-coded XLS results.",
          details: [
            "Structured output keeps the source sequence, guide choice, donor design, and validation result together."
          ],
          signal: "XLS delivery"
        }
      ]
    },
    technical: {
      summary:
        "Built a configurable Python CLI with fastaparser, strand-aware PAM discovery, codon-aware mutation rules, and XLS generation.",
      sections: [
        {
          id: "ingestion",
          title: "Sequence ingestion",
          lead: "Reads one or more FSA or FNA records and locates forward NGG and reverse-strand CCN sites.",
          details: [
            "The CLI accepts configurable inputs and uses reverse complements to keep guide selection strand-aware."
          ],
          signal: "Both DNA strands",
          tools: ["Python", "fastaparser", "argparse", "Regex"]
        },
        {
          id: "guide",
          title: "Guide selection",
          lead: "Searches for 20-base guide candidates near PAMs and filters or ranks the resulting library.",
          details: [
            "Regular-expression matching identifies PAM contexts near the requested edit, while rank thresholds and duplicate removal narrow the candidate set."
          ],
          tools: ["Regex", "Guide ranking", "Library filtering"]
        },
        {
          id: "donor",
          title: "Donor construction",
          lead: "Builds configurable 132-base donor templates and applies codon-aware silent PAM or seed edits.",
          details: [
            "A complete codon table, PAM-frame logic, and reverse-complement handling preserve the requested protein change while reducing re-cutting risk."
          ],
          signal: "132-base donors",
          tools: ["Codon table", "PAM-frame logic", "Reverse complements"]
        },
        {
          id: "export",
          title: "Validation and export",
          lead: "Validates one mutation per guide and writes color-coded, order-ready XLS workbooks.",
          details: [
            "Outputs include guides, original and edited PAMs, mutation offsets, cut-site distances, decision rationale, and full constructs.",
            "Unit tests cover DNA inversion, PAM discovery, mutation generation, PAM disruption, and adjacent mutation cases."
          ],
          tools: ["xlwt", "xlrd", "xlutils", "unittest", "GitHub Actions"]
        }
      ]
    }
  }
};

const researchDisplayTitles: Record<string, string> = {
  "cytocv-miller-lab": "CytoCV",
  "adversarial-machine-learning": "Adversarial Machine Learning",
  "yeast-dna-target-selection": "Guide Donor Scheduler"
};

function createFallbackNarrative(item: ResearchItem, mode: DetailMode): DetailModeContent {
  const summary =
    mode === "overview"
      ? getSummary(item.homeSummary, item.detailSummary)
      : getSummary(item.detailSummary, item.homeSummary);
  const hasTechnicalSkills = mode === "technical" && item.skills.length > 0;
  const sections = item.bullets.length || hasTechnicalSkills
    ? [
        {
          id: "work",
          title: mode === "overview" ? "Selected work" : "Implementation",
          lead: item.bullets[0] ?? "Implemented the project with the technologies listed below.",
          details: item.bullets.slice(1),
          tools: mode === "technical" ? item.skills : undefined
        }
      ]
    : [];

  return {
    summary: summary ?? DETAILS_UNAVAILABLE,
    sections
  };
}

export function getResearchModeContent(item: ResearchItem, mode: DetailMode): DetailModeContent {
  return researchNarratives[item.id]?.[mode] ?? createFallbackNarrative(item, mode);
}

export function getResearchDisplayTitle(item: ResearchItem): string {
  return (researchDisplayTitles[item.id] ?? item.homeTitle?.trim()) || item.title;
}

export function getResearchFormalTitle(item: ResearchItem): string | undefined {
  if (item.id === "adversarial-machine-learning") return undefined;

  const displayTitle = getResearchDisplayTitle(item);
  return item.title.trim() !== displayTitle ? item.title : undefined;
}

export function getResearchResourceLabel(itemId: string, label: string): string {
  if (itemId === "adversarial-machine-learning" && label.trim().toLowerCase() === "manuscript") {
    return "Reference manuscript";
  }

  return label;
}
