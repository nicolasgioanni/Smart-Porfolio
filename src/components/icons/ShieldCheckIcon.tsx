import type { SVGProps } from "react";

export function ShieldCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      {...props}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 3 19 6v5.2c0 4.4-2.8 8.1-7 9.8-4.2-1.7-7-5.4-7-9.8V6l7-3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.8 11.8 2.1 2.1 4.4-4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
