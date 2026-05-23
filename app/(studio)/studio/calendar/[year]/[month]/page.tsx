import { StudioShell } from "@/components/studio/studio-shell";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";
import { getUnlockState } from "@/lib/private-layer/unlock";

export default async function StudioMonthPage() {
  const [actor, schedule, unlock] = await Promise.all([
    resolveCurrentActor("vic"),
    getStudioSchedule("vic"),
    getUnlockState("vic")
  ]);

  return (
    <StudioShell
      actor={actor}
      hasUnlockSession={unlock.hasUnlockSession}
      schedule={schedule}
    />
  );
}
