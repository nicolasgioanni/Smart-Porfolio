import type { ThemeName } from "@/lib/theme/resolveThemeName";

const storageKey = "portfolio-theme";

type ThemePreferenceScriptProps = {
  initialTheme: ThemeName;
};

export function ThemePreferenceScript({ initialTheme }: ThemePreferenceScriptProps) {
  const script = `try{var t=window.localStorage.getItem("${storageKey}");if(t==="navy"||t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}else{document.documentElement.dataset.theme="${initialTheme}";}}catch(e){document.documentElement.dataset.theme="${initialTheme}";}`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
