"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import "./mobile-calendar-title.css";

/** Display the real write queue's state; idle is deliberately silent. */
export function MobileSaveFeedback({ state, lastSavedKst }: {
  state: "idle" | "saving" | "saved" | "failed"; lastSavedKst: string | null;
}) {
  const saved = state === "saved" && Boolean(lastSavedKst);
  const message = state === "failed" ? "저장 실패. 잠시 후 다시 시도해 주세요."
    : state === "saving" ? "저장 중이에요" : saved ? `저장됨. 마지막 저장 ${lastSavedKst} KST` : "";
  return <>
    <span className="mobile-save-feedback" data-state={state} aria-hidden="true" title={message || undefined}>
      {state === "failed" ? <CircleAlert size={13} /> : state === "saving" ? <LoaderCircle size={13} /> : saved ? <Check size={13} /> : null}
    </span>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</span>
  </>;
}
