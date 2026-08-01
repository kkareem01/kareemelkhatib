import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("migrations");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            SETUP_TOKEN: "test-setup-token-for-vitest-only",
            DEV: "1",
          },
        },
      }),
    ],
    resolve: {
      // tslib ships CJS by default; workerd needs the ESM build for the
      // named exports @simplewebauthn's dependency chain imports.
      alias: { tslib: "tslib/tslib.es6.js" },
    },
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      deps: {
        optimizer: {
          ssr: {
            enabled: true,
            include: ["@simplewebauthn/server"],
          },
        },
      },
    },
  };
});
