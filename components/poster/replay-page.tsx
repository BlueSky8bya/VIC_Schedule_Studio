"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { DayVodWindow, type DayVod } from "@/components/poster/day-vod-window";
import { useSidePanel } from "@/lib/ui/use-side-panel";

// 다시보기 페이지 껍데기 — 레일 자리는 시청자 화면의 사이드 패널 쪽(vic_avatar_side, 같은 훅)을 그대로 따른다.
// 닫기(✕·Esc) = 온 곳으로(달력에서 왔으면 history.back — 보던 달은 쿠키가 복원), 직접 들어왔으면 `/`.
export function ReplayPage({
  dateKey,
  vods,
  slug,
  initialPart
}: {
  dateKey: string;
  vods: DayVod[];
  slug: string;
  initialPart?: number;
}) {
  const router = useRouter();
  const panel = useSidePanel({ enabled: true });
  const close = useCallback(() => {
    let sameOrigin = false;
    try {
      sameOrigin = document.referrer !== "" && new URL(document.referrer).origin === window.location.origin;
    } catch {
      sameOrigin = false;
    }
    if (sameOrigin && window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);
  return (
    <main className="replay-page">
      <DayVodWindow
        dateKey={dateKey}
        initialPart={initialPart}
        onClose={close}
        side={panel.side}
        slug={slug}
        variant="page"
        vods={vods}
      />
    </main>
  );
}
