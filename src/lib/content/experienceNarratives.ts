import type { ExperienceItem } from "@/content/types";
import {
  DETAILS_UNAVAILABLE,
  type DetailMode,
  type DetailModeContent,
  type DetailNarrative,
  type DetailSection
} from "@/lib/content/detailNarratives";
import { getSummary } from "@/lib/content/displayHelpers";

export type ExperienceDetailMode = DetailMode;
export type ExperienceDetailSection = DetailSection;
export type ExperienceModeContent = DetailModeContent;

type ExperienceNarrative = DetailNarrative;

export const EXPERIENCE_DETAILS_UNAVAILABLE = DETAILS_UNAVAILABLE;

const experienceNarratives: Record<string, ExperienceNarrative> = {
  "research-assistant-software-engineering": {
    overview: {
      summary:
        "Built and deployed CytoCV, an open-source web platform that turns yeast microscopy stacks into reviewable per-cell fluorescence measurements and structured exports.",
      sections: [
        {
          id: "workflow",
          title: "Scientific workflow",
          lead: "Translated a microscopy workflow into a repeatable path from DeltaVision or TIFF upload through analysis, review, and export.",
          details: [
            "Built for the University of Utah Miller Lab through UW Bothell's SEE Lab.",
            "Aligned the platform with biology-facing requirements across ingestion, segmentation, measurement, and result review."
          ],
          signal: "End-to-end workflow"
        },
        {
          id: "analysis",
          title: "Image analysis",
          lead: "Used DIC-guided Mask R-CNN inference to segment cells and mother-daughter pairs for multichannel analysis.",
          details: [
            "Reviewable overlays align DIC segmentation with fluorescence channels before export.",
            "Configurable analyses cover puncta distance, CEN-dot localization, biorientation, contour intensity, and nuclear or cell-pair intensity."
          ],
          signal: "DIC-guided CV"
        },
        {
          id: "results",
          title: "Research platform",
          lead: "Delivered background processing, progress and cancellation controls, protected artifacts, and durable results.",
          details: [
            "Authentication and retention controls support repeatable shared-lab use.",
            "PostgreSQL persistence keeps experiments, analysis state, and exported results available across sessions."
          ],
          signal: "Reviewable results"
        },
        {
          id: "ownership",
          title: "Open research software",
          lead: "Led architecture, implementation, deployment, and maintenance with SEE Lab and Miller Lab collaborators.",
          details: [
            "Released CytoCV v2.0.0 with citation metadata, reproducibility documentation, and a versioned software DOI.",
            "Continued maintaining the deployed application while the journal manuscript remained in preparation."
          ],
          signal: "Citable v2.0.0"
        }
      ]
    },
    technical: {
      summary:
        "Architected a Django and JavaScript application with JSON endpoints, DIC-guided Mask R-CNN inference, worker-backed analysis, PostgreSQL persistence, and Linux deployment.",
      sections: [
        {
          id: "workflow",
          title: "Application architecture",
          lead: "Connected Django JSON endpoints to a JavaScript browser interface and PostgreSQL-backed data model.",
          details: [
            "Designed the full-stack workflow used to submit microscopy jobs, poll progress, and retrieve analysis results.",
            "Re-architected the data layer and migrated application data from SQLite to PostgreSQL."
          ],
          tools: ["Python", "Django", "JavaScript", "HTTP/JSON", "PostgreSQL"]
        },
        {
          id: "analysis",
          title: "Vision pipeline",
          lead: "Built deterministic TensorFlow/Keras Mask R-CNN workflows for DIC-guided yeast segmentation.",
          details: [
            "Used OpenCV, scikit-image, and NumPy to postprocess instance predictions into reviewable cells and cell pairs.",
            "Aligned fluorescence channels with segmentation masks for configurable per-cell analysis."
          ],
          signal: "Multichannel CV",
          tools: ["TensorFlow/Keras", "Mask R-CNN", "OpenCV", "scikit-image", "NumPy"]
        },
        {
          id: "results",
          title: "Research platform",
          lead: "Designed worker-backed jobs, progress and cancellation flows, protected artifacts, and durable result storage.",
          details: [
            "A Django management worker coordinates upload preparation and analysis outside the web request.",
            "Authentication, retention controls, and PostgreSQL persistence support shared research workflows."
          ],
          signal: "Worker-backed",
          tools: ["Django", "PostgreSQL", "pandas", "openpyxl"]
        },
        {
          id: "ownership",
          title: "Production delivery",
          lead: "Led Linux deployment, regression testing, technical documentation, and the citable v2.0.0 release.",
          details: [
            "Operated the production stack with Gunicorn, Nginx, and systemd-managed web and worker services.",
            "Maintained reproducibility and methods documentation alongside the deployed application."
          ],
          signal: "Production R&D",
          tools: ["Linux", "Gunicorn", "Nginx", "systemd", "GitHub Actions", "Docker"]
        }
      ]
    }
  },
  "teaching-assistant": {
    overview: {
      summary:
        "Supported core computer-science courses through weekly quiz sections, office hours, one-to-one tutoring, grading, and project review.",
      sections: [
        {
          id: "support",
          title: "Student support",
          lead: "Led weekly office hours and quiz sections and provided one-to-one tutoring.",
          details: [
            "Helped students work through concepts, debug assignments, and build confidence with unfamiliar material.",
            "Supported Data Structures & Algorithms, Discrete Mathematics, Operating Systems, and Software Engineering."
          ],
          signal: "600+ students"
        },
        {
          id: "feedback",
          title: "Project feedback",
          lead: "Reviewed coding projects and gave students actionable technical feedback.",
          details: [
            "Evaluated projects for more than 400 students through code review.",
            "Balanced correctness, maintainability, and clear explanations when assessing student work."
          ],
          signal: "400+ code reviews"
        },
        {
          id: "coverage",
          title: "Course coverage",
          lead: "Supported four foundational areas across computer science and software engineering.",
          details: [
            "Worked across algorithms and data structures, discrete mathematics, operating systems, and team-based software development."
          ],
          signal: "4 core subjects"
        },
        {
          id: "outcome",
          title: "Teaching outcome",
          lead: "Earned an average student rating of 4.91 out of 5.",
          details: [
            "The rating reflects student feedback across the teaching, tutoring, and course-support experience."
          ],
          signal: "4.91 / 5"
        }
      ]
    },
    technical: {
      summary:
        "Taught and reviewed coursework spanning C/C++, JavaScript, object-oriented programming, Git, and Docker.",
      sections: [
        {
          id: "support",
          title: "Instruction",
          lead: "Led weekly quiz sections and office hours across four core CS subject areas.",
          details: [
            "Covered Data Structures & Algorithms, Discrete Mathematics, Operating Systems, and Software Engineering.",
            "Provided one-to-one technical tutoring alongside group instruction."
          ],
          signal: "600+ students",
          tools: ["Data structures", "Algorithms", "Operating systems"]
        },
        {
          id: "feedback",
          title: "Assessment",
          lead: "Managed grading and code review for student software projects.",
          details: [
            "Evaluated coding projects for more than 400 students.",
            "Reviewed implementation choices and communicated specific, actionable corrections."
          ],
          signal: "400+ students",
          tools: ["Code review", "Git"]
        },
        {
          id: "coverage",
          title: "Technical coverage",
          lead: "Supported coursework using C/C++, JavaScript, OOP, Git, and Docker.",
          details: [
            "Helped students apply programming fundamentals, object-oriented design, version control, and container-based workflows."
          ],
          tools: ["C/C++", "JavaScript", "OOP", "Git", "Docker"]
        },
        {
          id: "outcome",
          title: "Outcome",
          lead: "Reached 600+ students with an average rating of 4.91 out of 5.",
          details: [
            "Combined instruction, tutoring, grading, and code review across multiple courses."
          ],
          signal: "4.91 / 5"
        }
      ]
    }
  },
  "undergraduate-researcher-adversarial-ml": {
    overview: {
      summary:
        "Completed an independent study in adversarial machine learning with four attack prototypes and four defensive strategies across image-classification benchmarks.",
      sections: [
        {
          id: "question",
          title: "Study scope",
          lead: "Built eight focused prototypes spanning adversarial attacks and defensive techniques.",
          details: [
            "The study covered evasion, model extraction, model inversion, and backdoor poisoning.",
            "Defenses covered adversarial-input detection, input preprocessing, output perturbation, and defensive distillation."
          ],
          signal: "4 attacks · 4 defenses"
        },
        {
          id: "workflow",
          title: "Attack experiments",
          lead: "Generated DeepFool adversarial examples and built Copycat CNN, MIFace, and corner-trigger poisoning experiments.",
          details: [
            "The prototypes covered distinct evasion, extraction, inversion, and poisoning threat models.",
            "Each experiment kept its target model and generated outputs available for inspection."
          ],
          signal: "4 attack families"
        },
        {
          id: "evaluation",
          title: "Defense experiments",
          lead: "Compared adversarial-input detection, JPEG preprocessing, Gaussian-noise postprocessing, and defensive distillation.",
          details: [
            "FGM adversarial samples supplied detector training data.",
            "Preprocessing, postprocessing, and distillation experiments exposed their effects on downstream predictions."
          ],
          signal: "4 defense strategies"
        },
        {
          id: "outcome",
          title: "Evaluation",
          lead: "Measured attack success alongside clean, attacked, and defended model accuracy.",
          details: [
            "Ran the prototypes across MNIST, Fashion-MNIST, and CIFAR-10.",
            "Captured experiment metrics and visual outputs to make attack and defense behavior inspectable."
          ],
          signal: "3 datasets"
        }
      ]
    },
    technical: {
      summary:
        "Integrated Adversarial Robustness Toolbox primitives with TensorFlow/Keras models across eight focused attack-and-defense prototypes.",
      sections: [
        {
          id: "question",
          title: "Evasion and extraction",
          lead: "Generated DeepFool examples against Fashion-MNIST and trained a Copycat CNN substitute model from queried outputs.",
          details: [
            "Compared classifier predictions before and after DeepFool perturbation.",
            "Evaluated the extracted model separately from its target classifier."
          ],
          tools: ["ART", "TensorFlow/Keras", "DeepFool", "Fashion-MNIST"]
        },
        {
          id: "workflow",
          title: "Inversion and poisoning",
          lead: "Built MIFace model-inversion and corner-trigger backdoor-poisoning experiments.",
          details: [
            "Reconstructed representative MNIST inputs through model inversion.",
            "Injected a visual trigger into training samples and measured its effect on triggered test inputs."
          ],
          tools: ["MIFace", "Backdoor poisoning", "MNIST", "CIFAR-10"]
        },
        {
          id: "evaluation",
          title: "Detection and preprocessing",
          lead: "Trained an adversarial-input detector on FGM samples and evaluated JPEG preprocessing.",
          details: [
            "Generated detector training inputs from Fast Gradient Method adversarial examples.",
            "Measured whether JPEG transformation changed downstream classification behavior."
          ],
          tools: ["FGM", "JPEG compression", "NumPy"]
        },
        {
          id: "outcome",
          title: "Postprocessing and distillation",
          lead: "Compared Gaussian-noise output perturbation with defensive distillation.",
          details: [
            "Tracked clean, attacked, and defended accuracy rather than reporting a mitigation in isolation.",
            "Used Matplotlib outputs to make experiment effects inspectable."
          ],
          tools: ["Gaussian noise", "Defensive distillation", "Matplotlib"]
        }
      ]
    }
  },
  "research-assistant-ai-ml": {
    overview: {
      summary:
        "Built Guide Donor Scheduler, a Python tool that converts yeast FASTA sequences and requested amino-acid substitutions into CRISPR/Cas9 guide and donor constructs.",
      sections: [
        {
          id: "workflow",
          title: "Research workflow",
          lead: "Automated yeast CRISPR guide and donor design from FASTA input to spreadsheet output.",
          details: [
            "The tool reads FSA or FNA records, applies requested mutation rules, and prepares candidate designs.",
            "Researchers receive an organized XLS workbook containing the sequence-design decisions."
          ],
          signal: "FASTA to XLS"
        },
        {
          id: "selection",
          title: "Sequence design",
          lead: "Selected 20-base guides near PAM sites and constructed configurable 132-base donor sequences.",
          details: [
            "Forward NGG and reverse-strand CCN discovery keeps candidate selection strand-aware.",
            "Codon-aware silent PAM or seed edits preserve the requested protein change while reducing re-cutting risk."
          ],
          signal: "20 bp · 132 bp"
        },
        {
          id: "output",
          title: "Candidate selection",
          lead: "Supported guide filtering, ranking, duplicate removal, reverse complements, and kill-guide generation.",
          details: [
            "Configurable rank thresholds and guide-library rules narrow candidate sets when those modes are enabled.",
            "Unit tests cover strand inversion, PAM discovery, mutation generation, PAM disruption, and adjacent mutations."
          ],
          signal: "Strand-aware"
        },
        {
          id: "outcome",
          title: "Researcher-ready output",
          lead: "Generated color-coded XLS workbooks with traceable guide, donor, mutation, and cut-site details.",
          details: [
            "Outputs include guides, original PAMs, mutation offsets, cut-site distances, full constructs, and decision rationale."
          ],
          signal: "XLS delivery"
        }
      ]
    },
    technical: {
      summary:
        "Built a configurable Python CLI with fastaparser, regular-expression PAM discovery, codon-aware mutation rules, and XLS generation.",
      sections: [
        {
          id: "workflow",
          title: "Input processing",
          lead: "Read one or more FSA or FNA records and prepared their sequences for strand-aware analysis.",
          details: [
            "The command-line interface accepts input and output options while configuration controls mutation and library behavior."
          ],
          signal: "FASTA ingestion",
          tools: ["Python", "fastaparser", "argparse"]
        },
        {
          id: "selection",
          title: "PAM and guide discovery",
          lead: "Located forward NGG and reverse-strand CCN sites, then derived 20-base guide candidates.",
          details: [
            "Regular-expression matching, reverse complements, rank thresholds, and duplicate removal refine the candidate library."
          ],
          tools: ["Regex", "Reverse complements", "Guide ranking"]
        },
        {
          id: "output",
          title: "Donor construction",
          lead: "Built configurable 132-base donor templates around requested amino-acid substitutions.",
          details: [
            "Codon-table and PAM-frame logic applies silent PAM or seed edits while preserving the requested protein change."
          ],
          signal: "132-base donors",
          tools: ["Codon table", "PAM-frame logic", "Reverse complements"]
        },
        {
          id: "outcome",
          title: "XLS export and testing",
          lead: "Wrote color-coded XLS workbooks and exercised mutation logic in GitHub Actions.",
          details: [
            "Workbook rows retain guide, PAM, mutation, cut-site, construct, and decision details.",
            "Unit tests cover DNA inversion, PAM discovery, mutation generation, PAM disruption, and adjacent mutation cases."
          ],
          signal: "Traceable output",
          tools: ["xlwt", "xlrd", "xlutils", "unittest", "GitHub Actions"]
        }
      ]
    }
  }
};

