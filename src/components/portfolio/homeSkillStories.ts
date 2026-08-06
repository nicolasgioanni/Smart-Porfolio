import type {
  ExperienceItem,
  HomePortfolioContent,
  ProjectItem,
  ResearchItem
} from "@/content/types";

export type HomeSkillEvidence = {
  id: string;
  kind: "Experience" | "Project" | "Research";
  title: string;
  context?: string;
  proof: string;
  outcome?: string;
  tools: string[];
  href: "/experience" | "/projects" | "/research";
};

export type HomeSkillStory = {
  id: string;
  label: string;
  summary: string;
  tools: string[];
  evidence: HomeSkillEvidence[];
};

type EvidenceKind = "experience" | "project" | "research";

type EvidenceReference = {
  kind: EvidenceKind;
  itemId: string;
  outcomeBullet?: number;
};

type SkillStoryDefinition = Omit<HomeSkillStory, "evidence"> & {
  evidence: EvidenceReference[];
};

const coreToolkitOrder = ["Python", "TypeScript", "Django", "Next.js", "TensorFlow/Keras", "PostgreSQL"];

const skillStoryDefinitions: SkillStoryDefinition[] = [
  {
    id: "applied-ai-computer-vision",
    label: "Applied AI & computer vision",
    summary: "I turn models into usable, measured workflows instead of stopping at an experiment.",
    tools: ["Python", "TensorFlow/Keras", "OpenCV", "scikit-image", "NumPy", "LLM API"],
    evidence: [
      { kind: "research", itemId: "cytocv-miller-lab" },
      { kind: "research", itemId: "adversarial-machine-learning" },
      { kind: "project", itemId: "notepal" }
    ]
  },
  {
    id: "full-stack-product-engineering",
    label: "Full-stack product engineering",
    summary: "I build the interface, API, data layer, and delivery path as one product system.",
    tools: ["TypeScript", "Next.js", "Django", "Flask", "REST APIs", "PostgreSQL"],
    evidence: [
      { kind: "research", itemId: "cytocv-miller-lab" },
      { kind: "project", itemId: "notepal" }
    ]
  },
  {
    id: "automation-data-workflows",
    label: "Automation & data workflows",
    summary: "I replace repetitive, error-prone work with repeatable pipelines and useful outputs.",
    tools: ["Python", "pandas", "Biopython", "Bash", "PostgreSQL"],
    evidence: [
      { kind: "research", itemId: "yeast-dna-target-selection" },
      { kind: "project", itemId: "clair" },
      { kind: "research", itemId: "cytocv-miller-lab" }
    ]
  },
  {
    id: "production-delivery-systems",
    label: "Production delivery & systems",
    summary: "I carry software through deployment, storage, security, and day-to-day operation.",
    tools: ["Linux", "Docker", "PostgreSQL", "Nginx", "Gunicorn", "Vercel", "CI/CD"],
    evidence: [
      { kind: "experience", itemId: "research-assistant-software-engineering", outcomeBullet: 3 },
      { kind: "project", itemId: "notepal" }
    ]
  },
  {
    id: "technical-leadership-teaching",
    label: "Technical leadership & teaching",
    summary: "I make technical work clearer for teams, students, and the people who use what we build.",
    tools: ["Agile leadership", "Teaching", "Code review", "Mentorship"],
    evidence: [
      { kind: "experience", itemId: "research-assistant-software-engineering", outcomeBullet: 4 },
      { kind: "experience", itemId: "teaching-assistant", outcomeBullet: 0 },
      { kind: "experience", itemId: "gdg-officer", outcomeBullet: 0 }
    ]
  }
];

function normalizeSkillName(value: string): string {
  return value.trim().toLowerCase();
}

