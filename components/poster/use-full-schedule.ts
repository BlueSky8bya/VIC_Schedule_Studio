"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicSchedule } from "@/lib/domain/schedule-types";
import { mergeWindowedSchedule } from "@/lib/schedules/schedule-window";

// 첫 화면 창(schedule.window)으로 온 공개 일정을 전체로 채운다. 마운트 즉시 공개 API를 한 번 받고,
// 이후 SSR·router.refresh로 새 창이 와도 받아 둔 전체와 다시 합친다(창 안 = 새 값, 창 밖 = 받아 둔 값).
// 창이 없는 schedule(편집실 미리보기·꾸미기·fixture)은 그대로 통과 — 같은 포스터 구현을 공유한다.
export function useFullSchedule(first: PublicSchedule): PublicSchedule {
  const [full, setFull] = useState<PublicSchedule | null>(null);
  const windowed = Boolean(first.window);
  const slug = first.calendar.slug;
  useEffect(() => {
    if (!windowed || full) return;
    const ctl = new AbortController();
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      fetch(`/api/public/${encodeURIComponent(slug)}/events`, { signal: ctl.signal })
        .then((res) => (res.ok ? (res.json() as Promise<PublicSchedule>) : Promise.reject(new Error(String(res.status)))))
        .then((data) => {
          if (Array.isArray(data?.events)) setFull(data);
        })
        .catch(() => {
          // 실패해도 창 데이터로 계속 보인다. 몇 번만 천천히 다시 시도(오프라인·일시 오류).
          if (ctl.signal.aborted || attempt >= 3) return;
          attempt += 1;
          timer = setTimeout(load, 2000 * attempt);
        });
    };
    load();
    return () => {
      ctl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [windowed, full, slug]);
  return useMemo(() => (full ? mergeWindowedSchedule(first, full) : first), [first, full]);
}
