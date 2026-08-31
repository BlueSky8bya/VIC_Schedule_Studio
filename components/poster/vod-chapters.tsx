"use client";

import { useState } from "react";
import type { PublicVodTimeline } from "@/lib/domain/schedule-types";
import { hapticTick } from "@/lib/ui/haptics";

// 다시보기 챕터(팬 타임라인, 0071) — PC 날짜 팝오버·모바일 아젠다 칩 아래 공용.
//
// 인지 설계(2026-08-31 사용자 논의):
//  · 팬이 적은 [코너] 헤더를 그룹 앵커로 살린다 — "게임 구간 어딘가"까지 텍스트 없이 좁혀진다.
//  · 항목마다 구간 길이(다음 항목까지)를 표기 — 라벨이 암시적이어도 코너의 무게가 보인다.
//  · 항목 탭 = 그 시각으로 숲 플레이어 점프(?change_second= — 실측 확정). 확인 비용을 낮추는 게
//    본질: 후보를 몇 개 찍어 3초씩 확인하는 흐름이 자연스럽게.
// 본문은 무거워서(최대 100+줄) 펼칠 때만 받아온다. 개수·작성자는 공개 번들이 이미 안다.
export function VodChapters({
  slug,
  titleNo,
  durationMs,
  chapters,
  timelineBy
}: {
  slug: string;
  titleNo: number;
  durationMs: number;
  chapters: number;
  timelineBy: string;
}) {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState<PublicVodTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (chapters <= 0) return null;

  const toggle = async () => {
    hapticTick();
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (timeline || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/public/${slug}/vod-timeline?titleNo=${titleNo}`);
      const json = (await res.json()) as PublicVodTimeline;
      if (Array.isArray(json.entries) && json.entries.length > 0) setTimeline(json);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const hhmmss = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  };
  // 구간 길이 = 다음 항목까지(마지막은 영상 끝까지). 1분 미만은 소음이라 생략.
  const spanOf = (i: number): string | null => {
    const list = timeline?.entries ?? [];
    const endSec = i + 1 < list.length ? list[i + 1].sec : Math.round(durationMs / 1000);
    const span = endSec - list[i].sec;
    if (!(span >= 60)) return null;
    const h = Math.floor(span / 3600);
    const m = Math.round((span % 3600) / 60);
    return h > 0 ? (m > 0 ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
  };

  return (
    <div className="vod-chapters">
      <button
        aria-expanded={open}
        className="vch-toggle"
        data-act="vod-chapters-open"
        onClick={toggle}
        type="button"
      >
        <span aria-hidden="true" className="vch-caret">{open ? "▾" : "▸"}</span>
        챕터 {chapters}개
        {timelineBy ? <em className="vch-by">타임라인 · {timelineBy}님</em> : null}
      </button>
      {!open ? null : loading ? (
        <p className="vch-note">불러오는 중…</p>
      ) : failed || !timeline ? (
        <p className="vch-note">챕터를 불러오지 못했어요.</p>
      ) : (
        <ol className="vch-list">
          {timeline.entries.map((e, i) => {
            const prevSection = i > 0 ? timeline.entries[i - 1].section : null;
            const span = spanOf(i);
            return (
              <li key={`${e.sec}-${i}`}>
                {e.section && e.section !== prevSection ? (
                  <div className="vch-sec">{e.section}</div>
                ) : null}
                <a
                  className="vch-item"
                  data-act="vod-chapter-jump"
                  href={`https://vod.sooplive.co.kr/player/${titleNo}?change_second=${e.sec}`}
                  onClick={() => hapticTick()}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <time className="vch-t">{hhmmss(e.sec)}</time>
                  <span className="vch-label">{e.label}</span>
                  {span ? <em className="vch-span">{span}</em> : null}
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
