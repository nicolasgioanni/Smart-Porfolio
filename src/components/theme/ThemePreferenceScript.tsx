import type { ThemeName } from "@/lib/theme/resolveThemeName";

type ThemePreferenceScriptProps = {
  initialTheme: ThemeName;
};

// These are immutable complete programs, selected by a server-validated theme
// name. Do not interpolate values into this first-paint script: it runs before
// React can apply its normal content escaping guarantees.
const themePreferenceScripts: Record<ThemeName, string> = {
  navy: "(function(){var d=document.documentElement;var t=\"navy\";var s=null;try{var v=window.localStorage.getItem(\"portfolio-theme\");if(typeof v===\"string\"){s=v.trim().toLowerCase();}}catch(e){}if([\"navy\",\"light\",\"dark\"].indexOf(s)!==-1){t=s;}else{try{if(typeof window.matchMedia===\"function\"){t=window.matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\";}}catch(e){}}d.dataset.theme=t;}());",
  light: "(function(){var d=document.documentElement;var t=\"light\";var s=null;try{var v=window.localStorage.getItem(\"portfolio-theme\");if(typeof v===\"string\"){s=v.trim().toLowerCase();}}catch(e){}if([\"navy\",\"light\",\"dark\"].indexOf(s)!==-1){t=s;}else{try{if(typeof window.matchMedia===\"function\"){t=window.matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\";}}catch(e){}}d.dataset.theme=t;}());",
  dark: "(function(){var d=document.documentElement;var t=\"dark\";var s=null;try{var v=window.localStorage.getItem(\"portfolio-theme\");if(typeof v===\"string\"){s=v.trim().toLowerCase();}}catch(e){}if([\"navy\",\"light\",\"dark\"].indexOf(s)!==-1){t=s;}else{try{if(typeof window.matchMedia===\"function\"){t=window.matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\";}}catch(e){}}d.dataset.theme=t;}());"
};

export function createThemePreferenceScript(initialTheme: ThemeName) {
  return themePreferenceScripts[initialTheme];
}

export function ThemePreferenceScript({ initialTheme }: ThemePreferenceScriptProps) {
  const script = createThemePreferenceScript(initialTheme);

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
