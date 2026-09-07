import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".scratch-pw/**",
      "tmp/**", // 코덱스·에이전트 작업 폴더(생성 스크립트·검증 로그) — 커밋도 검사도 하지 않는다

      "next-env.d.ts"
    ]
  },
  js.configs.recommended,
  ...compat.extends("next/core-web-vitals", "next/typescript")
];

export default eslintConfig;
