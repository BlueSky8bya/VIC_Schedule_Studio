import { notFound, redirect } from "next/navigation";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { AmbientArtSlotView } from "@/components/studio/ambient-art-slot";
import { readPresentArt } from "@/lib/ambient/art-files";
import { ART_SLOTS } from "@/components/shared/ambient/art/manifest";

// 자리 하나의 상세(2026-09-08, PLAN-009 P3) — **변형을 한 화면에서 관리한다**(소유자: "변형들도 한 번 해당 엔티티 버튼
// 누르면 같이 관리할 수 있는 라우팅"). 목록과 같은 개발자 전용 규칙: 시청자·관리자는 /studio로 돌아간다.
// 노출하는 것은 public/ 아래 정적 파일 목록뿐이다(DB·비공개 데이터 없음).
export const dynamic = "force-dynamic";

export default async function AmbientArtSlotPage({ params }: { params: Promise<{ slotId: string }> }) {
  const actor = await resolveCurrentActor("vic");
  if (actor.role !== "developer") redirect("/studio");
  const { slotId } = await params;
  const slot = ART_SLOTS.find((s) => s.id === slotId);
  if (!slot) notFound();
  const { present, stamp } = readPresentArt();
  return <AmbientArtSlotView slotId={slot.id} files={present[slot.id] ?? []} stamp={stamp} />;
}
