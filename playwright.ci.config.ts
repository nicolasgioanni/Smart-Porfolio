import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const selection = process.env.CI_BROWSER_SELECTION ?? "full";
if (!["full", "functional", "visual"].includes(selection)) {
  throw new Error("CI_BROWSER_SELECTION must be full, functional, or visual");
}

// Keep project names, snapshot paths, retries, workers and file-level serial
// behavior identical to the ordinary configuration. New functional specs are
// discovered automatically; visual specs have one explicit naming contract.
export default defineConfig(base, {
  projects: base.projects?.map((project) => project.name !== "chromium" ? project : {
    ...project,
    ...(selection === "functional" ? { testIgnore: /\.visual\.spec\.[cm]?[jt]sx?$/ } : {}),
    ...(selection === "visual" ? { testMatch: /\.visual\.spec\.[cm]?[jt]sx?$/ } : {})
  })
});
