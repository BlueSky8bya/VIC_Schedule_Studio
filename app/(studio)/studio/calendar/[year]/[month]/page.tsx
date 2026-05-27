import { cookies } from "next/headers";
import { StudioShell } from "@/components/studio/studio-shell";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";
import { getUnlockState } from "@/lib/private-layer/unlock";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";

export default async function StudioMonthPage() {
  const [actor, unlock] = await Promise.all([
    resolveCurrentActor("vic"),
    getUnlockState("vic")
  ]);
  const schedule = await getStudioSchedule("vic", { actor, unlock });
  const mem = parseViewCookie((await cookies()).get(VIEW_COOKIE)?.value);

  return (
    <StudioShell
      actor={actor}
      hasUnlockSession={unlock.hasUnlockSession}
      schedule={schedule}
      initialView={
        typeof mem.sy === "number" && typeof mem.sm === "number"
          ? { year: mem.sy, month: mem.sm }
          : undefined
      }
      initialViewerMode={mem.v === 1}
    />
  );
}
