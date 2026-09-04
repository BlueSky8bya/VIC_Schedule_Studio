import { redirect } from "next/navigation";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { AmbientArtBoard } from "@/components/studio/ambient-art-board";
import { readPresentArt } from "@/lib/ambient/art-files";

// 계절 배경 아트 보드(2026-09-04) — **개발자 전용** 관리 라우트. 매니페스트의 자리마다 `public/ambient/art/`에 파일이 있는지 서버가
// 폴더를 읽어 알려 준다(정적 파일이라 DB·비공개 데이터 없음). 관리자·시청자는 /studio로 돌려보낸다((studio) 레이아웃이 시청자를
// 먼저 막는다). 정적 자산 외 아무것도 노출하지 않는다.
export const dynamic = "force-dynamic";

export default async function AmbientArtPage() {
  const actor = await resolveCurrentActor("vic");
  if (actor.role !== "developer") redirect("/studio");
  const { present, stamp } = readPresentArt();
  return <AmbientArtBoard present={present} stamp={stamp} />;
}
