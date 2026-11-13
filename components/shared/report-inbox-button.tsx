"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { getUnseenReportCountAction } from "@/lib/reports/actions";
import "./report-inbox-button.css";

// 사이트 제보함 단추(2026-11-13 소유자) — 개발자에게만, PC 헤더의 설정·밝기 토글 옆(같은 44px). 아직 보지 않은 제보 수를
// 배지로. 1분마다·창으로 돌아올 때 다시 센다. 모바일은 자리가 좁아 두지 않는다(설정 → 개발자 → 사이트 제보함).
const POLL_MS = 60_000;

export function ReportInboxButton() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      void getUnseenReportCountAction()
        .then((n) => {
          if (alive) setCount(n);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const unseen = count ?? 0;
  const label = unseen > 0 ? `사이트 제보함 — 새 제보 ${unseen}건` : "사이트 제보함";
  return (
    <Link aria-label={label} className="viewer-settings-open report-inbox-btn" data-act="report-inbox" data-tip={label} href={"/studio/reports" as Route} prefetch>
      <Inbox aria-hidden="true" size={17} strokeWidth={2.2} />
      {unseen > 0 ? (
        <span aria-hidden="true" className="report-inbox-badge">
          {unseen > 99 ? "99+" : unseen}
        </span>
      ) : null}
    </Link>
  );
}
