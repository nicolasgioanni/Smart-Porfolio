import type { Page } from "@playwright/test";

export type StandaloneDocumentSource = {
  bodyAttributes: [string, string][];
  htmlAttributes: [string, string][];
  stylesheetHrefs: string[];
};

type StandaloneDocumentOptions = {
  mainClassName?: string;
  markerAttribute: string;
};

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function serializeAttributes(attributes: [string, string][]): string {
  return attributes.map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(" ");
}

export function createStandaloneDocument(
  source: StandaloneDocumentSource,
  markup: string,
  { mainClassName, markerAttribute }: StandaloneDocumentOptions
): string {
  const stylesheets = source.stylesheetHrefs
    .map((href) => `<link data-skeleton-visual-stylesheet rel="stylesheet" href="${escapeAttribute(href)}">`)
    .join("");
  const mainAttributes = [mainClassName ? `class="${escapeAttribute(mainClassName)}"` : null, markerAttribute]
    .filter(Boolean)
    .join(" ");

  return `<!doctype html>
<html ${serializeAttributes(source.htmlAttributes)}>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${stylesheets}
  </head>
  <body ${serializeAttributes(source.bodyAttributes)}>
    <main ${mainAttributes}>${markup}</main>
  </body>
</html>`;
}

export async function collectStandaloneDocumentSource(page: Page): Promise<StandaloneDocumentSource> {
  const source = (await page.evaluate(() => ({
    bodyAttributes: Array.from(document.body.attributes, ({ name, value }) => [name, value]),
    htmlAttributes: Array.from(document.documentElement.attributes, ({ name, value }) => [name, value]),
    stylesheetHrefs: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), (link) => link.href)
  }))) as StandaloneDocumentSource;

  if (source.stylesheetHrefs.length === 0) {
    throw new Error("The source shell did not expose a compiled stylesheet href for the standalone skeleton fixture.");
  }
  if (!source.bodyAttributes.some(([name]) => name === "class")) {
    throw new Error("The source shell did not expose the generated body font class for the standalone skeleton fixture.");
  }

  return source;
}

export async function waitForStandaloneDocumentAssets(
  page: Page,
  source: StandaloneDocumentSource
): Promise<void> {
  await page.waitForFunction((hrefs) => {
    const stylesheets = Array.from(document.querySelectorAll<HTMLLinkElement>("[data-skeleton-visual-stylesheet]"));
    return hrefs.every((href) => stylesheets.some((stylesheet) => stylesheet.href === href && stylesheet.sheet));
  }, source.stylesheetHrefs);
  const fontLoaded = await page.evaluate(async () => {
    await document.fonts.load('16px "Space Grotesk"');
    await document.fonts.ready;
    return document.fonts.check('16px "Space Grotesk"');
  });
  if (!fontLoaded) throw new Error("The standalone skeleton fixture did not load Space Grotesk.");
}
