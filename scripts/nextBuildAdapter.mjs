import path from "node:path";
import { normalizeNextStaticExportSegments } from "./normalizeNextStaticExport.mjs";

const adapter = {
  name: "portfolio-static-export-integrity",

  async onBuildComplete({ config, projectDir }) {
    if (config.output !== "export") {
      throw new Error("The portfolio build adapter requires Next.js static export mode.");
    }

    const normalizedCount = await normalizeNextStaticExportSegments(path.join(projectDir, "out"));
    console.log(`Normalized ${normalizedCount} Next.js static export segment file(s).`);
  }
};

export default adapter;
