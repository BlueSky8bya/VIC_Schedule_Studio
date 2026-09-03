import { cookies, headers } from "next/headers";
import { StudioShell } from "@/components/studio/studio-shell";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { isMobileUserAgent } from "@/lib/auth/in-app-browser";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";
import { getUnlockState } from "@/lib/private-layer/unlock";
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
  const [actor, unlock] = await Promise.all([
    timed("page:/studio actor", () => resolveCurrentActor("vic")),
    timed("page:/studio unlock", () => getUnlockState("vic"))
  ]);
  const schedule = await timed("page:/studio studioSchedule", () =>
    getStudioSchedule("vic", { actor, unlock })
  );
  const mem = parseViewCookie((await cookies()).get(VIEW_COOKIE)?.value);
  const narrow = isMobileUserAgent((await headers()).get("user-agent") ?? "");

  return (
    <StudioShell
      actor={actor}
      hasUnlockSession={unlock.hasUnlockSession}
      isDefaultPasscode={unlock.isDefaultPasscode}
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
