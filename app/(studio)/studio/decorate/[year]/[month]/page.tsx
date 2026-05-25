import { PublicPoster } from "@/components/poster/public-poster";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { canDecorate, canEditSchedule } from "@/lib/permissions/roles";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { deleteStickerAction, saveStickerAction } from "@/lib/schedules/sticker-actions";
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
  const actor = await resolveCurrentActor("vic");

  if (!canDecorate(actor.role)) {
    return (
      <main className="placeholder-page">
        <h1>꾸미기</h1>
        <div className="auth-warning">토리님·작업자·매니저만 꾸밀 수 있습니다.</div>
      </main>
    );
  }

  const schedule = await getPublicSchedule("vic");

  return (
    <PublicPoster
      canExport
      decorate
      deleteStickerAction={deleteStickerAction}
      deleteStickerAssetAction={deleteStickerAssetAction}
      initialMonth={Number(month)}
      initialYear={Number(year)}
      saveStickerAction={saveStickerAction}
      schedule={schedule}
      setPosterThemeAction={canEditSchedule(actor.role) ? setPosterThemeAction : undefined}
      uploadStickerAssetAction={uploadStickerAssetAction}
    />
  );
}
