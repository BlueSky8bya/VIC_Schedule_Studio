"use client";

import { useEffect, useState } from "react";
import { Eye, Hammer, Monitor, ShieldCheck, Smartphone, UserCog, Users } from "lucide-react";
import { subscribePresence, type PresenceCounts } from "@/lib/presence/presence-client";

// 개발자 전용 "접속자 현황" — 지금 사이트에 접속한 사용자 수를 역할별 + 기기별로 보여준다.
// 실시간(Supabase Presence)으로 갱신되며, 별도 새로고침 없이 들어오고 나갈 때 숫자가 바뀐다.
type RoleKey = "owner" | "manager" | "worker" | "viewer" | "developer";
const ROWS: { key: RoleKey; label: string; icon: typeof Users }[] = [
  { key: "owner", label: "관리자", icon: ShieldCheck },
  { key: "manager", label: "매니저", icon: UserCog },
  { key: "worker", label: "작업자", icon: Hammer },
  { key: "viewer", label: "시청자", icon: Eye },
  { key: "developer", label: "개발자", icon: Users }
];

type DeviceKey = "desktop" | "android" | "ios" | "mobile";
const DEVICES: { key: DeviceKey; label: string; icon: typeof Monitor }[] = [
  { key: "desktop", label: "웹(PC)", icon: Monitor },
  { key: "android", label: "안드로이드", icon: Smartphone },
  { key: "ios", label: "iOS", icon: Smartphone },
  { key: "mobile", label: "기타 모바일", icon: Smartphone }
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

      <h3 className="developer-panel-subhead">역할별</h3>
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

      <h3 className="developer-panel-subhead">기기별</h3>
      <ul className="developer-panel-list">
        {DEVICES.map(({ key, label, icon: Icon }) => (
          <li key={key} data-device={key}>
            <span className="dp-role">
              <Icon aria-hidden="true" size={16} />
              {label}
            </span>
            <span className="dp-count">{c ? c.devices[key] : "…"}</span>
          </li>
        ))}
      </ul>

      {c === null ? <p className="developer-panel-hint">실시간 연결 중…</p> : null}
    </div>
  );
}
