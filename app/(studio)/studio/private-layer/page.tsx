import { PrivateLayerPanel } from "@/components/private-layer/private-layer-panel";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { canEditSchedule } from "@/lib/permissions/roles";
import { setPasscodeAction } from "@/lib/private-layer/actions";

export default async function PrivateLayerPage() {
  const actor = await resolveCurrentActor("vic");

  return (
    <main className="placeholder-page private-layer-page">
      <section className="private-layer-shell">
        <h1>비공개 일정</h1>
        {actor.role === "viewer" || !actor.isAuthenticated ? (
          <div className="auth-warning">
            비공개 일정은 소유자/개발자/매니저/작업자만 사용할 수 있습니다.
          </div>
        ) : (
          <PrivateLayerPanel
            canManage={canEditSchedule(actor.role)}
            setPasscodeAction={setPasscodeAction}
          />
        )}
      </section>
    </main>
  );
}