function createFallbackNarrative(item: ExperienceItem, mode: ExperienceDetailMode): ExperienceModeContent {
  const summary =
    mode === "overview"
      ? getSummary(item.homeSummary, item.detailSummary)
      : getSummary(item.detailSummary, item.homeSummary);
  const sections: ExperienceDetailSection[] = [];

  if (mode === "overview" && item.detailSummary && item.detailSummary !== summary) {
    sections.push({
      id: "work",
      title: "What I worked on",
      lead: item.detailSummary,
      details: item.bullets.length > 0 ? item.bullets : []
    });
  }

  if (mode === "technical" && item.bullets.length > 0) {
    sections.push({
      id: "work",
      title: "Implementation and results",
      lead: item.bullets[0]!,
      details: item.bullets.slice(1),
      tools: item.skills
    });
  } else if (mode === "overview" && sections.length === 0 && item.bullets.length > 0) {
    sections.push({
      id: "work",
      title: "Selected outcomes",
      lead: item.bullets[0]!,
      details: item.bullets.slice(1)
    });
  }

  if (mode === "technical" && item.skills.length > 0 && sections.length === 0) {
    sections.push({
      id: "tools",
      title: "Tools used",
      lead: item.skills.join(", "),
      details: [],
      tools: item.skills
    });
  }

  return {
    summary: summary ?? EXPERIENCE_DETAILS_UNAVAILABLE,
    sections
  };
}

export function getExperienceModeContent(
  item: ExperienceItem,
  mode: ExperienceDetailMode
): ExperienceModeContent {
  return experienceNarratives[item.id]?.[mode] ?? createFallbackNarrative(item, mode);
}
