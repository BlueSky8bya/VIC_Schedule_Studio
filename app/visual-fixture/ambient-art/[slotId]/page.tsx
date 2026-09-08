import { notFound } from "next/navigation";
import { AmbientArtSlotView } from "@/components/studio/ambient-art-slot";
import { readPresentArt } from "@/lib/ambient/art-files";
import { ART_SLOTS } from "@/components/shared/ambient/art/manifest";

// 자리 상세 fixture(2026-09-08, PLAN-009 P3) — 인증 없이 상세 UI를 실측한다. `VISUAL_TEST_FIXTURE=1`일 때만 열린다(프로덕션 404).
// 실제 라우트(/studio/ambient-art/<자리>)에는 개발자 가드가 붙는다 — 여기서는 UI만.
export const dynamic = "force-dynamic";

export default async function AmbientArtSlotFixture({ params }: { params: Promise<{ slotId: string }> }) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const { slotId } = await params;
  const slot = ART_SLOTS.find((s) => s.id === slotId);
  if (!slot) notFound();
  const { present, stamp } = readPresentArt();
  return <AmbientArtSlotView slotId={slot.id} files={present[slot.id] ?? []} stamp={stamp} />;
}
