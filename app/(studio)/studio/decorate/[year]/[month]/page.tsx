import { cookies } from "next/headers";
import { PublicPoster } from "@/components/poster/public-poster";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";
import { canDecorate, canEditSchedule } from "@/lib/permissions/roles";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import {
  deleteStickerAction,
  deleteStickerBatchAction,
  saveStickerAction,
  saveStickerBatchAction
} from "@/lib/schedules/sticker-actions";
import {
  deleteStickerAssetAction,
  uploadStickerAssetAction
} from "@/lib/schedules/sticker-asset-actions";
import { setPosterThemeAction } from "@/lib/schedules/theme-actions";

type StudioDecoratePageProps = {
  params: Promise<{ year: string; month: string }>;
};

// 꾸미기 화면 — 토리님·작업자·매니저. 시청자가 보는 월간 일정표 위에 이모지를 올리고,
// canExport로 캡처도 할 수 있다. 스티커는 달(월)마다 따로 저장된다.
export default async function StudioDecoratePage({ params }: StudioDecoratePageProps) {
  const { year, month } = await params;
  // 권한 확인(actor)과 공개 일정 로드를 병렬로 — 공개 데이터는 캐시되어 있어 권한 없는
  // 사용자가 잠깐 함께 불러도 비용이 거의 없고, 통과하는 대부분의 경우 왕복 한 번을 줄인다.
  const [actor, schedule] = await Promise.all([
    resolveCurrentActor("vic"),
    getPublicSchedule("vic")
  ]);

  if (!canDecorate(actor.role)) {
    return (
      <main className="placeholder-page">
        <h1>꾸미기</h1>
        <div className="auth-warning">토리님·작업자·매니저만 꾸밀 수 있습니다.</div>
      </main>
    );
  }

  // 새로고침 복원: 쿠키에 기록된 마지막 꾸미기 달이 있으면 그 달로 연다(없으면 URL의 연·월).
  // 진입 버튼이 쿠키를 진입 월로 세팅하므로, 새 진입은 의도한 달, 이후 월 이동·새로고침은 그 달.
  const mem = parseViewCookie((await cookies()).get(VIEW_COOKIE)?.value);
  const initialYear = mem.dy ?? Number(year);
  const initialMonth = mem.dm ?? Number(month);

  return (
    <PublicPoster
      canExport
      decorate
      initialPreviewing={mem.dp === 1}
      deleteStickerAction={deleteStickerAction}
      deleteStickerAssetAction={deleteStickerAssetAction}
      deleteStickerBatchAction={deleteStickerBatchAction}
      initialMonth={initialMonth}
      initialYear={initialYear}
      saveStickerAction={saveStickerAction}
      saveStickerBatchAction={saveStickerBatchAction}
      schedule={schedule}
      setPosterThemeAction={canEditSchedule(actor.role) ? setPosterThemeAction : undefined}
      uploadStickerAssetAction={uploadStickerAssetAction}
    />
  );
}
