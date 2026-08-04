import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 시청자 미리보기 스냅샷은 **진행 중 쓰기가 끝난 뒤에** 받아야 한다.
// 예전엔 viewerMode가 켜지는 순간 곧바로 받아서, 방금 누른 저장이 아직 날아가는 중인
// 스냅샷(= 저장 전 상태)을 잡았다. 그 stale 값이 previewSnapshot에 눌러앉아
// router.refresh()가 가져온 새 데이터까지 가려, 몇 초 기다리거나 편집실을 나갔다
// 다시 들어와야 반영됐다(2026-08-04 실측: stillMasked=1 · pastSec=16).
const SRC = fs.readFileSync(path.join(process.cwd(), "components/studio/studio-shell.tsx"), "utf8");
const CODE = SRC.split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

describe("미리보기 스냅샷 — 쓰기 flush 뒤에 받는다", () => {
  it("enterViewerMode가 flush 뒤에 스냅샷을 다시 받는다", () => {
    const block = CODE.slice(
      CODE.indexOf("function enterViewerMode"),
      CODE.indexOf("const [viewerMode, setViewerMode]")
    );
    const flushAt = block.indexOf("await flushPendingWrites()");
    const fetchAt = block.indexOf("refreshPreviewSnapshot(");
    expect(flushAt).toBeGreaterThanOrEqual(0);
    expect(fetchAt).toBeGreaterThan(flushAt);
  });

  it("viewerMode 변화만으로 매번 받아오지 않는다(차가운 진입 1회만)", () => {
    expect(CODE).toContain("coldPreviewFetchedRef");
    expect(CODE).not.toContain("if (!viewerMode) return;\n    let alive = true;\n    getPublicPreviewAction()");
  });

  it("늦게 온 옛 응답이 새 응답을 덮지 않는다", () => {
    expect(CODE).toContain("previewSeqRef");
    expect(CODE).toContain("seq === previewSeqRef.current");
  });
});
