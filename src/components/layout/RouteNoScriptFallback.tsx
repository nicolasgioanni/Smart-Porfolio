import type { ReactNode } from "react";

type RouteNoScriptFallbackProps = {
  children: ReactNode;
  fallback: ReactNode;
};

/**
 * A segment layout sits outside that segment's `loading.tsx` boundary. Keep
 * the complete server page composition in a native no-script branch there so
 * static exports do not leave its loading replacement visible without React.
 */
export function RouteNoScriptFallback({ children, fallback }: RouteNoScriptFallbackProps) {
  return (
    <>
      <noscript>
        <style>{`.site-main > :not(noscript) { display: none !important; }`}</style>
        {fallback}
      </noscript>
      {children}
    </>
  );
}
