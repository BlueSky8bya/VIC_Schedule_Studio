"use client";

import { hapticTick } from "@/lib/ui/haptics";

// 보안 패널(개발자·관리자 공용) — 편집실 비밀번호(최초공개 게이트) 정보와 변경 버튼.
export type SecurityPanelData = {
  passcodeVersion: number | null;
  passcodeUpdatedAt: string | null;
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

// (접근 자격자 목록은 2026-10-06 소유자 결정으로, '지금 비공개를 연 계정' 배너와 '잠금 유효' 시간은
//  2026-11-13 비공개 레이어 철수(0159)로 뺐다. 암호 정보·비밀번호 변경만 남는다.)
export function SecurityPanel({
  data,
  onChangePasscode
}: {
  data: SecurityPanelData;
  onChangePasscode?: () => void;
}) {
  return (
    <>
      <h4 className="insight-subhead">편집실 비밀번호</h4>
      <ul className="sec-kpis">
        <li>
          <b>v{data.passcodeVersion ?? "—"}</b>
          <span>암호 버전</span>
        </li>
        <li>
          <b>{fmtDate(data.passcodeUpdatedAt)}</b>
          <span>마지막 변경</span>
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
