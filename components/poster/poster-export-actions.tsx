"use client";

import { Clipboard } from "lucide-react";
import { useState } from "react";

// 편의 내보내기(클립보드)는 3단계로 진행 상황을 보여준다: 준비 → 렌더링 → 복사.
// html2canvas는 메인 스레드를 잡으므로 오버레이로 "비차단"을 만들 순 없다 — 정직하게,
// 무거운 작업이 "고장"이 아니라 "진행 중"으로 읽히도록 단계별 피드백을 준다.
// 공식 내보내기는 Playwright(정본)이 담당한다.
type ExportPhase = "idle" | "preparing" | "rendering" | "copying" | "copied" | "failed";

type PosterExportActionsProps = {
  onBeforeCapture?: () => void | Promise<void>;
  onAfterCapture?: () => void;
};

const PHASE_LABEL: Record<ExportPhase, string> = {
  idle: "일정표 캡쳐",
  preparing: "달력 이미지 준비 중…",
  rendering: "이미지 렌더링 중…",
  copying: "클립보드에 복사 중…",
  copied: "복사됨!",
  failed: "일정표 캡쳐"
};

export function PosterExportActions({ onBeforeCapture, onAfterCapture }: PosterExportActionsProps) {
  const [phase, setPhase] = useState<ExportPhase>("idle");
  // 폰트가 아직 안 깔린 채로 캡쳐하면 글자가 깨질 수 있어, 정착될 때까지 기다리며 안내한다.
  const [fontSettling, setFontSettling] = useState(false);
  const busy = phase === "preparing" || phase === "rendering" || phase === "copying";

  async function copyPoster() {
    if (busy) {
      return;
    }
    const surface = document.querySelector<HTMLElement>("[data-export-surface]");
    if (!surface) {
      setPhase("failed");
      window.setTimeout(() => setPhase("idle"), 2200);
      return;
    }

    try {
      setPhase("preparing");
      // 캡쳐 전 준비(선택 핸들 해제·일정 카드 전부 펼침 등)를 끝낸 뒤 두 프레임 기다린다.
      await onBeforeCapture?.();
      // 폰트가 아직 로딩 중이면 정착될 때까지 기다린다(글자 깨짐 방지).
      if (typeof document !== "undefined" && document.fonts) {
        if (document.fonts.status === "loading") {
          setFontSettling(true);
          await document.fonts.ready;
        }
      }
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
      );

      setPhase("rendering");
      const html2canvas = (await import("html2canvas")).default;
      // 화질: 화면 배율의 2배(최소 3배)로 렌더해 선명하게 캡쳐한다.
      const scale = Math.max(3, Math.ceil((window.devicePixelRatio || 1) * 2));
      const canvas = await html2canvas(surface, {
        backgroundColor: "#ffffff",
        scale,
        useCORS: true
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );

      if (!blob || !navigator.clipboard || !("ClipboardItem" in window)) {
        throw new Error("Clipboard image write is unavailable.");
      }

      setPhase("copying");
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setPhase("copied");
      window.setTimeout(() => setPhase("idle"), 1800);
    } catch {
      setPhase("failed");
      window.setTimeout(() => setPhase("idle"), 2200);
    } finally {
      setFontSettling(false);
      // 캡쳐가 끝나면 임시로 펼쳤던 일정 카드 등을 원복한다.
      onAfterCapture?.();
    }
  }

  return (
    <div className="poster-actions" aria-label="Poster export actions">
      <button
        className="button primary"
        onClick={copyPoster}
        type="button"
        disabled={busy}
        aria-busy={busy}
      >
        <Clipboard aria-hidden="true" size={17} />
        {PHASE_LABEL[phase]}
      </button>
      {busy ? (
        <span className="poster-export-progress" role="status">
          <span className={`dot${phase !== "preparing" ? " done" : ""}`} />
          <span className={`dot${phase === "rendering" || phase === "copying" ? " done" : ""}`} />
          <span className={`dot${phase === "copying" ? " done" : ""}`} />
          {fontSettling && phase === "preparing" ? (
            <em className="poster-export-hint">폰트 정리 중…</em>
          ) : null}
        </span>
      ) : null}
      {phase === "failed" ? (
        <span className="poster-action-error">브라우저 클립보드 권한을 확인하세요.</span>
      ) : null}
    </div>
  );
}
