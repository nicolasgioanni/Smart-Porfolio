// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { evaluatePayloadBudget, publicRoutes } from "./payloadBudget.mjs";

const directories = [];

function routeFile(route) {
  return route === "/" ? "index.html" : `${route.slice(1)}.html`;
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-payload-budget-"));
  directories.push(root);
  const output = path.join(root, "out");
  const next = path.join(root, ".next");
  const chunks = path.join("static", "chunks");
  await Promise.all([
    mkdir(path.join(output, "_next", chunks), { recursive: true }),
    mkdir(path.join(next, chunks), { recursive: true }),
    mkdir(path.join(output, "images", "research"), { recursive: true })
  ]);
  const shared = "window.__sharedFramework = true;";
  await Promise.all([
    writeFile(path.join(output, "_next", chunks, "shared.js"), shared),
    writeFile(path.join(next, chunks, "shared.js"), shared),
    writeFile(path.join(output, "images", "research", "cytocv-supplementary-video-s1.mp4"), Buffer.alloc(100, 1)),
    writeFile(path.join(output, "images", "research", "cytocv-supplementary-video-s1.en.vtt"), "WEBVTT\n"),
    writeFile(path.join(output, "images", "research", "cytocv-supplementary-video-s1-transcript.txt"), "Transcript\n"),
    writeFile(path.join(output, "images", "research", "cytocv-graphical-abstract.png"), Buffer.alloc(24, 2))
  ]);

  const routes = {};
  for (const route of publicRoutes) {
    const unique = `window.__route = ${JSON.stringify(route)};`;
    const chunkName = `${route === "/" ? "home" : route.slice(1)}.js`;
    await Promise.all([
      writeFile(path.join(output, "_next", chunks, chunkName), unique),
      writeFile(path.join(next, chunks, chunkName), unique)
    ]);
    const video = route === "/research" ? '<video src="/images/research/cytocv-supplementary-video-s1.mp4"></video>' : "";
    const html = `<main>${route}${video}</main><script src="/_next/static/chunks/shared.js"></script><script src="/_next/static/chunks/${chunkName}"></script>`;
    await writeFile(path.join(output, routeFile(route)), html);
    routes[route] = {
      htmlGzip: gzipSync(html).byteLength,
      initialJsGzip: gzipSync(shared).byteLength + gzipSync(unique).byteLength,
      videoMarkup: route === "/research"
    };
  }
  return {
    output,
    next,
    baseline: {
      measurement: {
        frameworkInitialJsGzip: gzipSync(shared).byteLength,
        slack: { htmlGzip: 1, initialJsGzip: 1, frameworkInitialJsGzip: 1, assetRoleBytes: 1 }
      },
      routes,
      assetRoles: { "research-video": 100, "research-caption": 7, "research-transcript": 11, "research-graphical-abstract": 24 }
    }
  };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("published payload budgets", () => {
  it("measures all eleven public routes, published chunks, shared framework chunks, and reviewed asset roles", async () => {
    const subject = await fixture();
    await expect(evaluatePayloadBudget({ outputDirectory: subject.output, nextDirectory: subject.next, baseline: subject.baseline })).resolves.toMatchObject({
      frameworkInitialJsFiles: 1,
      assetRoles: { "research-video": 100 }
    });
  });

  it("fails a route budget and catches source/published chunk divergence", async () => {
    const subject = await fixture();
    subject.baseline.routes["/"].htmlGzip = 1;
    await expect(evaluatePayloadBudget({ outputDirectory: subject.output, nextDirectory: subject.next, baseline: subject.baseline })).rejects.toThrow("HTML gzip");

    const second = await fixture();
    await writeFile(path.join(second.output, "_next", "static", "chunks", "shared.js"), "tampered published chunk");
    await expect(evaluatePayloadBudget({ outputDirectory: second.output, nextDirectory: second.next, baseline: second.baseline })).rejects.toThrow("differs from .next");
  });

  it("rejects Research video/data outside Research and oversized role-specific media without a generic cap", async () => {
    const subject = await fixture();
    const permissive = structuredClone(subject.baseline);
    permissive.measurement.slack.htmlGzip = 3;
    await writeFile(path.join(subject.output, "projects.html"), '<main>cytocv-supplementary-video-s1.mp4</main><script src="/_next/static/chunks/shared.js"></script><script src="/_next/static/chunks/projects.js"></script>');
    await expect(evaluatePayloadBudget({ outputDirectory: subject.output, nextDirectory: subject.next, baseline: permissive })).rejects.toThrow("Research-only video or project data");

    const second = await fixture();
    await writeFile(path.join(second.output, "images", "research", "cytocv-supplementary-video-s1.mp4"), Buffer.alloc(101, 1));
    await expect(evaluatePayloadBudget({ outputDirectory: second.output, nextDirectory: second.next, baseline: second.baseline })).rejects.toThrow("research-video asset");
  });
});
