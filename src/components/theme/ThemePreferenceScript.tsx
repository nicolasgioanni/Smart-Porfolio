import { themeNames, type ThemeName } from "@/lib/theme/resolveThemeName";
import { systemThemeMediaQuery, themeStorageKey } from "@/lib/theme/themePreference";

type ThemePreferenceScriptProps = {
  initialTheme: ThemeName;
};

export function createThemePreferenceScript(initialTheme: ThemeName) {
  const fallback = JSON.stringify(initialTheme);
  const mediaQuery = JSON.stringify(systemThemeMediaQuery);
  const storageKey = JSON.stringify(themeStorageKey);
  const supportedThemes = JSON.stringify(themeNames);

  return `(function(){var d=document.documentElement;var t=${fallback};var s=null;try{var v=window.localStorage.getItem(${storageKey});if(typeof v==="string"){s=v.trim().toLowerCase();}}catch(e){}if(${supportedThemes}.indexOf(s)!==-1){t=s;}else{try{if(typeof window.matchMedia==="function"){t=window.matchMedia(${mediaQuery}).matches?"dark":"light";}}catch(e){}}d.dataset.theme=t;}());`;
}

export function ThemePreferenceScript({ initialTheme }: ThemePreferenceScriptProps) {
  const script = createThemePreferenceScript(initialTheme);

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
