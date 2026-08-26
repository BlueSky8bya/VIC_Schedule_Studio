"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Monitor, ShieldCheck, Smartphone, UserCog, Users } from "lucide-react";
import { subscribePresence, type PresenceCounts } from "@/lib/presence/presence-client";

// 개발자 전용 "접속자 현황" — 지금 사이트에 접속한 사용자 수를 역할별 + 기기별로 보여준다.
// 실시간(Supabase Presence)으로 갱신되며, 별도 새로고침 없이 들어오고 나갈 때 숫자가 바뀐다.
// 라벨·색은 다른 인사이트 화면(ROLE_META, ROLE_TREND_META)과 같은 이름을 쓴다 — '비로그인'.
// 아이콘은 시청자(눈)와 짝이 되게 눈-가림으로: 로그인만 안 했을 뿐 같은 시청자다.
type RoleKey = "owner" | "manager" | "viewer" | "anon" | "developer";
const ROWS: { key: RoleKey; label: string; icon: typeof Users }[] = [
  { key: "owner", label: "관리자", icon: ShieldCheck },
  { key: "manager", label: "매니저", icon: UserCog },
  { key: "viewer", label: "시청자", icon: Eye },
  { key: "anon", label: "비로그인", icon: EyeOff },
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
      {/* 화면에 떠 있음 / 탭만 열림 — 예전 '접속 중'은 숨긴 탭도 함께 세서 실제보다 컸다.
          visible은 '화면에 출력 중'이지 '눈으로 보는 중'은 아니다(가려진 창·보조 모니터). */}
      <div className="developer-panel-live">
        <div className="dp-live-tile is-watching">
          <strong>{c ? c.watching : "…"}</strong>
          <span>화면에 떠 있음</span>
        </div>
        <div className="dp-live-tile">
          <strong>{c ? Math.max(0, c.total - c.watching) : "…"}</strong>
          <span>탭만 열림</span>
        </div>
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
