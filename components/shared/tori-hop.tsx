import "./tori-hop.css";

// 토리님 손그림이 방방 뛰는 기다림 그림(2026-11-14 소유자: "기다리는 동안 지루하지 않게").
// 편집실·일정표·개인정보처리방침·이용약관·일정 그림판 — 모든 기다림 화면이 이 한 벌을 쓴다(AGENTS G-18/UI-18).
// 그림은 24칸 띠(public/tori/loading-hop-v5.webp, scripts/build-tori-loading-hop.mjs)를 CSS steps로 넘긴다 —
// JS가 없어도(loading.tsx 서버 렌더) 바로 움직인다. 동작 줄이기에서는 멈춘 한 장 + 문구만.
export const TORI_HOP_SRC = "/tori/loading-hop-v5.webp";

/** 뛰는 토리 그림만. size는 CSS 변수(--tori-hop-size)로 화면마다 정한다. */
export function ToriHop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={className ? `tori-hop ${className}` : "tori-hop"}>
      <div className="tori-hop-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="tori-hop-strip" draggable={false} fetchPriority="high" height={192} src={TORI_HOP_SRC} width={4608} />
      </div>
    </div>
  );
}

/** 화면 가운데 뛰는 토리 + "{label} 불러오는 중…". 라우트 로딩(서버)·동적 화면 로딩(클라) 공용. */
export function ToriHopLoading({
  label,
  variant = "page",
  className
}: {
  /** 목적지 이름 — "개인정보처리방침", "이용약관", "일정 그림판" 등. */
  label: string;
  /** page = 화면 전체를 덮는 기다림 화면, overlay = 이미 있는 화면 위에 반투명으로 겹침(그림판 열기). */
  variant?: "page" | "overlay";
  className?: string;
}) {
  const cls = ["tori-hop-stage", `tori-hop-stage-${variant}`, className ?? ""].filter(Boolean).join(" ");
  return (
    <div aria-busy="true" className={cls}>
      <div className="tori-hop-box">
        <ToriHop />
        <p aria-live="polite" className="tori-hop-note" role="status">
          {label} 불러오는 중…
        </p>
      </div>
    </div>
  );
}
