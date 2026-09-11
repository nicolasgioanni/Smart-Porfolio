import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { experienceOverrideSummary } from "./experienceOverride";

// This isolated server renderer uses the classic runtime through tsx.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const { ExperiencePageSkeleton } = await import("../../src/components/loading/ExperiencePageSkeleton");

process.stdout.write(
  renderToStaticMarkup(
    createElement(ExperiencePageSkeleton, {
      headerContent: { profile: { experienceSummary: experienceOverrideSummary } }
    })
  )
);
