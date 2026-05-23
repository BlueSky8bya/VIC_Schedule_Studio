"use client";

import { Clipboard } from "lucide-react";
import { useState } from "react";

type ExportState = "idle" | "copying" | "copied" | "failed";

type PosterExportActionsProps = {
  onBeforeCapture?: () => void | Promise<void>;
  onAfterCapture?: () => void;
};

export function PosterExportActions({ onBeforeCapture, onAfterCapture }: PosterExportActionsProps) {
  const [state, setState] = useState<ExportState>("idle");

  async function copyPoster() {
    const surface = document.querySelector<HTMLElement>("[data-export-surface]");

    if (!surface) {
      setState("failed");
      return;
    }

    try {
      setState("copying");
      // 캡쳐 전 준비(선택 핸들 해제·일정 카드 전부 펼침 등)를 끝낸 뒤 두 프레임 기다린다.
      await onBeforeCapture?.();
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
      );
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

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 2200);
    } finally {
      // 캡쳐가 끝나면 임시로 펼쳤던 일정 카드 등을 원복한다.
      onAfterCapture?.();
    }
  }

  return (
    <div className="poster-actions" aria-label="Poster export actions">
      <button className="button primary" onClick={copyPoster} type="button">
        <Clipboard aria-hidden="true" size={17} />
        {state === "copying" ? "캡쳐 중" : state === "copied" ? "복사됨" : "일정표 캡쳐"}
      </button>
      {state === "failed" ? (
        <span className="poster-action-error">브라우저 클립보드 권한을 확인하세요.</span>
      ) : null}
    </div>
  );
}
