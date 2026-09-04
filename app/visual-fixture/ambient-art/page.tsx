import { notFound } from "next/navigation";
import { AmbientArtBoard } from "@/components/studio/ambient-art-board";
import { readPresentArt } from "@/lib/ambient/art-files";

// 아트 보드 fixture(2026-09-04) — 인증 없이 보드 UI를 실측하기 위한 페이지. `VISUAL_TEST_FIXTURE=1`일 때만 열린다(프로덕션 404).
// 실제 라우트(/studio/ambient-art)는 개발자 가드가 붙는다 — 여기서는 UI만.
export const dynamic = "force-dynamic";

export default function AmbientArtFixture() {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const { present, stamp } = readPresentArt();
  return <AmbientArtBoard present={present} stamp={stamp} />;
}
