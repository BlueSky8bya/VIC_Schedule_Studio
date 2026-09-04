import fs from "node:fs";
import path from "node:path";
import { ART_SLOTS, slotFiles, type ArtFileInfo, type PresentArt } from "@/components/shared/ambient/art/manifest";

// 서버 전용(2026-09-04) — `public/ambient/art/`를 읽어 매니페스트 자리마다 실제로 있는 파일(크기·픽셀)을 돌려준다. 정적 자산 목록뿐(비공개
// 데이터 없음). 아트 보드 라우트와 fixture가 함께 쓴다. stamp = 가장 최근 파일 수정 시각(브라우저 캐시 무효화용 쿼리).
// 픽셀 크기는 PNG IHDR(16~24바이트)만 읽는다 — sharp 없이, 파일당 24바이트. (클라이언트가 쓰는 타입·targetEdge는 manifest.ts에 —
// 이 파일은 node:fs를 import해 클라이언트 번들에 들어가면 안 된다.)

function pngSize(p: string): { w: number; h: number } {
  try {
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    fs.closeSync(fd);
    if (buf.toString("ascii", 1, 4) !== "PNG") return { w: 0, h: 0 };
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    return { w: 0, h: 0 };
  }
}

export function readPresentArt(): { present: PresentArt; stamp: number } {
  const dir = path.join(process.cwd(), "public", "ambient", "art");
  const info = new Map<string, ArtFileInfo>();
  let stamp = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".png")) continue;
      try {
        const st = fs.statSync(path.join(dir, f));
        stamp = Math.max(stamp, Math.floor(st.mtimeMs));
        info.set(f, { file: f, bytes: st.size, ...pngSize(path.join(dir, f)) });
      } catch {
        // 지워지는 중인 파일 — 건너뛴다
      }
    }
  } catch {
    // 폴더가 없으면 납품 0장
  }
  const present: PresentArt = {};
  for (const s of ART_SLOTS) present[s.id] = slotFiles(s).flatMap((f) => (info.has(f) ? [info.get(f)!] : []));
  return { present, stamp };
}
