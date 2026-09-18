import { redirect } from "next/navigation";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { getDictionaryDraftAction } from "@/lib/search/dictionary-actions";
import { SearchDictionaryBoard } from "@/components/studio/search-dictionary-board";

// 은어 사전 초안(0090, 2026-09-18) — **개발자 전용** 관리 라우트. 다시보기 채팅에서 새로 배운 말(사전·인물·제목에 없는 말)에
// 뜻을 달거나 무시한다. 설정 모달의 '은어 사전 초안 → 열기'에서 온다. 관리자·시청자는 /studio로.
// 채팅 원문·닉은 존재하지 않는다(0088 저장 원칙) — 단어·방송 수·날짜·예시 제목만 다룬다.
export const dynamic = "force-dynamic";

export default async function SearchDictionaryPage() {
  const actor = await resolveCurrentActor("vic");
  if (actor.role !== "developer") redirect("/studio");
  const draft = await getDictionaryDraftAction(300);
  return <SearchDictionaryBoard error={draft.ok ? null : draft.error} rows={draft.ok ? draft.rows : []} />;
}
