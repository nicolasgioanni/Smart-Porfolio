import type { ThemeName } from "@/lib/theme/resolveThemeName";
import { themeStorageKey } from "@/lib/theme/themePreference";

type ThemePreferenceScriptProps = {
  initialTheme: ThemeName;
};

export function ThemePreferenceScript({ initialTheme }: ThemePreferenceScriptProps) {
  const script = `try{var t=window.localStorage.getItem("${themeStorageKey}");if(t==="navy"||t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}else{document.documentElement.dataset.theme="${initialTheme}";}}catch(e){document.documentElement.dataset.theme="${initialTheme}";}`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
