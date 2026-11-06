import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    // Existing browser-storage hydration and cancellable fetch effects predate
    // this Next upgrade. Keep the new compiler advisory visible while retaining
    // their tested behavior; new files keep Next's default error severity.
    files: [
      "components/UnifiedPage.tsx",
      "lib/storage.ts",
      "lib/unified-state.ts",
      "lib/use-tranche-loader.ts",
      "lib/use-vocab-search.ts",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  globalIgnores([
    ".next/**",
    ".claude/worktrees/**",
    "node_modules/**",
    "out/**",
    "dist/**",
    "public/data/**",
    "scripts/**",
    "scratch/**",
  ]),
];

export default eslintConfig;
