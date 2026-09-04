import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      importSource: "react",
      runtime: "automatic"
    }
  },
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    fileParallelism: false,
    globals: true,
    maxWorkers: 1,
    pool: "forks",
    setupFiles: "./vitest.setup.ts"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
