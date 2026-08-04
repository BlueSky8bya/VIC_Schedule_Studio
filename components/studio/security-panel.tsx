"use client";

import { useState } from "react";
import { PlainEmail } from "@/components/ui/plain-email";
import type { AccessPerson } from "@/lib/insights/actions";
import { hapticTick } from "@/lib/ui/haptics";

// 보안 패널(개발자·관리자 공용) — 지금 비공개를 연 계정 배너, 잠금 암호 정보, 비밀번호 변경,
// 역할별 접근 자격자(사람마다 만료시간 + 개별 만료). showDevelopers로 개발자 섹션 노출 여부를 가른다.
export type SecurityPanelData = {
  activeUnlockCount: number;
  passcodeVersion: number | null;
  passcodeUpdatedAt: string | null;
  unlockDurationMinutes: number | null;
  access: { owners: AccessPerson[]; developers: AccessPerson[]; workers: AccessPerson[] };
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
function fmtTime(iso: string | null): string {
  const k = kst(iso);
  return k
    ? `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`
    : "—";
}

export function SecurityPanel({
  data,
  showDevelopers,
  onChangePasscode,
  onExpire
}: {
  data: SecurityPanelData;
  showDevelopers: boolean;
  onChangePasscode?: () => void;
  onExpire: (userId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  // 지금 개별 만료 중인 사람의 user_id(그 카드 버튼만 비활성).
  const [expiringUserId, setExpiringUserId] = useState<string | null>(null);
  const [expireError, setExpireError] = useState<string | null>(null);

  async function handleExpire(userId: string, email: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`${email}의 비공개 잠금을 지금 만료시킬까요?`)
    ) {
      return;
    }
    hapticTick();
    setExpiringUserId(userId);
    setExpireError(null);
    const res = await onExpire(userId);
    setExpiringUserId(null);
    // 실패는 alert 대신 패널 안 인라인으로(앱 톤 유지). 성공이면 목록이 새로고침된다.
    if (!res.ok) setExpireError(res.error ?? "만료 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }

  function renderSection(title: string, roleLabel: string, roleClass: string, people: AccessPerson[]) {
    return (
      <>
        <h4 className="insight-subhead">
          {title} ({people.length})
        </h4>
        {people.length === 0 ? (
          <p className="insight-empty">없어요.</p>
        ) : (
          <ul className="access-list">
            {people.map((p) => (
              <li className="access-card" key={`${roleClass}-${p.email}`}>
                <div className="access-top">
                  <PlainEmail className="access-email" value={p.email} />
                  <em className={`rt ${roleClass}`}>{roleLabel}</em>
                </div>
                <div className="access-bottom">
                  {p.expiresAt && p.userId ? (
                    <>
                      <strong className="access-expiry">~ {fmtTime(p.expiresAt)} 만료</strong>
                      <button
                        className="button danger access-expire"
                        disabled={expiringUserId === p.userId}
                        onClick={() => handleExpire(p.userId as string, p.email)}
                        type="button"
                       data-act="access-expire">
                        {expiringUserId === p.userId ? "만료 중…" : "만료시간 초기화"}
                      </button>
                    </>
                  ) : (
                    <span className="access-none">세션 없음</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

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
      {expireError ? (
        <div className="auth-warning" role="alert">
          {expireError}
        </div>
      ) : null}
      {renderSection("관리자", "관리자", "owner", data.access.owners)}
      {showDevelopers ? renderSection("개발자", "개발자", "developer", data.access.developers) : null}
      {renderSection("작업자", "작업자", "worker", data.access.workers)}
    </>
  );
}