function selectEvidenceTools(sourceTools: string[], storyTools: string[]): string[] {
  const availableTools = new Map(sourceTools.map((tool) => [normalizeSkillName(tool), tool]));
  const matchedTools = storyTools.flatMap((tool) => {
    const matchedTool = availableTools.get(normalizeSkillName(tool));
    return matchedTool ? [matchedTool] : [];
  });

  return matchedTools.slice(0, 5);
}

function createExperienceEvidence(
  item: ExperienceItem,
  definition: SkillStoryDefinition,
  reference: EvidenceReference
): HomeSkillEvidence | undefined {
  const proof = item.detailSummary ?? item.homeSummary ?? item.bullets[0];

  if (!proof) {
    return undefined;
  }

  return {
    id: `experience-${item.id}`,
    kind: "Experience",
    title: item.title,
    context: item.organization,
    proof,
    outcome: reference.outcomeBullet === undefined ? undefined : item.bullets[reference.outcomeBullet],
    tools: selectEvidenceTools(item.skills, definition.tools),
    href: "/experience"
  };
}

function createProjectEvidence(item: ProjectItem, definition: SkillStoryDefinition): HomeSkillEvidence | undefined {
  const proof = item.detailSummary ?? item.homeSummary ?? item.solution;

  if (!proof) {
    return undefined;
  }

  return {
    id: `project-${item.id}`,
    kind: "Project",
    title: item.title,
    context: item.subtitle,
    proof,
    outcome: item.impact,
    tools: selectEvidenceTools(item.stack, definition.tools),
    href: "/projects"
  };
}

function createResearchEvidence(item: ResearchItem, definition: SkillStoryDefinition): HomeSkillEvidence | undefined {
  const proof = item.detailSummary ?? item.homeSummary ?? item.bullets[0];

  if (!proof) {
    return undefined;
  }

  return {
    id: `research-${item.id}`,
    kind: "Research",
    title: item.title,
    context: item.organization,
    proof,
    outcome: item.impact,
    tools: selectEvidenceTools(item.skills, definition.tools),
    href: "/research"
  };
}

function resolveEvidence(
  content: Pick<HomePortfolioContent, "experience" | "projects" | "research">,
  definition: SkillStoryDefinition,
  reference: EvidenceReference
): HomeSkillEvidence | undefined {
  if (reference.kind === "experience") {
    const item = content.experience.find((candidate) => candidate.id === reference.itemId);
    return item ? createExperienceEvidence(item, definition, reference) : undefined;
  }

  if (reference.kind === "project") {
    const item = content.projects.find((candidate) => candidate.id === reference.itemId);
    return item ? createProjectEvidence(item, definition) : undefined;
  }

  const item = content.research.find((candidate) => candidate.id === reference.itemId);
  return item ? createResearchEvidence(item, definition) : undefined;
}

export function createHomeSkillStories(
  content: Pick<HomePortfolioContent, "experience" | "projects" | "research">
): HomeSkillStory[] {
  return skillStoryDefinitions.flatMap((definition) => {
    const evidence = definition.evidence.flatMap((reference) => {
      const resolvedEvidence = resolveEvidence(content, definition, reference);
      return resolvedEvidence ? [resolvedEvidence] : [];
    });

    return evidence.length > 0 ? [{ ...definition, evidence }] : [];
  });
}

export function selectHomeCoreToolkit(
  content: Pick<HomePortfolioContent, "experience" | "projects" | "research" | "skillGroups">
): string[] {
  const skillNames = [
    ...content.skillGroups.flatMap((group) => group.skills.map((skill) => skill.name)),
    ...content.experience.flatMap((item) => item.skills),
    ...content.projects.flatMap((item) => item.stack),
    ...content.research.flatMap((item) => item.skills)
  ];
  const availableSkills = new Map(skillNames.map((skillName) => [normalizeSkillName(skillName), skillName]));

  return coreToolkitOrder.flatMap((skillName) => {
    const availableSkill = availableSkills.get(normalizeSkillName(skillName));
    return availableSkill ? [availableSkill] : [];
  });
}

