import { cookies, headers } from "next/headers";
// 스튜디오 CSS는 여기(StudioShell 렌더 페이지)에서 page-level import → <head> 렌더 차단으로 올라가
// 모바일 첫 진입 FOUC 방지. 공개 `/`(루트)는 이 import가 없어 스튜디오 CSS를 받지 않는다.
import "@/components/studio/studio-shell.css";
import { StudioShell } from "@/components/studio/studio-shell";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { isMobileUserAgent } from "@/lib/auth/in-app-browser";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";
import { getUnlockState } from "@/lib/private-layer/unlock";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";

export default async function StudioPage() {
  const [actor, unlock] = await Promise.all([
    resolveCurrentActor("vic"),
    getUnlockState("vic")
  ]);
  const schedule = await getStudioSchedule("vic", { actor, unlock });
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
    />
  );
}
