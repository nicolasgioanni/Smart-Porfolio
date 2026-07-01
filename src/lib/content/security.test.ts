import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function collectFiles(directory: string, extensions: string[]): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(entryPath, extensions);
    }

    return extensions.includes(path.extname(entry.name)) ? [entryPath] : [];
  });
}

describe("static portfolio security contracts", () => {
  it("does not define API routes, route handlers, or server actions", () => {
    const appFiles = collectFiles(path.join(projectRoot, "src", "app"), [".ts", ".tsx"]);
    const routeHandlers = appFiles.filter((filePath) => path.basename(filePath).startsWith("route."));
    const serverActionFiles = appFiles.filter((filePath) => readFileSync(filePath, "utf8").includes("\"use server\""));

    expect(routeHandlers).toEqual([]);
    expect(serverActionFiles).toEqual([]);
  });

  it("does not fetch portfolio content at runtime from source files", () => {
    const sourceFiles = collectFiles(path.join(projectRoot, "src"), [".ts", ".tsx"]).filter((filePath) => !filePath.endsWith(".test.ts"));
    const runtimeFetchFiles = sourceFiles.filter((filePath) => readFileSync(filePath, "utf8").includes("fetch("));

    expect(runtimeFetchFiles).toEqual([]);
  });

  it("keeps scroll motion free of text blur", () => {
    const motionCss = readFileSync(path.join(projectRoot, "src", "styles", "motion.css"), "utf8");

    expect(motionCss).not.toMatch(/filter:\s*blur/);
    expect(motionCss).not.toMatch(/transition:[^;]*filter/s);
  });

  it("keeps compact header motion readable and reduced-motion aware", () => {
    const navigationCss = readFileSync(path.join(projectRoot, "src", "styles", "navigation.css"), "utf8");
    const tokensCss = readFileSync(path.join(projectRoot, "src", "styles", "tokens.css"), "utf8");
    const glassCss = readFileSync(path.join(projectRoot, "src", "styles", "glass.css"), "utf8");

    expect(navigationCss).toMatch(/\.blob-header--compact/);
    expect(tokensCss).toMatch(/--header-full-width:\s*966\.667px/);
    expect(tokensCss).toMatch(/--header-compact-width:\s*866\.667px/);
    expect(navigationCss).toMatch(/width:\s*min\(var\(--header-full-width\),\s*83\.333vw,\s*calc\(100%\s*-\s*32px\)\)/);
    expect(navigationCss).toMatch(/width:\s*min\(var\(--header-compact-width\),\s*83\.333vw,\s*calc\(100%\s*-\s*32px\)\)/);
    expect(navigationCss).not.toMatch(/\.blob-header--compact\s*{[^}]*opacity:\s*0\.92/s);
    expect(navigationCss).toMatch(/var\(--transition-header\)/);
    expect(navigationCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(navigationCss).toMatch(/transition:\s*none/);
    expect(navigationCss).not.toMatch(/\.blob-header--compact\s+\.main-navigation__link\s+span\s*{[^}]*display:\s*none/s);
    expect(tokensCss).toMatch(/--color-header-surface:\s*rgba\(7,\s*19,\s*35,\s*0\.94\)/);
    expect(glassCss).toMatch(/\.glass-blob--nav\s*{[^}]*background:\s*var\(--color-header-surface\)/s);
  });

  it("keeps the profile preview centered with a polished close button", () => {
    const navigationCss = readFileSync(path.join(projectRoot, "src", "styles", "navigation.css"), "utf8");

    expect(navigationCss).toMatch(/\.profile-image-preview\s*{(?=[^}]*place-items:\s*center)(?=[^}]*opacity:\s*0)(?=[^}]*transition:\s*opacity 160ms ease)[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview\[data-state="open"\]\s*{(?=[^}]*opacity:\s*1)(?=[^}]*pointer-events:\s*auto)[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview__frame\s*{(?=[^}]*display:\s*grid)(?=[^}]*grid-template-rows:\s*auto auto)(?=[^}]*place-items:\s*center)(?=[^}]*opacity:\s*0)(?=[^}]*transform:\s*translateY\(-6px\)\s*scale\(0\.98\))(?=[^}]*transition:[^}]*opacity 160ms ease,[^}]*transform 160ms ease)[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview\[data-state="open"\]\s+\.profile-image-preview__frame\s*{(?=[^}]*opacity:\s*1)(?=[^}]*transform:\s*translateY\(0\)\s*scale\(1\))[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview__actions\s*{(?=[^}]*display:\s*flex)(?=[^}]*justify-content:\s*flex-end)(?=[^}]*width:\s*100%)[^}]*}/s);
    expect(navigationCss).toMatch(/\.profile-image-preview__close\s*{(?=[^}]*display:\s*inline-flex)(?=[^}]*align-items:\s*center)(?=[^}]*justify-content:\s*center)(?=[^}]*min-width:\s*62px)(?=[^}]*line-height:\s*1)(?=[^}]*background:\s*var\(--color-control-surface\))(?=[^}]*box-shadow:\s*var\(--shadow-card\))[^}]*}/s);
    expect(navigationCss).not.toMatch(/\.profile-image-preview__close\s*{[^}]*(?:position:\s*absolute|top:|bottom:|right:)/s);
    expect(navigationCss).toMatch(/\.profile-image-preview__close:hover\s*{(?=[^}]*border-color:\s*var\(--color-line-strong\))(?=[^}]*color:\s*var\(--color-ink-strong\))(?=[^}]*background:\s*var\(--color-control-surface-strong\))(?=[^}]*box-shadow:\s*var\(--shadow-soft\))(?=[^}]*transform:\s*translateY\(-1px\))[^}]*}/s);
    expect(navigationCss).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.profile-image-preview,[\s\S]*\.profile-image-preview__close[\s\S]*transition:\s*none/);
    expect(navigationCss).not.toMatch(/@keyframes\s+profile-image-preview-in/);
  });
});
