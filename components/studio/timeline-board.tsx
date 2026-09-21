"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudioWriteQueue } from "@/lib/studio/use-write-queue";
import type { TimelineManagementRow, TimelineModerationAction } from "@/lib/broadcast/timeline-management-types";
import { formatTimecode } from "@/components/poster/vod-chapters";
import "./timeline-board.css";

const reasons: Record<string, string> = { overview: "방송 전체 안내", short: "짧은 장면 메모", focused: "일부 구간 중심", feedback: "피드백 표시" };
export function TimelineBoard({ rows, error }: { rows: TimelineManagementRow[]; error?: string | null }) {
  const router = useRouter();
  const moveQueue = useRef(Promise.resolve());
  const { studioWrite } = useStudioWriteQueue(moveQueue);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  async function save(titleNo: number, key: string | null, action: TimelineModerationAction) {
    setPending((prev) => new Set(prev).add(titleNo));
    try {
      const result = await studioWrite("vodTimeline", { titleNo, key, action });
      setMessage(result.ok ? "저장했어요. 재수집 후에도 설정이 유지됩니다." : result.error);
      if (result.ok) router.refresh();
    } catch { setMessage("저장하지 못했어요. 다시 시도해 주세요."); }
    finally { setPending((prev) => { const next = new Set(prev); next.delete(titleNo); return next; }); }
  }
  return <main className="timeline-board">
    <header>
      <Link href="/studio">← 편집실</Link>
      <h1>팬 타임라인</h1>
      <p>작성자별 내용을 비교하고 대표·노출을 정해요. 같은 작성자의 이어쓰기는 한 목록으로 묶습니다.</p>
      <form action="/studio/timelines" className="timeline-tools">
        <label>영상 번호 <input name="titleNo" inputMode="numeric" pattern="[0-9]+" placeholder="숲 다시보기 번호" /></label>
        <button type="submit">찾기</button><Link href={"/studio/timelines" as Route}>최근 영상</Link>
      </form>
      <label className="timeline-filter">목록 검색 <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="날짜·방송 제목" /></label>
      <p role="status">{message || error || "최근 40편을 표시해요. 이전 영상은 영상 번호로 찾을 수 있어요."}</p>
    </header>
    {rows.filter((r) => `${r.day} ${r.title}`.includes(filter)).map((row) => <section className="timeline-vod" key={row.titleNo} aria-label={row.title}>
      <div className="timeline-vod-head">
        <div><small>{row.day} · {row.titleNo}</small><h2>{row.title}</h2>
          <p>{row.pinnedKey ? "대표 수동 지정 중" : "대표 자동 선택 중"}</p></div>
        <button disabled={!row.pinnedKey || pending.has(row.titleNo)} onClick={() => void save(row.titleNo, null, "automatic")}>대표 자동 선택</button>
      </div>
      {!row.candidates.length ? <p>수집된 타임라인 후보가 없어요.</p> : row.candidates.map((c) => <article className="timeline-candidate" key={c.key}>
        <div><strong>{c.authorNick || "팬"}</strong> · {c.entries.length}개 · 댓글 {c.sourceCount}개
          {row.representativeKey === c.key ? <b className="timeline-badge">현재 대표</b> : null}
          {row.pinnedKey === c.key ? <span className="timeline-badge">지정됨</span> : null}
        </div>
        <p>{reasons[c.reason] ?? "확인할 타임라인"} · {!c.present ? "원본 없음" : c.visibility === "hide" ? "노출 제외" : c.visibility === "show" ? "노출 지정" : c.eligible ? "자동 노출" : "검토 대기"}</p>
        <div className="timeline-tools">
          <button disabled={!c.present || pending.has(row.titleNo)} onClick={() => void save(row.titleNo, c.key, "pin")}>대표로 지정</button>
          <button disabled={!c.present || pending.has(row.titleNo)} onClick={() => void save(row.titleNo, c.key, "show")}>노출</button>
          <button disabled={pending.has(row.titleNo)} onClick={() => void save(row.titleNo, c.key, "hide")}>노출 제외</button>
          <button disabled={pending.has(row.titleNo)} onClick={() => void save(row.titleNo, c.key, "auto")}>노출 자동</button>
        </div>
        <details><summary>내용 보기</summary><ol>{c.entries.map((e, i) => <li key={i}>
          <a href={`https://vod.sooplive.co.kr/player/${row.titleNo}?change_second=${e.sec}`} target="_blank" rel="noreferrer">{formatTimecode(e.sec)}</a> {e.section ? `${e.section} · ` : ""}{e.label}
        </li>)}</ol></details>
      </article>)}
    </section>)}
    {!rows.length && !error ? <p>해당 공개 다시보기를 찾지 못했어요.</p> : null}
  </main>;
}
