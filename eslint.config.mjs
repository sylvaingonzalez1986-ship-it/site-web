import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// package.json overrides @next/eslint-plugin-next@16.3.8's fast-glob with
// tinyglobby@0.2.17 to remove the dependency affected by GHSA-vfj7-8cjw-p6xm.
// This is scoped to this single-root config: without settings.next.rootDir,
// Next's getRootDirs returns context.cwd and never calls the aliased globSync.
// The packages are not generally interchangeable (directory expansion and
// absolute paths differ). Remove or adapt the override before adding rootDir
// or a multi-root config; src/test/eslint-config.test.ts guards this boundary.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
