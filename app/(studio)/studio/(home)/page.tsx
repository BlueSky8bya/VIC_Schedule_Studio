import { cookies, headers } from "next/headers";
import { StudioShell } from "@/components/studio/studio-shell";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { isMobileUserAgent } from "@/lib/auth/in-app-browser";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";
import { getUnlockState } from "@/lib/private-layer/unlock";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";
import { timed } from "@/lib/perf/perf";

export default async function StudioPage() {
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
    />
  );
}
