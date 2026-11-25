"use client";

import { useEffect, useState } from "react";
import { LegalTable } from "@/components/legal/legal-doc";
import { getPrivacyHistoryAction, type PrivacyHistoryRow } from "@/lib/legal/privacy-history";

// Same table as the public policy pages (LegalTable) so the history reads like the old in-policy comparison.
export function PrivacyHistory() {
  const [rows, setRows] = useState<PrivacyHistoryRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    getPrivacyHistoryAction().then(result => { if (alive && result.ok) setRows(result.rows); }).catch(() => { /* Fail closed. */ });
    return () => { alive = false; };
  }, []);
  if (!rows) return null;
  return <section className="rhh-group-card" aria-label="개인정보처리방침 상세 이력">
    <h3 className="rhh-group-title">개인정보처리방침 상세 이력</h3>
    <p className="rhh-group-foot">개발자 전용 운영 기록 · 최근 변경이 위</p>
    <LegalTable
      head={["시행일", "구분", "변경 내용"]}
      rows={[...rows].reverse().map(row => [
        <span key="d" style={{ whiteSpace: "nowrap" }}>{row.effective}</span>,
        <span key="k" style={{ whiteSpace: "nowrap" }}>{row.kind}</span>,
        <span key="t" style={{ wordBreak: "keep-all" }}>{row.detail}</span>,
      ])}
    />
  </section>;
}
