import { StudioShell } from "@/components/studio/studio-shell";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";

export default async function StudioPage() {
  const schedule = await getStudioSchedule("vic");

  return <StudioShell schedule={schedule} viewerRole="owner" />;
}
