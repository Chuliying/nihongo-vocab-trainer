import { globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import nextVitals from "eslint-config-next/core-web-vitals.js";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.config(nextVitals),
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "dist/**",
    "public/data/**",
    "scripts/**",
    "scratch/**",
  ]),
];

export default eslintConfig;
