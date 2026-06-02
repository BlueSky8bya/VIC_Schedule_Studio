"use client";

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";
import {
  DEVICE_META,
  ROLE_META,
  fmtDur,
  fmtOcc,
  hhmm,
  kstOf
} from "@/components/developer/insights-dashboard";
import { getDayVisitDetailAction, type DayVisitDetail } from "@/lib/insights/actions";

// 개발자가 달력에서 날짜를 클릭하면 뜨는 "그날 방문 상세" — 월별 인사이트 방문 패널의 하루판(드릴다운).
// 방문 수(역할/기기) + 24h 동시 접속(체류) + 관리자 접속 세션. 모달 골격은 부모(studio-shell)가 제공.
type OccTip = { x: number; avg: number; peak: number; rows: { color: string; label: string; val: number }[] };

export function DayVisitModal({ dateKey }: { dateKey: string }) {
  const [data, setData] = useState<DayVisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dim, setDim] = useState<"role" | "device">("role");
  const [occTip, setOccTip] = useState<OccTip | null>(null);
  const [ownTip, setOwnTip] = useState<{ x: number; top: number; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    getDayVisitDetailAction(dateKey)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setData(r.data);
        else setErr(r.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dateKey]);

  if (loading) {
    return (
      <div className="insight-skel" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (err || !data) {
    return <p className="insight-empty">{err ?? "불러오지 못했어요."}</p>;
  }

  const meta = dim === "role" ? ROLE_META : DEVICE_META;
  const visitCounts = dim === "role" ? data.visits.roles : data.visits.devices;
  const om = Math.max(0.0001, ...data.occupancy.map((s) => s.avg));
  const devMeta = (k: string) => DEVICE_META.find((m) => m.key === k) ?? DEVICE_META[0];

  // 관리자 세션 → 24h 트랙 좌표 + 목록(시작 순).
  const segs = data.ownerSessions
    .map((s) => {
      const d = kstOf(s.startMs);
      const startFrac = (d.getUTCHours() + d.getUTCMinutes() / 60) / 24;
      const widthFrac = Math.min(1 - startFrac, Math.max(s.seconds / 3600 / 24, 0));
      return {
        startFrac,
        widthFrac,
        device: s.device,
        seconds: s.seconds,
        startMs: s.startMs,
        timeLabel: `${hhmm(s.startMs)}–${hhmm(s.endMs)}`,
        tip: `${hhmm(s.startMs)}–${hhmm(s.endMs)} · ${fmtDur(s.seconds)} · ${devMeta(s.device).label}`
      };
    })
    .sort((a, b) => a.startMs - b.startMs);

  const onOwnSeg = (e: ReactPointerEvent<HTMLElement>, text: string) => {
    const cont = e.currentTarget.closest(".own-sessions") as HTMLElement | null;
    if (!cont) return;
    const cr = cont.getBoundingClientRect();
    const sr = e.currentTarget.getBoundingClientRect();
    setOwnTip({ x: ((sr.left + sr.width / 2 - cr.left) / cr.width) * 100, top: sr.top - cr.top, text });
  };

  return (
    <div className="dayvisit">
      {/* 방문 수 + 역할/기기 분해 */}
      <div className="dv-top">
        <div className="dv-total">
          <strong>{data.visits.total}</strong>
          {/* 기기별 탭에선 단위를 '기기'로 — 방문 1건 = 기기 1대라 수는 같아도 의미가 맞다. */}
          <span>{dim === "device" ? "기기" : "방문"}</span>
        </div>
        <div className="insights-subtabs dv-dim">
          <button className={dim === "role" ? "active" : ""} onClick={() => setDim("role")} type="button">
            역할별
          </button>
          <button className={dim === "device" ? "active" : ""} onClick={() => setDim("device")} type="button">
            기기별
          </button>
        </div>
      </div>
      {data.visits.total > 0 ? (
        <ul className="dv-breakdown">
          {meta.map((m) =>
            (visitCounts[m.key] ?? 0) > 0 ? (
              <li key={m.key}>
                <span style={{ background: m.color }} />
                {m.label}
                <b>{visitCounts[m.key]}</b>
              </li>
            ) : null
          )}
        </ul>
      ) : (
        <p className="insight-empty">이 날 방문 기록이 없어요.</p>
      )}

      {/* 24h 동시 접속(체류) */}
      <h4 className="insight-subhead">시간대별 동시 접속 · 체류 (KST)</h4>
      <p className="vt-occ-note">막대 = 그날 평균 동시 접속(방문자 기준) · 호버 시 최고치도 표시</p>
      <div
        className={`vt-hours ${data.hasOccupancy ? "" : "empty"}`}
        role="img"
        aria-label="그날 시간대별 동시 접속"
        onPointerLeave={() => setOccTip(null)}
      >
        {data.occupancy.map((slot, h) => {
          const counts = dim === "role" ? slot.roles : slot.devices;
          const enter = () => {
            if (slot.avg <= 0) {
              setOccTip(null);
              return;
            }
            const rows = meta
              .map((m) => ({ color: m.color, label: m.label, val: counts[m.key] ?? 0 }))
              .filter((r) => r.val > 0.001);
            setOccTip({ x: ((h + 0.5) / 24) * 100, avg: slot.avg, peak: slot.peak, rows });
          };
          return (
            <div
              className="vt-hcol"
              key={h}
              onPointerEnter={enter}
              onPointerMove={enter}
              onPointerLeave={() => setOccTip(null)}
            >
              <div className="vt-hbar" style={{ height: `${(slot.avg / om) * 100}%` }}>
                <div className="vt-fill">
                  {meta.map((m) => {
                    const c = counts[m.key] ?? 0;
                    // 비율(c/총합)로 정규화 — flex-grow 합<1이면 fill이 막대를 다 못 채워 배경이 비친다.
                    return c > 0 ? (
                      <span
                        className="vt-seg"
                        key={m.key}
                        style={{ flexGrow: slot.avg > 0 ? c / slot.avg : 1, background: m.color }}
                      />
                    ) : null;
                  })}
                </div>
              </div>
              <span className="vt-hlabel">{h % 6 === 0 ? h : ""}</span>
            </div>
          );
        })}
        {occTip ? (
          <div className="vt-tip" style={{ "--tip-x": `${occTip.x}%` } as CSSProperties}>
            <strong>
              평균 {fmtOcc(occTip.avg)} · 최고 {occTip.peak}
            </strong>
            {occTip.rows.map((r) => (
              <span className="vt-tip-row" key={r.label}>
                <i style={{ background: r.color }} />
                {r.label}
                <b>{fmtOcc(r.val)}</b>
              </span>
            ))}
          </div>
        ) : null}
        {data.hasOccupancy ? null : (
          <span className="vt-hours-empty">이 날 동시 접속 핑이 없어요</span>
        )}
      </div>
      <ul className="vt-legend">
        {meta.map((m) => (
          <li key={m.key}>
            <span style={{ background: m.color }} />
            {m.label}
          </li>
        ))}
      </ul>

      {/* 관리자 방문 기록 — 언제·어떤 계정으로 들어왔는지(설정된 owner 이메일이면 이메일로 표시). */}
      <h4 className="insight-subhead">관리자 방문 기록</h4>
      {data.ownerVisits.length > 0 ? (
        <>
          <ul className="dv-sessions">
            {data.ownerVisits.map((v, i) => (
              <li key={i}>
                <span className="dv-dev" style={{ background: devMeta(v.device).color }} />
                <span className="dv-time">{v.t ? hhmm(v.t) : "—"}</span>
                <b className="dv-acct">{v.account}</b>
                <em>
                  {fmtDur(v.seconds)} · {devMeta(v.device).label}
                </em>
              </li>
            ))}
          </ul>
          {/* 세션 모델이라 체류는 초 단위로 정확. 합이 매우 짧으면(0~수초) 화면을 사실상 안 본 것. */}
          <p className="vt-occ-note">
            {data.ownerSeconds > 0
              ? `관리자 총 체류 ${fmtDur(data.ownerSeconds)}`
              : "체류 0초 — 화면을 거의 안 봤어요(열리자마자 나감/숨김)."}
          </p>
        </>
      ) : (
        <p className="insight-empty">이 날 관리자 방문 기록이 없어요.</p>
      )}

      {/* 관리자 접속 세션 */}
      <h4 className="insight-subhead">관리자 접속 세션</h4>
      {segs.length > 0 ? (
        <>
          <div className="own-sessions" onPointerLeave={() => setOwnTip(null)}>
            <div className="own-row solo">
              <div className="own-track">
                {segs.map((s, i) => (
                  <span
                    className="own-seg"
                    key={i}
                    onPointerEnter={(e) => onOwnSeg(e, s.tip)}
                    onPointerMove={(e) => onOwnSeg(e, s.tip)}
                    onPointerLeave={() => setOwnTip(null)}
                    style={{
                      left: `${s.startFrac * 100}%`,
                      width: `${s.widthFrac * 100}%`,
                      background: devMeta(s.device).color
                    }}
                    title={s.tip}
                  />
                ))}
              </div>
            </div>
            <div className="own-axis solo" aria-hidden="true">
              <span>0</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
            </div>
            {ownTip ? (
              <div
                className="vt-tip own-tip"
                style={{ "--tip-x": `${ownTip.x}%`, top: ownTip.top } as CSSProperties}
              >
                <strong>{ownTip.text}</strong>
              </div>
            ) : null}
          </div>
          <ul className="dv-sessions">
            {segs.map((s, i) => (
              <li key={i}>
                <span className="dv-dev" style={{ background: devMeta(s.device).color }} />
                <span className="dv-time">{s.timeLabel}</span>
                <b>{fmtDur(s.seconds)}</b>
                <em>{devMeta(s.device).label}</em>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="insight-empty">이 날 관리자 접속 세션이 없어요.</p>
      )}
    </div>
  );
}
