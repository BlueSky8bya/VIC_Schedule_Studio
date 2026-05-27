"use client";

import { useEffect, useState } from "react";
import { Eye, Hammer, ShieldCheck, UserCog, Users } from "lucide-react";
import { subscribePresence, type PresenceCounts } from "@/lib/presence/presence-client";

// 개발자 전용 "접속자 현황" — 지금 사이트에 접속한 사용자 수를 역할별로 보여준다.
// 실시간(Supabase Presence)으로 갱신되며, 별도 새로고침 없이 들어오고 나갈 때 숫자가 바뀐다.
const ROWS: { key: keyof Omit<PresenceCounts, "total">; label: string; icon: typeof Users }[] = [
  { key: "owner", label: "소유자", icon: ShieldCheck },
  { key: "manager", label: "매니저", icon: UserCog },
  { key: "worker", label: "작업자", icon: Hammer },
  { key: "viewer", label: "시청자", icon: Eye },
  { key: "developer", label: "개발자", icon: Users }
];

export function DeveloperPanel() {
  const [counts, setCounts] = useState<PresenceCounts | null>(null);
  useEffect(() => subscribePresence(setCounts), []);

  const c = counts;
  return (
    <div className="developer-panel">
      <p className="developer-panel-hint">
        지금 사이트에 접속 중인 사용자입니다. (실시간 갱신)
      </p>
      <div className="developer-panel-total">
        <strong>{c ? c.total : "…"}</strong>
        <span>명 접속 중</span>
      </div>
      <ul className="developer-panel-list">
        {ROWS.map(({ key, label, icon: Icon }) => (
          <li key={key} data-role={key}>
            <span className="dp-role">
              <Icon aria-hidden="true" size={16} />
              {label}
            </span>
            <span className="dp-count">{c ? c[key] : "…"}</span>
          </li>
        ))}
      </ul>
      {c === null ? (
        <p className="developer-panel-hint">실시간 연결 중…</p>
      ) : null}
    </div>
  );
}
