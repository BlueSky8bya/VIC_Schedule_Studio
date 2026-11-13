"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ExternalLink, Inbox, Mail, MailCheck, Monitor, Reply, Smartphone, Trash2, Undo2, X } from "lucide-react";
import { deleteReportAction, setReportDoneAction, setReportRepliedAction } from "@/lib/reports/actions";
import { REPORT_RETENTION_DAYS, REPORT_TOPICS, topicLabel } from "@/lib/reports/topics";
import { LEGAL_CONTACT_EMAIL } from "@/components/legal/contact";
import { LoadError, LoadingSpinner } from "@/components/shared/loading-state";
import { ToriDoodle } from "@/components/shared/tori-doodle";
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
  replied_at: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

const SITE = "빅토리 방송 일정표";

// Gmail 쓰기 창 주소 — 보내는 계정을 문의 계정으로 고정(authuser), 받는 사람·제목·본문을 채운다.
// 사이트가 메일을 대신 보내지 않는다(메일 발송 서비스·비밀값 없음): 개발자가 Gmail에서 확인하고 보낸다.
function gmailComposeUrl(to: string, subject: string, body: string): string {
  const q = new URLSearchParams({ view: "cm", fs: "1", authuser: LEGAL_CONTACT_EMAIL, to, su: subject, body });
  return `https://mail.google.com/mail/?${q.toString()}`;
}

function defaultReply(r: Row): { subject: string; body: string } {
  const quoted = r.body
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return {
    subject: `[${SITE}] ${topicLabel(r.topic)} 제보 답변`,
    body: `안녕하세요, ${SITE} 개발자입니다.\n보내 주신 제보 고맙습니다.\n\n\n\n---\n${fmt(r.created_at)}에 보내 주신 제보\n${quoted}\n`
  };
}

