"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PasscodeResult } from "@/lib/private-layer/actions";
import { hapticTick } from "@/lib/ui/haptics";
import { PASSCODE_RESET_LOGIN_HREF } from "@/lib/private-layer/recent-login";

// 편집실 비밀번호(최초공개 게이트) 변경 폼. 비공개 레이어 잠금해제 폼은 2026-11-13 철수(0159) —
// 게이트 확인은 편집실 카드의 게이트가 직접 한다.
type PrivateLayerPanelProps = {
  canManage: boolean;
  setPasscodeAction: (newPasscode: string, currentPasscode?: string) => Promise<PasscodeResult>;
  // 비밀번호를 잊었을 때 — 현재 비밀번호 대신 '방금 구글로 다시 로그인'을 증명으로 새 비밀번호를 정한다.
  resetPasscodeAction?: (newPasscode: string) => Promise<PasscodeResult>;
  // 다시 로그인하고 돌아온 직후면 '다시 만들기'로 바로 연다.
  startInReset?: boolean;
  onDone?: () => void;
  // 현재 비밀번호가 아직 초기값(0219)인지 — 변경 폼 placeholder 힌트 분기용.
  isDefaultPasscode?: boolean;
};

export function PrivateLayerPanel({
  canManage,
  setPasscodeAction,
  onDone,
  isDefaultPasscode = false,
  resetPasscodeAction,
  startInReset = false
}: PrivateLayerPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [forgot, setForgot] = useState(Boolean(startInReset && resetPasscodeAction));
  const [needsLogin, setNeedsLogin] = useState(false);

  function changePasscode() {
    hapticTick();
    setError(null);
    startTransition(async () => {
      const result = forgot && resetPasscodeAction ? await resetPasscodeAction(newPw) : await setPasscodeAction(newPw, currentPw);
      setNeedsLogin(!result.ok && Boolean(result.needsLogin));
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
      {forgot ? (
        <p className="passcode-note">현재 비밀번호 없이 새로 정해요. 구글 계정으로 다시 로그인한 뒤 10분 안에만 할 수 있어요.</p>
      ) : (
        <input
          autoFocus
          onChange={(e) => setCurrentPw(e.target.value)}
          placeholder={isDefaultPasscode ? "현재 비밀번호(처음: 0219)" : "현재 비밀번호"}
          type="password"
          value={currentPw}
        />
      )}
      <input
        autoFocus={forgot}
        onChange={(e) => setNewPw(e.target.value)}
        placeholder="새 비밀번호 (4자 이상)"
        type="password"
        value={newPw}
      />
      {error ? <div className="auth-warning">{error}</div> : null}
      {forgot && needsLogin ? (
        // 전체 이동(구글 로그인 왕복) — 돌아오면 편집실이 이 창을 '다시 만들기'로 다시 연다.
        <a className="button" data-act="passcode-reset-login" href={PASSCODE_RESET_LOGIN_HREF}>
          구글로 다시 로그인
        </a>
      ) : null}
      {resetPasscodeAction ? (
        <button
          className="passcode-forgot"
          data-act="passcode-forgot"
          data-act-opt={forgot ? "back" : "forgot"}
          onClick={() => {
            setError(null);
            setNeedsLogin(false);
            setForgot((on) => !on);
          }}
          type="button"
        >
          {forgot ? "현재 비밀번호를 알아요" : "비밀번호를 잊었어요"}
        </button>
      ) : null}
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
          {forgot ? "새 비밀번호로 저장" : "변경 저장"}
        </button>
      </div>
    </div>
  );
}
