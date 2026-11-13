import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { StudioShell } from "@/components/studio/studio-shell";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { isMobileUserAgent } from "@/lib/auth/in-app-browser";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";
import { getPasscodeState } from "@/lib/private-layer/passcode-state";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";
import { timed } from "@/lib/perf/perf";

export default async function StudioPage({
  searchParams
}: {
  searchParams?: Promise<{ panel?: string }>;
}) {
  // P2-ROUTE-1: /studio?panel=tags 딥링크 — 레거시 /studio/tags 리다이렉트의 캐노니컬 도착지.
  // 권한 게이트는 StudioShell이 검사한다(없으면 조용히 무시). (panel=members는 멤버 관리 철수로 제거.)
  const panelParam = (await searchParams)?.panel;
  const initialPanel = panelParam === "tags" ? panelParam : undefined;
  const [actor, passcode] = await Promise.all([
    timed("page:/studio actor", () => resolveCurrentActor("vic")),
    timed("page:/studio passcode", () => getPasscodeState("vic"))
  ]);
  // 시청자(비로그인 포함)는 레이아웃이 `/`로 돌려보내지만, Next는 레이아웃과 페이지를 함께 그려서 그 사이에도 편집실 일정
  // 전체(약 1MB)를 다 만들어 흘려보냈다(2026-11-14 실측: 비로그인 /studio 16초). 페이지에서도 먼저 끊는다.
  if (actor.role === "viewer") redirect("/");
  const schedule = await timed("page:/studio studioSchedule", () =>
    getStudioSchedule("vic", { actor })
  );
  const mem = parseViewCookie((await cookies()).get(VIEW_COOKIE)?.value);
  const narrow = isMobileUserAgent((await headers()).get("user-agent") ?? "");

  return (
    <StudioShell
      actor={actor}
      isDefaultPasscode={passcode.isDefaultPasscode}
      schedule={schedule}
      initialView={
        typeof mem.sy === "number" && typeof mem.sm === "number"
          ? { year: mem.sy, month: mem.sm }
          : undefined
      }
      initialViewerMode={mem.v === 1}
      initialNarrow={narrow}
      initialPanel={initialPanel}
    />
  );
}