// 사이트 제보함 — 개발자 전용(app/(studio)/studio/reports). 처리 완료 → 90일 뒤 자동 삭제(lib/reports/report.ts).
export function ReportsBoard({ rows: initial, error }: { rows: Row[]; error: string | null }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);
  const [reply, setReply] = useState<{ row: Row; subject: string; body: string; opened: boolean } | null>(null);
  const replyRef = useRef<HTMLDialogElement>(null);
  const [, start] = useTransition();
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "open" ? !r.done_at : Boolean(r.done_at)));
  const openCount = rows.filter((r) => !r.done_at).length;

  useEffect(() => {
    if (reply && replyRef.current && !replyRef.current.open) replyRef.current.showModal();
  }, [reply]);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer(null);
      if (e.key === "ArrowRight") setViewer((v) => v && { ...v, index: (v.index + 1) % v.urls.length });
      if (e.key === "ArrowLeft") setViewer((v) => v && { ...v, index: (v.index - 1 + v.urls.length) % v.urls.length });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer]);

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

  const patch = (id: string, p: Partial<Row>) => setRows((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link className={styles.back} data-act="reports-back" href="/studio" prefetch>
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
      {!error && shown.length === 0 ? (
        <div className={styles.empty}>
          <ToriDoodle size={120} />
          <p>보여 줄 제보가 없어요.</p>
        </div>
      ) : null}

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
              {r.page ? <span className={styles.path}>{r.page}</span> : null}
              {r.replied_at ? (
                <span className={styles.repliedMark}>
                  <MailCheck size={13} /> 답장함 {fmt(r.replied_at)}
                </span>
              ) : null}
              {r.done_at ? <span className={styles.doneMark}>처리 완료 {fmt(r.done_at)}</span> : null}
            </div>
            <p className={styles.body}>{r.body}</p>
            {r.imageUrls.length ? (
              <div className={styles.shotsWrap}>
                <span className={styles.shotsCount}>캡처 {r.imageUrls.length}장</span>
                <div className={styles.shots}>
                  {r.imageUrls.map((u, i) => (
                    <button
                      aria-label={`캡처 ${i + 1} 크게 보기`}
                      className={styles.shot}
                      data-act="reports-shot"
                      key={u}
                      onClick={() => setViewer({ urls: r.imageUrls, index: i })}
                      type="button"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" src={u} />
                      <span>{i + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={styles.actions}>
              {r.reply_email ? (
                <button
                  className={`${styles.btn} ${styles.primary}`}
                  data-act="reports-reply"
                  onClick={() => setReply({ row: r, ...defaultReply(r), opened: false })}
                  type="button"
                >
                  <Reply size={14} /> {r.reply_email}에게 답장
                </button>
              ) : (
                <span className={styles.dim}>
                  <Mail size={13} /> 답장 메일 없음
                </span>
              )}
              <span className={styles.spacer} />
              {busy === r.id ? <LoadingSpinner small /> : null}
              {failed === r.id ? <span className={styles.fail}>실패 — 다시 시도해 주세요</span> : null}
              <button
                className={styles.btn}
                data-act="reports-done"
                disabled={busy === r.id}
                onClick={() => act(r.id, () => setReportDoneAction(r.id, !r.done_at), () => patch(r.id, { done_at: r.done_at ? null : new Date().toISOString() }))}
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
      <p className={styles.legend}>말머리: {REPORT_TOPICS.map((t) => t.label).join(" · ")}</p>

      {viewer ? (
        <div className={styles.viewer} onClick={() => setViewer(null)} role="presentation">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`캡처 ${viewer.index + 1}`} onClick={(e) => e.stopPropagation()} src={viewer.urls[viewer.index]} />
          {viewer.urls.length > 1 ? (
            <>
              <button
                aria-label="이전 캡처"
                className={`${styles.viewerNav} ${styles.prev}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewer({ ...viewer, index: (viewer.index - 1 + viewer.urls.length) % viewer.urls.length });
                }}
                type="button"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                aria-label="다음 캡처"
                className={`${styles.viewerNav} ${styles.next}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewer({ ...viewer, index: (viewer.index + 1) % viewer.urls.length });
                }}
                type="button"
              >
                <ChevronRight size={22} />
              </button>
            </>
          ) : null}
          <span className={styles.viewerNum}>
            {viewer.index + 1} / {viewer.urls.length}
          </span>
        </div>
      ) : null}

      {reply ? (
        <dialog
          aria-labelledby="reply-title"
          className={styles.reply}
          onClose={() => setReply(null)}
          ref={replyRef}
        >
          <div className={styles.replyCard}>
            <header className={styles.replyHead}>
              <h2 id="reply-title">
                <Reply size={18} /> 답장 쓰기
              </h2>
              <button aria-label="닫기" className={styles.iconBtn} data-act="reports-reply-close" onClick={() => replyRef.current?.close()} type="button">
                <X size={18} />
              </button>
            </header>
            <dl className={styles.replyMeta}>
              <div>
                <dt>보내는 사람</dt>
                <dd>{LEGAL_CONTACT_EMAIL}</dd>
              </div>
              <div>
                <dt>받는 사람</dt>
                <dd>{reply.row.reply_email}</dd>
              </div>
            </dl>
            <label className={styles.field}>
              <span>제목</span>
              <input onChange={(e) => setReply({ ...reply, subject: e.target.value })} value={reply.subject} />
            </label>
            <label className={styles.field}>
              <span>본문</span>
              <textarea onChange={(e) => setReply({ ...reply, body: e.target.value })} rows={11} value={reply.body} />
            </label>
            <p className={styles.replyNote}>
              Gmail 쓰기 창이 새 창으로 열립니다. 내용을 확인하고 Gmail에서 보내기를 누르면 전송됩니다.
            </p>
            <div className={styles.replyActions}>
              {reply.opened ? (
                <button
                  className={styles.btn}
                  data-act="reports-replied"
                  onClick={() => {
                    const id = reply.row.id;
                    act(id, () => setReportRepliedAction(id, true), () => patch(id, { replied_at: new Date().toISOString() }));
                    replyRef.current?.close();
                  }}
                  type="button"
                >
                  <MailCheck size={14} /> 보냈어요 — 답장함으로 표시
                </button>
              ) : null}
              <button
                className={`${styles.btn} ${styles.primary}`}
                data-act="reports-reply-gmail"
                onClick={() => {
                  window.open(gmailComposeUrl(reply.row.reply_email ?? "", reply.subject, reply.body), "vic-reply", "popup,width=720,height=760");
                  setReply({ ...reply, opened: true });
                }}
                type="button"
              >
                <ExternalLink size={14} /> Gmail로 쓰기
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </main>
  );
}
