import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Spies never leak between tests.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,

    // `tsc -b` emits compiled copies of the test files; run the sources only.
    exclude: ["**/node_modules/**", "**/dist/**"],

    coverage: {
      // Required in Vitest 4 — without it, untested files are invisible to coverage.
      include: ["plugins/**/references/example/src/**"],
    },
  },
})
