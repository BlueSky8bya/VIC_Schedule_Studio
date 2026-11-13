"use client";

import type { ReactNode } from "react";
import "./loading-state.css";

// 기다림 표시 한 벌(2026-11-13 소유자: "눌렀는데 로딩 중인지 멈춘 건지 모르겠다").
// 편집실·시청자·미리보기·비로그인이 같은 구현을 쓴다(AGENTS G-18/UI-18) — 화면마다 새 스피너를 만들지 않는다.
//  · LoadingState: 눌린 즉시 보이는 회전 고리 + 짧은 문구(role=status). children(자리표시 스켈레톤)을 주면
//    그 위 가운데에 같은 배지를 얹는다 — 스켈레톤의 '자리 보존'은 그대로, '움직이는 중'은 배지가 말한다.
//  · LoadError: 실패를 조용히 '없음'으로 두지 않고 말하고, 그 자리에서 다시 시도하게 한다(UI-25).
// 동작 줄이기(html[data-reduce-motion])에서는 고리가 돌지 않고 정지 표시 + 문구만 남는다(UI-27).

/** 고리만. 버튼 글자 옆처럼 문구가 이미 있는 곳에 쓴다(small = 글자 높이). */
export function LoadingSpinner({ small = false, className }: { small?: boolean; className?: string }) {
  const cls = ["ls-spin", small ? "ls-spin-sm" : "", className ?? ""].filter(Boolean).join(" ");
  return <span aria-hidden="true" className={cls} />;
}

export function LoadingState({
  label = "불러오는 중…",
  variant = "block",
  className,
  children
}: {
  label?: string;
  /** block = 제자리 한 줄(가운데), inline = 글 흐름 안, floating = 화면 가운데 떠 있는 알약(시트 코드가 아직 없을 때) */
  variant?: "block" | "inline" | "floating";
  className?: string;
  /** 자리표시(스켈레톤). 주면 그 위에 배지를 겹친다. 스크린리더에는 숨긴다. */
  children?: ReactNode;
}) {
  const cls = ["ls", `ls-${variant}`, children ? "ls-over" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div aria-live="polite" className={cls} data-loading-state="" role="status">
      {children ? (
        <div aria-hidden="true" className="ls-ph">
          {children}
        </div>
      ) : null}
      <span className="ls-badge">
        <LoadingSpinner />
        <span className="ls-label">{label}</span>
      </span>
    </div>
  );
}

export function LoadError({
  message,
  onRetry,
  retryLabel = "다시 시도",
  act,
  className
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** 행동 타임라인 식별자(data-act) — 버튼을 쓰면 ACT 사전에 등록된 값을 준다. */
  act?: string;
  className?: string;
}) {
  return (
    <div className={className ? `ls-error ${className}` : "ls-error"} data-load-error="" role="alert">
      <span className="ls-error-msg">{message}</span>
      {onRetry ? (
        <button className="ls-retry" data-act={act} onClick={onRetry} type="button">
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
