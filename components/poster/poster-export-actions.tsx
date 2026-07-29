"use client";

import { Clipboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { hapticTick } from "@/lib/ui/haptics";

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
  // 보상 순간(D1): 복사 성공 시 완성본 미니 썸네일이 스프링으로 팝인 — 내보내기는 이 앱의
  // 성취 정점이라 토스트 한 줄 대신 '내가 만든 결과물'을 잠깐 보여준다. 잠시 후 스스로 사라진다.
  const [rewardThumb, setRewardThumb] = useState<string | null>(null);
  const rewardTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (rewardTimerRef.current !== null) window.clearTimeout(rewardTimerRef.current);
    },
    []
  );
  const busy = phase === "preparing" || phase === "rendering" || phase === "copying";

  async function copyPoster() {
    if (busy) {
      return;
    }
    hapticTick(); // 프레스 틱(성공 시 확정 틱과 짝 — 2틱 관례)
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
        useCORS: true,
        // 복제 문서에서는 CSS 애니메이션이 0%부터 다시 시작된다 → 등장 애니(투명도·이동)의
        // 초기 프레임이 랜덤하게 찍혀 '전체가 뿌옇게 바랜' 캡쳐가 나오던 원인. 복제본의
        // 애니메이션을 전부 멈추고 큰 음수 delay로 '끝 상태'에 고정해 항상 완성된 화면만 찍는다.
        onclone: (doc) => {
          const style = doc.createElement("style");
          style.textContent =
            "[data-export-surface], [data-export-surface] * {" +
            " animation-play-state: paused !important;" +
            " animation-delay: -60s !important;" +
            " transition: none !important; }";
          doc.head.appendChild(style);
        }
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
      hapticTick(); // 확정 틱
      // 보상 썸네일 — 원본 캔버스는 수천 px라 그대로 dataURL을 뜨면 무겁다 → 220px로 축소해 뜬다.
      try {
        const thumbW = 220;
        const thumbH = Math.max(1, Math.round((canvas.height / canvas.width) * thumbW));
        const small = document.createElement("canvas");
        small.width = thumbW;
        small.height = thumbH;
        small.getContext("2d")?.drawImage(canvas, 0, 0, thumbW, thumbH);
        setRewardThumb(small.toDataURL("image/png"));
        if (rewardTimerRef.current !== null) window.clearTimeout(rewardTimerRef.current);
        rewardTimerRef.current = window.setTimeout(() => setRewardThumb(null), 2400);
      } catch {
        // 썸네일은 장식 — 실패해도 복사 자체는 성공이므로 조용히 넘어간다.
      }
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
        {/* 진행 중엔 라벨 대신 점(●●●)만 — 단계별 문구로 라벨이 바뀌면 버튼 폭이 실시간으로
            출렁여 보기 싫다. 문구는 스크린리더용으로만 남긴다. */}
        {busy ? (
          <>
            <span className="sr-only" role="status">
              {PHASE_LABEL[phase]}
            </span>
            <span aria-hidden="true" className="poster-export-progress">
              <span className={`dot${phase !== "preparing" ? " done" : ""}`} />
              <span className={`dot${phase === "rendering" || phase === "copying" ? " done" : ""}`} />
              <span className={`dot${phase === "copying" ? " done" : ""}`} />
            </span>
          </>
        ) : (
          PHASE_LABEL[phase]
        )}
      </button>
      {busy && fontSettling && phase === "preparing" ? (
        <em className="poster-export-hint">폰트 정리 중…</em>
      ) : null}
      {phase === "failed" ? (
        <span className="poster-action-error">브라우저 클립보드 권한을 확인하세요.</span>
      ) : null}
      {rewardThumb ? (
        <div aria-hidden="true" className="poster-export-reward">
          {/* eslint-disable-next-line @next/next/no-img-element -- 일회성 dataURL 썸네일 */}
          <img alt="" src={rewardThumb} />
          <span className="poster-export-reward-spark s1">✦</span>
          <span className="poster-export-reward-spark s2">✦</span>
        </div>
      ) : null}
    </div>
  );
}
