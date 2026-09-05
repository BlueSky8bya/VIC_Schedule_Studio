"use client";

// 세션 로그 필터(2026-09-05 소유자: "세션 로그도 역할별로 필터링 · 역할이 anon까지 많으니 드롭다운으로 ·
// 옆 세션 필터도 동일하게"). 월별 인사이트와 하루 이용 기록이 같은 컴포넌트를 쓴다 — 두 곳의 필터가
// 모양도 동작도 달라지지 않게.
//
// 칩 줄이 아니라 드롭다운인 이유: 역할이 관리자·개발자·시청자·비로그인·역할 확인 못 함까지 다섯이라
// 칩으로 늘어놓으면 좁은 카드에서 두 줄로 접히고, 0건 칩이 죽은 버튼처럼 보인다. 목록은 **기록에 있는
// 역할만** 만들고 항목마다 건수를 붙인다("고를 수 있는 것"과 "그 결과"가 한 줄에 보인다).

import { RhhSelect } from "@/components/studio/rhh-select";
import { ROLE_NAME } from "@/lib/activity/labels";
import { hapticTick } from "@/lib/ui/haptics";

export type StayFilter = "all" | "stay" | "glance";
type Session = { role: string; meaningful: boolean };

export function SessionLogFilter({
  sessions,
  role,
  stay,
  onRole,
  onStay
}: {
  sessions: readonly Session[];
  role: string;
  stay: StayFilter;
  onRole: (role: string) => void;
  onStay: (stay: StayFilter) => void;
}) {
  const roleCount = new Map<string, number>();
  for (const s of sessions) roleCount.set(s.role, (roleCount.get(s.role) ?? 0) + 1);
  // 기록에 있는 역할만 — 많은 쪽부터(가장 흔한 답이 목록 위에 온다).
  const roles = [...roleCount.entries()].sort((a, b) => b[1] - a[1]);
  const roleOptions = [
    { value: "all", label: `전체 ${sessions.length}` },
    ...roles.map(([r, n]) => ({ value: r, label: `${ROLE_NAME[r] ?? r} ${n}` }))
  ];
  const stayN = sessions.filter((s) => s.meaningful).length;
  const stayOptions: { value: StayFilter; label: string }[] = [
    { value: "all", label: `전체 ${sessions.length}` },
    { value: "stay", label: `머문 ${stayN}` },
    { value: "glance", label: `스쳐감 ${sessions.length - stayN}` }
  ];
  return (
    <div aria-label="세션 로그 필터" className="vlog-filter" role="group">
      {/* 칸 이름을 왼쪽에 캡션으로 둔다(설정 줄과 같은 문법) — 트리거가 둘 다 "전체 25"라
          무엇을 고르는 칸인지 알 수 없었다(2026-09-05 소유자: "이게 각각 어떤 전체인데?").
          옵션 라벨을 길게 늘이는 대신 이름을 밖에 두면 목록도 짧게 유지된다. */}
      <div className="vlog-f">
        <span aria-hidden="true" className="vlog-f-cap">
          역할
        </span>
        <RhhSelect
          ariaLabel="역할 고르기"
          dataAct="vlog-role"
          onChange={(v) => {
            hapticTick();
            onRole(v);
          }}
          options={roleOptions}
          value={roleCount.has(role) || role === "all" ? role : "all"}
        />
      </div>
      <div className="vlog-f">
        <span aria-hidden="true" className="vlog-f-cap">
          체류
        </span>
        <RhhSelect<StayFilter>
          ariaLabel="체류 고르기"
          dataAct="vlog-stay"
          onChange={(v) => {
            hapticTick();
            onStay(v);
          }}
          options={stayOptions}
          value={stay}
        />
      </div>
    </div>
  );
}
