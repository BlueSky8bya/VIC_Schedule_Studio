import { cookies } from "next/headers";
import { PublicPoster } from "@/components/poster/public-poster";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";
import { canDecorate, canEditSchedule, canManageStickerAssets } from "@/lib/permissions/roles";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { isPosterThemeKey } from "@/lib/domain/schedule-types";
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

  // 테마는 getPublicSchedule(SWR 캐시)라 방금 바꾸면 첫 새로고침에 옛 값이 보인다. 꾸미기 화면은
  // 소유자 전용·저트래픽이므로, poster_theme만 DB에서 신선하게 한 번 더 읽어 덮는다(공개 / 캐시는
  // 그대로 두어 시청자 성능 유지). 읽기 실패 시 캐시값 그대로.
  let scheduleFresh = schedule;
  try {
    const sb = await createSupabaseServerClient();
    const { data } = sb
      ? await sb.from("calendars").select("poster_theme").eq("slug", "vic").maybeSingle()
      : { data: null };
    const t = data?.poster_theme;
    if (typeof t === "string" && isPosterThemeKey(t) && t !== schedule.calendar.posterTheme) {
      scheduleFresh = { ...schedule, calendar: { ...schedule.calendar, posterTheme: t } };
    }
  } catch {
    /* 신선 읽기 실패 → 캐시 테마 그대로 */
  }

  // 새로고침 복원: 쿠키에 기록된 마지막 꾸미기 달이 있으면 그 달로 연다(없으면 URL의 연·월).
  // 진입 버튼이 쿠키를 진입 월로 세팅하므로, 새 진입은 의도한 달, 이후 월 이동·새로고침은 그 달.
  const mem = parseViewCookie((await cookies()).get(VIEW_COOKIE)?.value);
  const initialYear = mem.dy ?? Number(year);
  const initialMonth = mem.dm ?? Number(month);
  // 매니저는 기존 이모지로 꾸미기'만' — 커스텀 이모지 업로드·삭제 액션은 넘기지 않아 UI도 숨는다.
  const canAssets = canManageStickerAssets(actor.role, actor.isWorker === true);

  return (
    <PublicPoster
      canExport
      decorate
      initialPreviewing={mem.dp === 1}
      deleteStickerAction={deleteStickerAction}
      deleteStickerAssetAction={canAssets ? deleteStickerAssetAction : undefined}
      deleteStickerBatchAction={deleteStickerBatchAction}
      initialMonth={initialMonth}
      initialYear={initialYear}
      saveStickerAction={saveStickerAction}
      saveStickerBatchAction={saveStickerBatchAction}
      schedule={scheduleFresh}
      setPosterThemeAction={canEditSchedule(actor.role) ? setPosterThemeAction : undefined}
      uploadStickerAssetAction={canAssets ? uploadStickerAssetAction : undefined}
    />
  );
}
