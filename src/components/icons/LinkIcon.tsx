import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  kind?: string;
};

function BaseIcon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" height="18" viewBox="0 0 24 24" width="18" {...props}>
      {children}
    </svg>
  );
}

export function LinkIcon({ kind = "external", ...props }: IconProps) {
  const normalizedKind = kind.toLowerCase();

  if (normalizedKind === "github") {
    return (
      <BaseIcon {...props}>
        <path d="M9 19.2c-5 .7-5-2.4-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.6a5.1 5.1 0 0 0-1.4-3.6 4.7 4.7 0 0 0-.1-3.6s-1.1-.4-3.7 1.4a12.8 12.8 0 0 0-6.7 0C6.8.5 5.7.9 5.7.9a4.7 4.7 0 0 0-.1 3.6 5.1 5.1 0 0 0-1.4 3.6c0 5.1 3.1 6.3 6.1 6.6a3 3 0 0 0-.8 1.9V22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </BaseIcon>
    );
  }

  if (normalizedKind === "linkedin") {
    return (
      <BaseIcon {...props}>
        <path d="M6.5 10v7.5M6.5 6.5v.1M10.5 17.5V10m0 3.2c.4-1.9 1.7-3.2 3.6-3.2 2.3 0 3.4 1.5 3.4 4.1v3.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M4.5 3.5h15a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" />
      </BaseIcon>
    );
  }

  if (normalizedKind === "email") {
    return (
      <BaseIcon {...props}>
        <path d="M4.5 6.5h15v11h-15v-11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="m5.5 7.5 6.5 5 6.5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </BaseIcon>
    );
  }

  if (normalizedKind === "location") {
    return (
      <BaseIcon {...props}>
        <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" strokeWidth="1.8" />
      </BaseIcon>
    );
  }

  if (normalizedKind === "timezone" || normalizedKind === "time") {
    return (
      <BaseIcon {...props}>
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7.5V12l3 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </BaseIcon>
    );
  }

  if (normalizedKind === "resume" || normalizedKind === "file") {
    return (
      <BaseIcon {...props}>
        <path d="M7 3.5h7l3 3v14H7v-17Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M14 3.8V7h3.2M9.5 11h5M9.5 14h5M9.5 17h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </BaseIcon>
    );
  }

  if (normalizedKind === "publication" || normalizedKind === "paper" || normalizedKind === "manuscript") {
    return (
      <BaseIcon {...props}>
        <path d="M7 3.5h7l3 3v14H7v-17Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M14 3.8V7h3.2M9.5 11h5M9.5 14h5M9.5 17h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </BaseIcon>
    );
  }

  if (normalizedKind === "website" || normalizedKind === "portfolio") {
    return (
      <BaseIcon {...props}>
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 12h17M12 3c2.3 2.4 3.4 5.4 3.4 9S14.3 18.6 12 21c-2.3-2.4-3.4-5.4-3.4-9S9.7 5.4 12 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </BaseIcon>
    );
  }

  return (
    <BaseIcon {...props}>
      <path d="M8.5 15.5 15.5 8.5M10 8.5h5.5V14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M10.5 5.5h-4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}
