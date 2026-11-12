"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PasscodeResult } from "@/lib/private-layer/actions";
import { hapticTick } from "@/lib/ui/haptics";

// 편집실 비밀번호(최초공개 게이트) 변경 폼. 비공개 레이어 잠금해제 폼은 2026-11-13 철수(0159) —
// 게이트 확인은 편집실 카드의 게이트가 직접 한다.
type PrivateLayerPanelProps = {
  canManage: boolean;
  setPasscodeAction: (newPasscode: string, currentPasscode?: string) => Promise<PasscodeResult>;
  onDone?: () => void;
  // 현재 비밀번호가 아직 초기값(0219)인지 — 변경 폼 placeholder 힌트 분기용.
  isDefaultPasscode?: boolean;
};

export function PrivateLayerPanel({
  canManage,
  setPasscodeAction,
  onDone,
  isDefaultPasscode = false
}: PrivateLayerPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  function changePasscode() {
    hapticTick();
    setError(null);
    startTransition(async () => {
      const result = await setPasscodeAction(newPw, currentPw);
      if (result.ok) {
        setCurrentPw("");
        setNewPw("");
        onDone?.();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!canManage) return null;

  return (
    <div className="passcode-box">
      <input
        autoFocus
        onChange={(e) => setCurrentPw(e.target.value)}
        placeholder={isDefaultPasscode ? "현재 비밀번호(처음: 0219)" : "현재 비밀번호"}
        type="password"
        value={currentPw}
      />
      <input
        onChange={(e) => setNewPw(e.target.value)}
        placeholder="새 비밀번호 (4자 이상)"
        type="password"
        value={newPw}
      />
      {error ? <div className="auth-warning">{error}</div> : null}
      <div className="passcode-actions">
        <button
          className="button"
          data-act="passcode-change-cancel"
          // 취소는 순수 클라이언트 동작(팝업 닫기)이라 서버 저장 중이라고 막을 이유가 없다.
          onClick={() => {
            setError(null);
            onDone?.();
          }}
          type="button"
        >
          취소
        </button>
        <button
          className="button primary"
          data-act="passcode-change-save"
          disabled={newPw.trim().length < 4 || pending}
          onClick={changePasscode}
          type="button"
        >
          변경 저장
        </button>
      </div>
    </div>
  );
}
