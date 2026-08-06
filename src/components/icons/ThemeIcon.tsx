import type { SVGProps } from "react";

export function ThemeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" height="18" viewBox="0 0 24 24" width="18" {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17v-17Z" fill="currentColor" opacity="0.3" />
      <path d="M12 3.5v17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
