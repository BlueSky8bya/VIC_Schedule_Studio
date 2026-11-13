"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Inbox, Mail, Monitor, Smartphone, Trash2, Undo2 } from "lucide-react";
import { deleteReportAction, setReportDoneAction } from "@/lib/reports/actions";
import { REPORT_RETENTION_DAYS, REPORT_TOPICS, topicLabel } from "@/lib/reports/topics";
import { LoadError, LoadingSpinner } from "@/components/shared/loading-state";
import styles from "./reports-board.module.css";

type Row = {
  id: string;
  created_at: string;
  topic: string;
  body: string;
  reply_email: string | null;
  page: string | null;
  device: string | null;
  imageUrls: string[];
  done_at: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

// 사이트 제보함 — 개발자 전용(app/(studio)/studio/reports). 처리 완료 → 90일 뒤 자동 삭제(lib/reports/report.ts).
export function ReportsBoard({ rows: initial, error }: { rows: Row[]; error: string | null }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [, start] = useTransition();
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "open" ? !r.done_at : Boolean(r.done_at)));
  const openCount = rows.filter((r) => !r.done_at).length;

  const act = (id: string, run: () => Promise<{ ok: boolean }>, apply: () => void) => {
    setBusy(id);
    setFailed(null);
    start(async () => {
      const res = await run().catch(() => ({ ok: false }));
      setBusy(null);
      if (res.ok) apply();
      else setFailed(id);
    });
  };

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link className={styles.back} data-act="reports-back" href="/studio">
          <ArrowLeft size={16} /> 편집실
        </Link>
        <h1>
          <Inbox size={20} /> 사이트 제보함
        </h1>
        <p>처리 완료로 표시한 제보는 {REPORT_RETENTION_DAYS}일 뒤 캡처와 함께 자동 삭제됩니다.</p>
        <div className={styles.filters} role="radiogroup" aria-label="보기">
          {(
            [
              ["open", `처리 전 ${openCount}`],
              ["done", "처리 완료"],
              ["all", "전체"]
            ] as const
          ).map(([v, label]) => (
            <button
              aria-checked={filter === v}
              className={filter === v ? styles.on : undefined}
              data-act="reports-filter"
              data-act-opt={v}
              key={v}
              onClick={() => setFilter(v)}
              role="radio"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error ? <LoadError message={error} /> : null}
      {!error && shown.length === 0 ? <p className={styles.empty}>보여 줄 제보가 없어요.</p> : null}

      <ul className={styles.list}>
        {shown.map((r) => (
          <li className={`${styles.item}${r.done_at ? ` ${styles.done}` : ""}`} key={r.id}>
            <div className={styles.meta}>
              <span className={styles.topic} data-topic={r.topic}>
                {topicLabel(r.topic)}
              </span>
              <time dateTime={r.created_at}>{fmt(r.created_at)}</time>
              {r.device ? (
                <span className={styles.dim}>
                  {r.device === "mobile" ? <Smartphone size={13} /> : <Monitor size={13} />}
                  {r.device === "mobile" ? "모바일" : "PC"}
                </span>
              ) : null}
              {r.page ? <code className={styles.dim}>{r.page}</code> : null}
              {r.done_at ? <span className={styles.doneMark}>처리 완료 {fmt(r.done_at)}</span> : null}
            </div>
            <p className={styles.body}>{r.body}</p>
            {r.imageUrls.length ? (
              <div className={styles.shots}>
                {r.imageUrls.map((u, i) => (
                  <a href={u} key={u} rel="noreferrer" target="_blank">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`캡처 ${i + 1}`} src={u} />
                  </a>
                ))}
              </div>
            ) : null}
            <div className={styles.actions}>
              {r.reply_email ? (
                <a className={styles.btn} data-act="reports-reply" href={`mailto:${r.reply_email}?subject=${encodeURIComponent(`[빅토리 방송 일정표] ${topicLabel(r.topic)} 제보 답변`)}`}>
                  <Mail size={14} /> {r.reply_email}
                </a>
              ) : (
                <span className={styles.dim}>답장 메일 없음</span>
              )}
              <span className={styles.spacer} />
              {busy === r.id ? <LoadingSpinner small /> : null}
              {failed === r.id ? <span className={styles.fail}>실패 — 다시 시도해 주세요</span> : null}
              <button
                className={styles.btn}
                data-act="reports-done"
                disabled={busy === r.id}
                onClick={() =>
                  act(r.id, () => setReportDoneAction(r.id, !r.done_at), () =>
                    setRows((all) => all.map((x) => (x.id === r.id ? { ...x, done_at: x.done_at ? null : new Date().toISOString() } : x)))
                  )
                }
                type="button"
              >
                {r.done_at ? <Undo2 size={14} /> : <Check size={14} />}
                {r.done_at ? "처리 전으로" : "처리 완료"}
              </button>
              <button
                className={`${styles.btn} ${styles.danger}`}
                data-act="reports-delete"
                disabled={busy === r.id}
                onClick={() => {
                  if (!window.confirm("이 제보를 캡처와 함께 지울까요? 되돌릴 수 없어요.")) return;
                  act(r.id, () => deleteReportAction(r.id), () => setRows((all) => all.filter((x) => x.id !== r.id)));
                }}
                type="button"
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.legend}>
        말머리: {REPORT_TOPICS.map((t) => t.label).join(" · ")}
      </p>
    </main>
  );
}
