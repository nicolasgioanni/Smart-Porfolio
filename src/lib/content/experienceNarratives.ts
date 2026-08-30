import type { ExperienceItem } from "@/content/types";
import { getSummary } from "@/lib/content/displayHelpers";

export type ExperienceDetailMode = "overview" | "technical";

export type ExperienceDetailSection = {
  id: string;
  title: string;
  lead: string;
  details: string[];
  signal?: string;
  tools?: string[];
};

export type ExperienceModeContent = {
  summary: string;
  sections: ExperienceDetailSection[];
};

type ExperienceNarrative = Record<ExperienceDetailMode, ExperienceModeContent>;

export const EXPERIENCE_DETAILS_UNAVAILABLE = "Details not yet available.";

const experienceNarratives: Record<string, ExperienceNarrative> = {
  "research-assistant-software-engineering": {
    overview: {
      summary:
        "Built and deployed CytoCV, a web platform that helps 15+ scientists analyze yeast microscopy images and export per-cell measurements.",
      sections: [
        {
          id: "workflow",
          title: "Scientific workflow",
          lead: "Built a web platform that segments yeast microscopy stacks and exports more than 30 cell-level measurements.",
          details: [
            "Built for the University of Utah Miller Lab through UW Bothell's SEE Lab.",
            "The platform gives scientific users a repeatable path from uploaded images to analysis-ready results."
          ],
          signal: "15+ scientists"
        },
        {
          id: "analysis",
          title: "Image analysis",
          lead: "Turned a manual microscopy process into a repeatable computer-vision workflow.",
          details: [
            "The workflow preprocesses microscopy images, segments yeast cells, and extracts more than 30 measurements for each cell.",
            "Deterministic batch processing keeps repeated analyses consistent."
          ],
          signal: "30+ measurements"
        },
        {
          id: "results",
          title: "Results",
          lead: "Reduced manual analysis by 97%, processing time by 73%, and file storage by 56.6%.",
          details: [
            "Manual microscopy analysis was reduced by 97%.",
            "The processing workflow ran 73% faster, while preview and cache changes reduced storage by 56.6%."
          ],
          signal: "97% less manual work"
        },
        {
          id: "ownership",
          title: "Ownership",
          lead: "Led a six-person Agile team and maintained the platform's delivery pipeline.",
          details: [
            "Coordinated development across a six-person team.",
            "Maintained continuous delivery for a production deployment used by researchers."
          ],
          signal: "6-person team"
        }
      ]
    },
    technical: {
      summary:
        "Architected a Django and JavaScript application with REST APIs, deterministic Mask R-CNN batch processing, PostgreSQL storage, and Linux VM deployment.",
      sections: [
        {
          id: "workflow",
          title: "Application architecture",
          lead: "Built Python/Django REST APIs and a JavaScript Fetch API frontend.",
          details: [
            "Designed the full-stack workflow used to submit microscopy jobs and retrieve analysis results.",
            "Re-architected the data layer and migrated application data from SQLite to PostgreSQL."
          ],
          tools: ["Python", "Django", "JavaScript", "REST APIs", "PostgreSQL"]
        },
        {
          id: "analysis",
          title: "Vision pipeline",
          lead: "Built deterministic TensorFlow/Keras Mask R-CNN workflows for yeast microscopy.",
          details: [
            "Used OpenCV, scikit-image, and NumPy for preprocessing, segmentation support, and measurement extraction.",
            "The pipeline extracts more than 30 cell-level metrics from microscopy data."
          ],
          signal: "73% faster",
          tools: ["TensorFlow/Keras", "Mask R-CNN", "OpenCV", "scikit-image", "NumPy"]
        },
        {
          id: "results",
          title: "Production delivery",
          lead: "Deployed the application on a UW-IT Linux VM with a production web stack and automated delivery.",
          details: [
            "Served the application with Nginx and Gunicorn, secured it with Let's Encrypt TLS, and maintained CI/CD.",
            "Migrated preview and preprocessing caches and converted TIFF caches to PNG, reducing file storage by 56.6%."
          ],
          signal: "56.6% less storage",
          tools: ["Linux", "Nginx", "Gunicorn", "Let's Encrypt TLS", "CI/CD"]
        },
        {
          id: "ownership",
          title: "Scale and delivery",
          lead: "Delivered the workflow for 15+ scientists while leading a six-person Agile team.",
          details: [
            "Owned work across the application, ML pipeline, data layer, and deployment environment.",
            "The completed workflow reduced manual analysis by 97%."
          ],
          signal: "15+ users",
          tools: ["Agile delivery", "Code review"]
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
        "Studied how poisoned training data can manipulate machine-learning models and how defenses can detect the attack.",
      sections: [
        {
          id: "question",
          title: "Research question",
          lead: "Tested targeted training-data poisoning against models learning from data streams.",
          details: [
            "Examined whether attacks could evade loss-based anomaly filtering.",
            "Evaluated whether a feature-space stability metric could detect changes to a model's decision boundary."
          ],
          signal: "Adversarial ML"
        },
        {
          id: "workflow",
          title: "Experiment system",
          lead: "Automated attack, defense, and experiment-reporting workflows.",
          details: [
            "Built repeatable tests instead of evaluating each attack and defense by hand.",
            "Tracked attack success, model accuracy, and execution latency."
          ],
          signal: "Repeatable tests"
        },
        {
          id: "evaluation",
          title: "Evaluation",
          lead: "Measured whether the defense remained fast without sacrificing clean-data performance.",
          details: [
            "Compared attack success, runtime, and accuracy across the automated evaluation workflow."
          ],
          signal: "3 tracked signals"
        },
        {
          id: "outcome",
          title: "Result",
          lead: "Reduced batched defense execution to under five seconds while preserving 94% clean-data accuracy.",
          details: [
            "Defense evaluation completed in under five seconds.",
            "The evaluated model retained 94% accuracy on clean data."
          ],
          signal: "<5 sec · 94%"
        }
      ]
    },
    technical: {
      summary:
        "Automated adversarial-ML experiments with Python, TensorFlow/Keras, NumPy, and Matplotlib.",
      sections: [
        {
          id: "question",
          title: "Attack and defense model",
          lead: "Implemented attack and defense pipelines for image-classification models.",
          details: [
            "The associated study evaluated targeted training-data poisoning against SVMs learning from data streams.",
            "Tested whether attacks could evade loss-based anomaly filtering."
          ],
          tools: ["Python", "TensorFlow/Keras", "Adversarial ML"]
        },
        {
          id: "workflow",
          title: "Evaluation workflow",
          lead: "Automated reporting for attack success rate, latency, and model accuracy.",
          details: [
            "Evaluated loss-based anomaly filtering and a feature-space stability metric.",
            "Produced repeatable experiment outputs for comparison."
          ],
          signal: "Automated reporting",
          tools: ["NumPy", "Matplotlib"]
        },
        {
          id: "evaluation",
          title: "Performance optimization",
          lead: "Optimized batched Keras defense evaluation to run in under five seconds.",
          details: [
            "Batched the evaluation path to reduce defense runtime.",
            "Tracked the runtime improvement alongside attack and accuracy metrics."
          ],
          signal: "Under 5 seconds",
          tools: ["Keras", "Batch evaluation"]
        },
        {
          id: "outcome",
          title: "Accuracy guardrail",
          lead: "Preserved 94% accuracy on clean data during defense evaluation.",
          details: [
            "Used clean-data accuracy as a guardrail while evaluating the optimized defense workflow."
          ],
          signal: "94% accuracy",
          tools: ["Model evaluation"]
        }
      ]
    }
  },
  "research-assistant-ai-ml": {
    overview: {
      summary:
        "Built a research tool that automated CRISPR/Cas9 guide and donor-sequence design across 18,000+ yeast DNA files.",
      sections: [
        {
          id: "workflow",
          title: "Research workflow",
          lead: "Built an automated target-selection workflow for yeast DNA research.",
          details: [
            "The tool selected guide sequences, constructed donor sequences, and prepared validated results for researchers.",
            "It replaced a repetitive manual sequence-design process."
          ],
          signal: "18,000+ files"
        },
        {
          id: "selection",
          title: "Sequence design",
          lead: "Generated guide and donor sequences around requested genetic mutations.",
          details: [
            "Selected 20-base guides near NGG PAM sites.",
            "Constructed 132-base donor sequences and added silent edits intended to prevent re-cutting."
          ],
          signal: "Validated designs"
        },
        {
          id: "output",
          title: "Researcher-ready output",
          lead: "Produced validated sequence results that researchers could use in Excel.",
          details: [
            "Processed more than 18,000 FASTA files and organized the selected sequences into an exportable format."
          ],
          signal: "Excel delivery"
        },
        {
          id: "outcome",
          title: "Result",
          lead: "Reduced the manual research workflow by 99%.",
          details: [
            "Automating file analysis, target selection, and export removed nearly all of the prior manual process."
          ],
          signal: "99% less manual work"
        }
      ]
    },
    technical: {
      summary:
        "Built a Python sequence-design pipeline with pandas, Biopython, and regular expressions.",
      sections: [
        {
          id: "workflow",
          title: "Input processing",
          lead: "Parsed and analyzed more than 18,000 FASTA files.",
          details: [
            "Used Biopython for biological sequence handling, pandas for tabular workflows, and regular expressions for pattern matching."
          ],
          signal: "18,000+ FASTA files",
          tools: ["Python", "pandas", "Biopython", "Regex"]
        },
        {
          id: "selection",
          title: "Guide selection",
          lead: "Selected 20-base guide sequences near NGG PAM sites.",
          details: [
            "Applied the selection rules across the parsed yeast DNA inputs to identify candidate guides."
          ],
          tools: ["Biopython", "Regex"]
        },
        {
          id: "output",
          title: "Donor construction",
          lead: "Built 132-base donor sequences around requested mutations.",
          details: [
            "Added silent edits intended to prevent re-cutting, then validated the constructed sequence output."
          ],
          signal: "132-base donors",
          tools: ["Python", "Biopython"]
        },
        {
          id: "outcome",
          title: "Output and impact",
          lead: "Exported validated sequences to Excel and reduced manual work by 99%.",
          details: [
            "Used pandas to prepare researcher-ready output from the completed sequence-design workflow."
          ],
          signal: "99% reduction",
          tools: ["pandas", "Excel"]
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
