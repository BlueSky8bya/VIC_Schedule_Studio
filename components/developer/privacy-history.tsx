"use client";

import { useEffect, useState } from "react";
import { getPrivacyHistoryAction, type PrivacyHistoryRow } from "@/lib/legal/privacy-history";

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
    <p className="rhh-group-foot">개발자 전용 운영 기록 · 공개 방침에는 중요한 변경만 안내해요.</p>
    {rows.map(row => <div className="rhh-setting-row" key={row.effective}><span className="rhh-group-foot">{row.effective}</span><p className="rhh-val">{row.detail}</p></div>)}
  </section>;
}
