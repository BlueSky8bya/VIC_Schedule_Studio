"use client";

import { KeyRound, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { RowLabel } from "@/components/shared/settings-controls";
import { getOwnerSecurityAction, type OwnerSecurityData } from "@/lib/insights/actions";
import { announceIfStaleDeployment } from "@/lib/net/stale-deploy";
import { hapticTick } from "@/lib/ui/haptics";

// 보안 묶음(설정 창, 관리자·개발자 공용) — 편집실 비밀번호(최초공개 게이트) 정보와 변경 버튼.
// 2026-11-13 인사이트 '보안' 탭에서 설정 창으로 옮겼다(소유자: "인사이트보다 설정에 어울린다").
// 데이터는 이 묶음을 처음 열 때만 부른다(설정 창을 여는 것만으로는 서버를 부르지 않는다).
// (접근 자격자 목록은 2026-10-06 소유자 결정으로, '지금 비공개를 연 계정' 배너와 '잠금 유효' 시간은
//  2026-11-13 비공개 레이어 철수(0159)로 뺐다. 암호 정보·비밀번호 변경만 남는다.)

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}.${k.getUTCMonth() + 1}.${k.getUTCDate()}`;
}

export function SecurityPanel({ onChangePasscode }: { onChangePasscode: () => void }) {
  const [data, setData] = useState<OwnerSecurityData | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    getOwnerSecurityAction()
      .then((r) => {
        if (!alive) return;
        if (r.ok) setData(r.data);
        else setError(true);
      })
      .catch((error) => {
        announceIfStaleDeployment(error);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const status = data
    ? `v${data.passcodeVersion ?? "—"} · ${fmtDate(data.passcodeUpdatedAt)} 변경`
    : error
      ? "불러오지 못했어요"
      : "불러오는 중…";

  return (
    <>
      <div className="rhh-group-card">
        <div className="role-help-haptics">
          <RowLabel icon={<Lock size={15} />} tone="metal">
            편집실 비밀번호
          </RowLabel>
          {error && !data ? (
            <button className="rhh-link" data-act="security-retry" onClick={() => setAttempt((n) => n + 1)} type="button">
              다시 시도
            </button>
          ) : (
            <span className="rhh-val" aria-busy={!data}>
              {status}
            </span>
          )}
        </div>
        <div className="role-help-haptics">
          <RowLabel icon={<KeyRound size={15} />} tone="metal">
            비밀번호 변경
          </RowLabel>
          <button
            className="rhh-link"
            data-act="insight-change-passcode"
            onClick={() => {
              hapticTick();
              onChangePasscode();
            }}
            type="button"
          >
            변경
          </button>
        </div>
      </div>
      <p className="rhh-group-foot">편집실에서 최초공개 일정을 열 때 묻는 비밀번호예요.</p>
    </>
  );
}
