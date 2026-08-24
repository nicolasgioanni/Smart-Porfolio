import type { ReactNode } from "react";
import type { SimpleIcon } from "simple-icons";
import {
  siCplusplus,
  siCss,
  siDjango,
  siDocker,
  siFirebase,
  siFlask,
  siGit,
  siGithubactions,
  siGnubash,
  siGooglesheets,
  siGunicorn,
  siHtml5,
  siJavascript,
  siKeras,
  siLetsencrypt,
  siLinux,
  siNextdotjs,
  siNginx,
  siNodedotjs,
  siNumpy,
  siOpencv,
  siPandas,
  siPostgresql,
  siPython,
  siQt,
  siReact,
  siTensorflow,
  siTypescript,
  siUltralytics
} from "simple-icons";

type SkillIconProps = {
  icon?: string;
  title?: string;
};

const brandIcons: Readonly<Record<string, SimpleIcon>> = {
  cplusplus: siCplusplus,
  css: siCss,
  django: siDjango,
  docker: siDocker,
  firebase: siFirebase,
  flask: siFlask,
  git: siGit,
  githubactions: siGithubactions,
  gnubash: siGnubash,
  googlesheets: siGooglesheets,
  gunicorn: siGunicorn,
  html5: siHtml5,
  javascript: siJavascript,
  keras: siKeras,
  letsencrypt: siLetsencrypt,
  linux: siLinux,
  nextdotjs: siNextdotjs,
  nginx: siNginx,
  nodedotjs: siNodedotjs,
  numpy: siNumpy,
  opencv: siOpencv,
  pandas: siPandas,
  postgresql: siPostgresql,
  python: siPython,
  qt: siQt,
  react: siReact,
  tensorflow: siTensorflow,
  typescript: siTypescript,
  ultralytics: siUltralytics
};

function normalizeIconKey(icon: string | undefined): string | undefined {
  const normalizedIcon = icon?.trim().toLowerCase().replaceAll("_", "-");
  return normalizedIcon || undefined;
}

function SvgShell({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="skill-icon"
      fill="none"
      focusable="false"
      height="20"
      role={title ? "img" : undefined}
      viewBox="0 0 24 24"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

function BrandIcon({ icon, title }: { icon: SimpleIcon; title?: string }) {
  const normalizedHex = icon.hex.toUpperCase();
  const fill = normalizedHex === "000000" || normalizedHex === "FFFFFF" ? "currentColor" : `#${icon.hex}`;

  return (
    <SvgShell title={title}>
      <path d={icon.path} fill={fill} />
    </SvgShell>
  );
}

function SemanticIcon({ icon, title }: { icon: string; title?: string }) {
  const commonStrokeProps = {
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7
  };

  if (icon === "image-processing") {
    return (
      <SvgShell title={title}>
        <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" {...commonStrokeProps} />
        <circle cx="9" cy="9" r="1.5" {...commonStrokeProps} />
        <path d="m6.5 17 4-4 2.5 2.5 2-2 2.5 3.5" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "api") {
    return (
      <SvgShell title={title}>
        <circle cx="5" cy="12" r="2" {...commonStrokeProps} />
        <circle cx="19" cy="6" r="2" {...commonStrokeProps} />
        <circle cx="19" cy="18" r="2" {...commonStrokeProps} />
        <path d="m7 11 10-4M7 13l10 4" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "database" || icon === "pinecone") {
    return (
      <SvgShell title={title}>
        <ellipse cx="12" cy="5.5" rx="7" ry="3" {...commonStrokeProps} />
        <path d="M5 5.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6M5 11.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "cpu") {
    return (
      <SvgShell title={title}>
        <rect height="12" rx="2" width="12" x="6" y="6" {...commonStrokeProps} />
        <rect height="5" rx="1" width="5" x="9.5" y="9.5" {...commonStrokeProps} />
        <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "ssh") {
    return (
      <SvgShell title={title}>
        <rect height="15" rx="2" width="18" x="3" y="4.5" {...commonStrokeProps} />
        <path d="m7 9 3 3-3 3M12.5 15H17" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "shield-check") {
    return (
      <SvgShell title={title}>
        <path d="M12 3 5.5 5.5v5.7c0 4.3 2.5 7.7 6.5 9.8 4-2.1 6.5-5.5 6.5-9.8V5.5L12 3Z" {...commonStrokeProps} />
        <path d="m8.8 12 2.1 2.1 4.4-4.5" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "azure") {
    return (
      <SvgShell title={title}>
        <path d="M7 18.5h10a4 4 0 0 0 .5-8 5.8 5.8 0 0 0-11-1.3A4.7 4.7 0 0 0 7 18.5Z" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "llm" || icon === "openai") {
    return (
      <SvgShell title={title}>
        <circle cx="12" cy="12" r="2.3" {...commonStrokeProps} />
        <circle cx="6" cy="7" r="1.5" {...commonStrokeProps} />
        <circle cx="18" cy="7" r="1.5" {...commonStrokeProps} />
        <circle cx="6" cy="17" r="1.5" {...commonStrokeProps} />
        <circle cx="18" cy="17" r="1.5" {...commonStrokeProps} />
        <path d="m7.2 8 3 2.5m3.6 0 3-2.5m-9.6 8 3-2.5m3.6 0 3 2.5" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "biopython") {
    return (
      <SvgShell title={title}>
        <path d="M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9M9.5 6h5M8.5 10h7M8.5 14h7M9.5 18h5" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  if (icon === "matplotlib") {
    return (
      <SvgShell title={title}>
        <path d="M5 4v15h15" {...commonStrokeProps} />
        <path d="m7.5 15 3.2-3.5 2.7 1.8 4.1-6" {...commonStrokeProps} />
        <circle cx="7.5" cy="15" r=".8" fill="currentColor" />
        <circle cx="10.7" cy="11.5" r=".8" fill="currentColor" />
        <circle cx="13.4" cy="13.3" r=".8" fill="currentColor" />
        <circle cx="17.5" cy="7.3" r=".8" fill="currentColor" />
      </SvgShell>
    );
  }

  if (icon === "pyinstaller") {
    return (
      <SvgShell title={title}>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" {...commonStrokeProps} />
        <path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12.1V21" {...commonStrokeProps} />
      </SvgShell>
    );
  }

  return (
    <SvgShell title={title}>
      <path d="m9 7-5 5 5 5M15 7l5 5-5 5M13.5 4 10.5 20" {...commonStrokeProps} />
    </SvgShell>
  );
}

export function SkillIcon({ icon, title }: SkillIconProps) {
  const iconKey = normalizeIconKey(icon);

  if (!iconKey) return null;

  const brandIcon = brandIcons[iconKey];

  if (brandIcon) {
    return <BrandIcon icon={brandIcon} title={title} />;
  }

  return <SemanticIcon icon={iconKey} title={title} />;
}
