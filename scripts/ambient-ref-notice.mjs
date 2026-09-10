// 엔티티 레퍼런스 출처 목록 재굽기. 공통화풍참고는 별도 자료다. --check는 읽기 전용이다.
// node scripts/ambient-ref-notice.mjs [--check]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artManifest, root } from "./lib/ambient-art-manifest.mjs";
import { updateReferenceNotice } from "./lib/ambient-ref-library.mjs";

export function noticeMain(args = process.argv.slice(2), { workspaceRoot = root, manifest = artManifest(), logger = console } = {}) {
  if (args.some((arg) => arg !== "--check")) throw new Error("Usage: ambient-ref-notice.mjs [--check]");
  const check = args.includes("--check");
  const result = updateReferenceNotice({ workspaceRoot, manifest, check });
  if (!result.ok) {
    logger.error("문제:");
    for (const problem of result.problems) logger.error(`  · ${problem}`);
    return 1;
  }
  logger.log(check ? `NOTICE.md 최신 (${result.total}장).` : `NOTICE.md 다시 구웠다 — ${result.total}장.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = noticeMain(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
