"use client";

import type { AccessPerson } from "@/lib/insights/actions";
import { hapticTick } from "@/lib/ui/haptics";

// 보안 패널(개발자·관리자 공용) — 지금 비공개를 연 계정 배너, 잠금 암호 정보, 비밀번호 변경.
export type SecurityPanelData = {
  activeUnlockCount: number;
  passcodeVersion: number | null;
  passcodeUpdatedAt: string | null;
  unlockDurationMinutes: number | null;
  access: { owners: AccessPerson[]; developers: AccessPerson[] };
};

function kst(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 9 * 3600 * 1000);
}
function fmtDate(iso: string | null): string {
  const k = kst(iso);
  return k ? `${k.getUTCFullYear()}.${k.getUTCMonth() + 1}.${k.getUTCDate()}` : "—";
}

// (관리자·개발자 접근 자격자 목록 — 사람별 세션·'만료시간 초기화' — 은 2026-10-06 소유자 결정으로 뺐다: "아무 쓸모가 없다".
//  위 배너(지금 비공개를 연 계정 수)·암호 정보·비밀번호 변경만 남는다. data.access는 서버가 그대로 보내도 쓰지 않는다.)
export function SecurityPanel({
  data,
  onChangePasscode
}: {
  data: SecurityPanelData;
  onChangePasscode?: () => void;
}) {
  return (
    <>
      <div className={`insight-banner ${data.activeUnlockCount > 0 ? "warn" : "ok"}`}>
        {data.activeUnlockCount > 0
          ? `지금 비공개를 연 계정 ${data.activeUnlockCount}`
          : "지금 비공개를 연 계정 없음"}
      </div>
      <h4 className="insight-subhead">비공개 잠금 암호</h4>
      <ul className="sec-kpis">
        <li>
          <b>v{data.passcodeVersion ?? "—"}</b>
          <span>암호 버전</span>
        </li>
        <li>
          <b>{fmtDate(data.passcodeUpdatedAt)}</b>
          <span>마지막 변경</span>
        </li>
        <li>
          <b>{data.unlockDurationMinutes ?? "—"}분</b>
          <span>잠금 유효</span>
        </li>
      </ul>
      {onChangePasscode ? (
        <button
          className="button insight-change-passcode"
          onClick={() => {
            hapticTick();
            onChangePasscode();
          }}
          type="button"
         data-act="insight-change-passcode">
          비밀번호 변경
        </button>
      ) : null}
    </>
  );
}
