import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { StudioShell } from "@/components/studio/studio-shell";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { isMobileUserAgent } from "@/lib/auth/in-app-browser";
import { parseMonthParams } from "@/lib/calendar/month";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";
import { getPasscodeState } from "@/lib/private-layer/passcode-state";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";

type StudioMonthPageProps = {
  params: Promise<{ year: string; month: string }>;
};

// 월 북마크/콜드 엔트리 전용 라우트(런타임 월 이동은 라우트 없이 상태로만 — ADR 참고).
export default async function StudioMonthPage({ params }: StudioMonthPageProps) {
  const { year, month } = await params;
  const [actor, passcode] = await Promise.all([
    resolveCurrentActor("vic"),
    getPasscodeState("vic")
  ]);
  // 시청자(비로그인 포함)는 레이아웃이 `/`로 돌려보내지만, Next는 레이아웃과 페이지를 함께 그려서 그 사이에도 편집실 일정
  // 전체(약 1MB)를 다 만들어 흘려보냈다(2026-11-14 실측: 비로그인 /studio 16초). 페이지에서도 먼저 끊는다.
  if (actor.role === "viewer") redirect("/");
  const schedule = await getStudioSchedule("vic", { actor });
  const mem = parseViewCookie((await cookies()).get(VIEW_COOKIE)?.value);
  const narrow = isMobileUserAgent((await headers()).get("user-agent") ?? "");

  // P1-ROUTE-1: 이 라우트의 존재 이유가 URL이므로 **URL 파라미터가 쿠키보다 우선**한다.
  // (예전엔 params를 통째로 무시하고 쿠키 달을 열어 북마크가 거짓말을 했다.)
  // 검증 실패(범위 밖·비정수)면 쿠키 달 → 그것도 없으면 StudioShell이 KST 현재 달로 연다.
  const urlView = parseMonthParams(year, month);
  const cookieView =
    typeof mem.sy === "number" && typeof mem.sm === "number"
      ? { year: mem.sy, month: mem.sm }
      : undefined;

  return (
    <StudioShell
      actor={actor}
      isDefaultPasscode={passcode.isDefaultPasscode}
      schedule={schedule}
      initialView={urlView ?? cookieView}
      initialViewerMode={mem.v === 1}
      initialNarrow={narrow}
    />
  );
}
