"use client";

import { RotateCw } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import {
  DEVICE_META,
  ROLE_META,
  type VisitScope,
  VisitSummaryBlock,
  deviceColor,
  deviceLabel,
  fmtDur,
  fmtOcc,
  hhmm,
  kstOf,
  roleColor
} from "@/components/developer/insights-dashboard";
import { ActivityTimeline } from "@/components/developer/activity-timeline";
import { ActivityUsage } from "@/components/developer/activity-usage";
import { getDayVisitDetailAction, type DayVisitDetail } from "@/lib/insights/actions";
import { hapticTick } from "@/lib/ui/haptics";

// 개발자가 달력에서 날짜를 클릭하면 뜨는 "그날 방문 상세" — 월별 인사이트 방문 패널의 하루판(드릴다운).
// 방문 수(역할/기기) + 24h 동시 접속(체류) + 관리자 접속 세션. 모달 골격은 부모(studio-shell)가 제공.
type OccTip = { x: number; avg: number; peak: number; rows: { color: string; label: string; val: number }[] };

export function DayVisitModal({ dateKey }: { dateKey: string }) {
  const [data, setData] = useState<DayVisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 수동 새로고침 — 내용은 유지하고 위에 베일
  const [refreshed, setRefreshed] = useState(false); // 갱신 완료 펄스
  const refreshedTimer = useRef<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dim, setDim] = useState<"role" | "device">("role");
  const [scope, setScope] = useState<VisitScope>("viewer"); // 시청자/운영진/전체 — 분해·동접 즉시 전환
  const [logRole, setLogRole] = useState<string | null>(null); // 세션 로그 역할 필터(null=전체)
  const [logStay, setLogStay] = useState<"all" | "stay" | "glance">("all"); // 머문/스쳐감 필터
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

  useEffect(
    () => () => {
      if (refreshedTimer.current) window.clearTimeout(refreshedTimer.current);
    },
    []
  );

  // 이 날 상세만 다시 불러 즉시 갱신 — 내용은 그대로 두고 위에 흐림+로딩 베일을 띄워 다시 로딩되는 티.
  // 햅틱 두 박자(누름+응답). 응답이 빨라도 베일이 보이게 최소 550ms.
  async function refresh() {
    if (refreshing) return;
    hapticTick();
    setRefreshing(true);
    setRefreshed(false);
    if (refreshedTimer.current) window.clearTimeout(refreshedTimer.current);
    const minSpin = new Promise<void>((res) => window.setTimeout(res, 550));
    const work = getDayVisitDetailAction(dateKey).then((r) => {
      if (r.ok) setData(r.data);
      else setErr(r.error);
    });
    try {
      await Promise.all([work, minSpin]);
      hapticTick();
      setRefreshed(true);
      refreshedTimer.current = window.setTimeout(() => setRefreshed(false), 1400);
    } finally {
      setRefreshing(false);
    }
  }

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
  // 토글이 고른 묶음 — 역할/기기 분해·동접 그래프 전부 이걸 쓴다.
  const dg = scope === "viewer" ? data.viewer : scope === "operator" ? data.operator : data.all;
  const visitCounts = dim === "role" ? dg.visits.roles : dg.visits.devices;
  // 역할별=방문 수(계정 dedup, total). 기기별=기기 합(한 계정이 웹·안드면 2대) → 분해 합과 일치하게.
  const visitTotal =
    dim === "role"
      ? dg.visits.total
      : Object.values(dg.visits.devices).reduce((a, b) => a + b, 0);
  const om = Math.max(0.0001, ...dg.occupancy.map((s) => s.avg));
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
    // 웹: 2×2 카드 그리드(.dayvisit→grid) — 요약 풀폭, 아래 4카드 좌우 배치로 가로폭을 채운다.
    // 모바일: 같은 마크업이 한 줄 세로 스택(컴팩트, 테두리 없음).
    <div className="dayvisit-wrap" data-refreshing={refreshing ? "" : undefined}>
      <div className="dayvisit-head">
        <button
          aria-label="이 날 방문 상세 새로고침"
          className="insights-refresh"
          data-done={refreshed ? "" : undefined}
          data-spin={refreshing ? "" : undefined}
          disabled={refreshing}
          onClick={refresh}
          title="이 날 방문 상세 새로고침"
          type="button"
         data-act="이 날 방문 상세 새로고침">
          <RotateCw aria-hidden="true" size={15} />
        </button>
      </div>
      {refreshing ? (
        <div className="insights-veil" aria-hidden="true">
          <RotateCw className="insights-veil-icon" size={22} />
          <span>불러오는 중…</span>
        </div>
      ) : null}
      <div className="dayvisit">
        {/* 방문 품질 요약(의미 방문 컷·시청자/운영진 토글·KPI·최고동접) — 그날 기준. 풀폭 */}
      <VisitSummaryBlock
        viewer={data.summaryViewer}
        operator={data.summaryOperator}
        all={data.summaryAll}
        newVisitors={data.newVisitors}
        returningVisitors={data.returningVisitors}
        scope={scope}
        onScope={setScope}
      />
      {/* 방문 수 + 역할/기기 분해 */}
      <section className="vcard">
        <div className="dv-top">
          <div className="dv-total">
            <strong>{visitTotal}</strong>
            {/* 기기별 탭은 기기 합(분해 막대 합과 일치), 역할별은 방문 수. */}
            <span>{dim === "device" ? "기기" : "방문"}</span>
          </div>
          <div className="insights-subtabs dv-dim">
            <button
              className={dim === "role" ? "active" : ""}
              onClick={() => {
                hapticTick();
                setDim("role");
              }}
              type="button"
            >
              역할별
            </button>
            <button
              className={dim === "device" ? "active" : ""}
              onClick={() => {
                hapticTick();
                setDim("device");
              }}
              type="button"
            >
              기기별
            </button>
          </div>
        </div>
        {visitTotal > 0 ? (
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
      </section>

      {/* 24h 동시 접속(체류) */}
      <section className="vcard">
        <h4 className="insight-subhead">
          시간대별 동접 (KST) <span className="vcrit">머문 분</span>
        </h4>
        <div
          className={`vt-hours ${dg.hasOccupancy ? "" : "empty"}`}
          role="img"
          aria-label="그날 시간대별 동시 접속"
          onPointerLeave={() => setOccTip(null)}
        >
          {dg.occupancy.map((slot, h) => {
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
                {fmtOcc(occTip.avg)} 머묾 · 최고 {occTip.peak}명
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
          {dg.hasOccupancy ? null : (
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
      </section>

      {/* 그날 무엇을 했는지(0062) — 방문 기록이 '언제·얼마나'라면 이건 '무엇을'이다. */}
      <ActivityTimeline dateKey={dateKey} />

      {/* 하루가 아니라 기간 누적 — "어떤 버튼이 안 쓰이나"는 하루로는 안 보인다. */}
      <ActivityUsage anchor={dateKey} />

      {/* 관리자 방문 기록 — 언제·어떤 계정으로 들어왔는지(설정된 owner 이메일이면 이메일로 표시). */}
      <section className="vcard">
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
                    {/* 한 방문 안에서 페이지를 옮긴 횟수(0061). 예전엔 이동마다 별도 방문으로 찍혔다. */}
                    {v.segments > 1 ? ` · 이동 ${v.segments - 1}회` : ""}
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
      </section>

      {/* 관리자 접속 세션 */}
      <section className="vcard">
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
      </section>

      {/* 그날 전체 세션 로그(전 역할 · 개발자 디버깅) — 월별 '세션 로그'의 하루판. 풀폭. */}
      <section className="vcard full">
        <h4 className="insight-subhead">세션 로그</h4>
        {data.sessions.length > 0 ? (
          <details className="vrecent" open>
            <summary>세션 {data.sessions.length}건</summary>
            {/* 역할 필터 — 전 역할(ROLE_META) 상시 노출 + 건수, 0건은 흐리게. 월별과 동일. */}
            <div className="vlog-filter" role="group" aria-label="역할 필터">
              <button
                className={`vlog-chip${logRole === null ? " on" : ""}`}
                onClick={() => {
                  hapticTick();
                  setLogRole(null);
                }}
                type="button"
               data-act="vlog-chip">
                전체 <b>{data.sessions.length}</b>
              </button>
              {ROLE_META.map((m) => {
                const c = data.sessions.filter((r) => r.role === m.key).length;
                return (
                  <button
                    className={`vlog-chip${logRole === m.key ? " on" : ""}${c === 0 ? " zero" : ""}`}
                    data-role={m.key}
                    key={m.key}
                    onClick={() => {
                      hapticTick();
                      setLogRole((cur) => (cur === m.key ? null : m.key));
                    }}
                    style={{ "--rc": m.color } as CSSProperties}
                    type="button"
                   data-act="vlog-chip">
                    {m.label} <b>{c}</b>
                  </button>
                );
              })}
            </div>
            {/* 머문/스쳐감 필터 — 월별과 동일. */}
            {(() => {
              const stayN = data.sessions.filter((r) => r.meaningful).length;
              const glanceN = data.sessions.length - stayN;
              const opts: { key: "all" | "stay" | "glance"; label: string; n: number }[] = [
                { key: "all", label: "전체", n: data.sessions.length },
                { key: "stay", label: "머문", n: stayN },
                { key: "glance", label: "스쳐감", n: glanceN }
              ];
              return (
                <div className="vlog-filter stay" role="group" aria-label="머문/스쳐감 필터">
                  {opts.map((o) => (
                    <button
                      className={`vlog-chip${logStay === o.key ? " on" : ""}${o.n === 0 ? " zero" : ""}`}
                      key={o.key}
                      onClick={() => {
                        hapticTick();
                        setLogStay(o.key);
                      }}
                      type="button"
                     data-act="vlog-chip">
                      {o.label} <b>{o.n}</b>
                    </button>
                  ))}
                </div>
              );
            })()}
            <ul className="vlog">
              {(() => {
                const shown = data.sessions.filter(
                  (r) =>
                    (!logRole || r.role === logRole) &&
                    (logStay === "all" || (logStay === "stay" ? r.meaningful : !r.meaningful))
                );
                if (shown.length === 0) {
                  return <li className="vlog-empty">조건에 맞는 세션이 없어요.</li>;
                }
                return shown.map((r, i) => (
                  <li className={`vlog-row${r.meaningful ? "" : " glance"}`} key={i}>
                    <span
                      aria-hidden="true"
                      className="vlog-dot"
                      style={{ background: deviceColor(r.device) }}
                    />
                    <div className="vlog-main">
                      <div className="vlog-line1">
                        <span
                          className="vrecent-role"
                          data-role={r.role}
                          style={{ "--rc": roleColor(r.role) } as CSSProperties}
                        >
                          {r.label}
                          {r.dual ? <em className="vlog-dual">겸</em> : null}
                        </span>
                        <time className="vlog-t">{hhmm(r.t)}</time>
                      </div>
                      <div className="vlog-line2">
                        <span className="vlog-dev">{deviceLabel(r.device)}</span>
                        <span className="vlog-dur">
                          {fmtDur(r.seconds)}
                          {r.meaningful ? "" : " · 스쳐감"}
                        </span>
                      </div>
                    </div>
                  </li>
                ));
              })()}
            </ul>
          </details>
        ) : (
          <p className="insight-empty">이 날 세션 기록이 없어요.</p>
        )}
      </section>
      </div>
    </div>
  );
}
