import fs from "node:fs";
import path from "node:path";
import { ART_SLOTS, slotFiles } from "@/components/shared/ambient/art/manifest";

// 서버 전용(2026-09-04) — `public/ambient/art/`를 읽어 매니페스트 자리마다 실제로 있는 파일을 돌려준다. 정적 자산 목록뿐(비공개 데이터
// 없음). 아트 보드 라우트와 fixture가 함께 쓴다. stamp = 가장 최근 파일 수정 시각(브라우저 캐시 무효화용 쿼리).
export function readPresentArt(): { present: Record<string, string[]>; stamp: number } {
  const dir = path.join(process.cwd(), "public", "ambient", "art");
  let files = new Set<string>();
  let stamp = 0;
  try {
    const list = fs.readdirSync(dir);
    files = new Set(list);
    for (const f of list) {
      try {
        stamp = Math.max(stamp, Math.floor(fs.statSync(path.join(dir, f)).mtimeMs));
      } catch {
        // 지워지는 중인 파일 — 목록에는 있되 시각은 무시
      }
    }
  } catch {
    // 폴더가 없으면 납품 0장
  }
  const present: Record<string, string[]> = {};
  for (const s of ART_SLOTS) present[s.id] = slotFiles(s).filter((f) => files.has(f));
  return { present, stamp };
}
