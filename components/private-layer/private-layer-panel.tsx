"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PasscodeResult } from "@/lib/private-layer/actions";

type PrivateLayerPanelProps = {
  canManage: boolean;
  setPasscodeAction: (newPasscode: string, currentPasscode?: string) => Promise<PasscodeResult>;
  onDone?: () => void;
  onUnlocked?: () => void;
};

export function PrivateLayerPanel({
  canManage,
  setPasscodeAction,
  onDone,
  onUnlocked
}: PrivateLayerPanelProps) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [changing, setChanging] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  // 잠금 해제 진행/성공 상태 — 확인을 눌렀을 때 적용 여부가 분명히 보이게.
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

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
      setUnlocked(true); // "✓ 잠금 해제됨" 잠깐 보여주고 닫기/갱신
      onUnlocked?.();
      setTimeout(() => {
        onDone?.();
        router.refresh();
      }, 650);
    } else {
      setUnlocking(false);
      setError(data.error ?? "잠금 해제에 실패했습니다.");
    }
  }

  function changePasscode() {
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
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="비밀번호"
              type="password"
              value={passcode}
            />
            <button
              className={`button primary ${unlocked ? "saved" : ""}`}
              disabled={!passcode || unlocking || unlocked}
              type="submit"
            >
              {unlocked ? "✓ 잠금 해제됨" : unlocking ? "확인 중…" : "확인"}
            </button>
          </form>
          {unlocked ? (
            <div className="auth-success">비공개 일정이 표시됩니다.</div>
          ) : null}
          {error ? <div className="auth-warning">{error}</div> : null}
          {canManage ? (
            <button className="button" onClick={() => setChanging(true)} type="button">
              비밀번호 변경
            </button>
          ) : null}
        </>
      ) : (
        <>
          <input
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="현재 비밀번호 (처음이면 비워두기)"
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
                setChanging(false);
                setError(null);
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
