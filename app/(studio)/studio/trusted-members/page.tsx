import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { canEditSchedule } from "@/lib/permissions/roles";

type TrustedMemberRow = {
  id: string;
  email: string;
  display_name: string | null;
  trusted_role: "manager" | "worker";
  can_view_embargo: boolean;
  can_view_work: boolean;
  is_active: boolean;
};

export default async function TrustedMembersPage() {
  const actor = await resolveCurrentActor("vic");
  const supabase = createSupabaseAdminClient();
  const members =
    canEditSchedule(actor.role) && supabase ? await getTrustedMembers(supabase) : [];

  return (
    <main className="placeholder-page trusted-members-page">
      <section className="trusted-members-panel">
        <p className="eyebrow">VIC Studio</p>
        <h1>매니저 / 작업자 권한</h1>
        <p>
          owner가 여기에 Google 이메일을 등록하면, 해당 사용자는 Google 로그인
          후 매니저 또는 작업자 화면으로 이동합니다. 등록되지 않은 계정은 전부
          일반 시청자로 처리됩니다.
        </p>

        {!canEditSchedule(actor.role) ? (
          <div className="auth-warning">
            이 화면은 owner 또는 developer만 수정할 수 있습니다. 현재 역할: {actor.role}
          </div>
        ) : null}

        {!supabase ? (
          <div className="auth-warning">
            Supabase service role key가 없어 trusted member를 저장할 수 없습니다.
            `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY`를 설정해 주세요.
          </div>
        ) : null}

        <form action="/api/trusted-members" className="trusted-member-form" method="post">
          <label>
            Google 이메일
            <input
              disabled={actor.role !== "owner" || !supabase}
              name="email"
              placeholder="manager@example.com"
              required
              type="email"
            />
          </label>
          <label>
            표시 이름
            <input
              disabled={actor.role !== "owner" || !supabase}
              name="displayName"
              placeholder="매니저"
            />
          </label>
          <label>
            역할
            <select disabled={actor.role !== "owner" || !supabase} name="trustedRole">
              <option value="manager">manager</option>
              <option value="worker">worker</option>
            </select>
          </label>
          <button
            className="button primary"
            disabled={actor.role !== "owner" || !supabase}
            type="submit"
          >
            등록 / 갱신
          </button>
        </form>

        <section className="trusted-member-list" aria-label="등록된 trusted member">
          {members.length === 0 ? (
            <p>아직 등록된 매니저/작업자가 없습니다.</p>
          ) : (
            members.map((member) => (
              <article key={member.id}>
                <strong>{member.display_name || member.email}</strong>
                <span>{member.email}</span>
                <em>{member.trusted_role}</em>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

async function getTrustedMembers(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>
) {
  const { data } = await supabase
    .from("trusted_members")
    .select(
      "id, email, display_name, trusted_role, can_view_embargo, can_view_work, is_active, calendars!inner(slug)"
    )
    .eq("calendars.slug", "vic")
    .order("created_at", { ascending: false });

  return (data ?? []) as TrustedMemberRow[];
}
