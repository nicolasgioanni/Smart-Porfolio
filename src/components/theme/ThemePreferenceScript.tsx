// This complete, immutable first-paint program uses the server-rendered root
// data-theme as its fallback. Do not interpolate values into it: it runs before
// React can apply its normal content escaping guarantees.
const themePreferenceScript =
  "(function(){var d=document.documentElement;var t=d.dataset.theme;if([\"navy\",\"light\",\"dark\"].indexOf(t)===-1){t=\"navy\";}var s=null;try{var v=window.localStorage.getItem(\"portfolio-theme\");if(typeof v===\"string\"){s=v.trim().toLowerCase();}}catch(e){}if([\"navy\",\"light\",\"dark\"].indexOf(s)!==-1){t=s;}else{try{if(typeof window.matchMedia===\"function\"){t=window.matchMedia(\"(prefers-color-scheme: dark)\").matches?\"dark\":\"light\";}}catch(e){}}d.dataset.theme=t;}());";

export function createThemePreferenceScript() {
  return themePreferenceScript;
}

export function ThemePreferenceScript() {
  return <script dangerouslySetInnerHTML={{ __html: themePreferenceScript }} />;
}
