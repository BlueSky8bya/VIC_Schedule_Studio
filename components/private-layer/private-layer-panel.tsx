"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PasscodeResult } from "@/lib/private-layer/actions";
import { hapticError, hapticSuccess, hapticTick } from "@/lib/ui/haptics";

type PrivateLayerPanelProps = {
  canManage: boolean;
  setPasscodeAction: (newPasscode: string, currentPasscode?: string) => Promise<PasscodeResult>;
  onDone?: () => void;
  onUnlocked?: () => void;
  // true면 잠금 해제 폼이 아니라 곧장 "비밀번호 변경" 폼으로 연다(잠금 중에도 변경하려고).
  startChanging?: boolean;
  // 현재 비밀번호가 아직 초기값(0219)인지 — 변경 폼 placeholder 힌트 분기용.
  isDefaultPasscode?: boolean;
};

export function PrivateLayerPanel({
  canManage,
  setPasscodeAction,
  onDone,
  onUnlocked,
  startChanging = false,
  isDefaultPasscode = false
}: PrivateLayerPanelProps) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [changing, setChanging] = useState(startChanging && canManage);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  // 비밀번호 확인(검증) 진행 상태 — 버튼이 "확인 중…"으로 바뀐다.
  const [unlocking, setUnlocking] = useState(false);
  // 비밀번호 틀림 시 입력칸을 잠깐 흔든다(연출). onAnimationEnd로 비워, 다음 실패에 다시 흔들린다.
  const [shake, setShake] = useState(false);

  async function unlock() {
    setError(null);
    setUnlocking(true);
    const res = await fetch("/api/unlock-private-layer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // 검증 성공 → 따뜻한 성공 진동 + 부모가 팝업을 닫고 "일정을 불러오는 중…"을 띄운 뒤 새로고침(⚠배너 연출).
      hapticSuccess();
      onUnlocked?.();
    } else {
      setUnlocking(false);
      setError(data.error ?? "잠금 해제에 실패했습니다.");
      // 실패 연출: 에러 진동 + 입력칸 흔들기(붉은 테두리).
      hapticError();
      setShake(true);
    }
  }

  function changePasscode() {
    hapticTick();
    setError(null);
    startTransition(async () => {
      const result = await setPasscodeAction(newPw, currentPw);
      if (result.ok) {
        setChanging(false);
        setCurrentPw("");
        setNewPw("");
        onDone?.();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="passcode-box">
      {!changing ? (
        <>
          <form
            className="passcode-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (passcode) unlock();
            }}
          >
            <input
              autoFocus
              className={shake ? "shake" : ""}
              onAnimationEnd={() => setShake(false)}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="비밀번호"
              type="password"
              value={passcode}
            />
            <button
              className="button primary"
              disabled={!passcode || unlocking}
              type="submit"
            >
              {unlocking ? "확인 중…" : "확인"}
            </button>
          </form>
          {error ? <div className="auth-warning">{error}</div> : null}
          {canManage ? (
            <button
              className="button"
              onClick={() => {
                hapticTick();
                setChanging(true);
              }}
              type="button"
            >
              비밀번호 변경
            </button>
          ) : null}
        </>
      ) : (
        <>
          <input
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
              disabled={pending}
              onClick={() => {
                setError(null);
                // 변경 모드로 '바로' 열렸으면(비밀번호 변경 버튼) 취소 = 팝업 닫기(이전 화면으로).
                // 잠금 폼에서 들어온 경우만 잠금 폼으로 되돌린다.
                if (startChanging) {
                  onDone?.();
                } else {
                  setChanging(false);
                }
              }}
              type="button"
            >
              취소
            </button>
            <button
              className="button primary"
              disabled={newPw.trim().length < 4 || pending}
              onClick={changePasscode}
              type="button"
            >
              변경 저장
            </button>
          </div>
        </>
      )}
    </div>
  );
}
