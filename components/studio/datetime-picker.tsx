"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDayMark } from "@/lib/calendar/holidays";
import { MOBILE_QUERY } from "@/lib/ui/breakpoints";
import { hapticTick } from "@/lib/ui/haptics";

// 떡밥 공개 시각용 커스텀 날짜·시간 선택기 — 네이티브 datetime-local 대신 앱 톤에 맞춘 전용 UI.
// 웹(≥641px): 트리거 아래 팝오버. 모바일(≤640px): 아래에서 올라오는 바텀시트.
// 시간은 스크롤 휠(스냅 + 햅틱)이라 손맛 있다. value/onChange는 "YYYY-MM-DDTHH:mm"(KST 벽시계).

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const z2 = (n: number) => String(n).padStart(2, "0");

type Parts = { y: number; m: number; d: number; hh: number; mm: number };

function parse(v: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3], hh: +m[4], mm: +m[5] };
}
function fmtValue(p: Parts): string {
  return `${p.y}-${z2(p.m)}-${z2(p.d)}T${z2(p.hh)}:${z2(p.mm)}`;
}
function weekdayOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function fmtLabel(p: Parts | null): string {
  if (!p) return "공개 시각 선택";
  const wd = WD[weekdayOf(p.y, p.m, p.d)];
  const ampm = p.hh < 12 ? "오전" : "오후";
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
  return `${p.y}.${z2(p.m)}.${z2(p.d)} (${wd}) ${ampm} ${h12}:${z2(p.mm)}`;
}
function nowKstParts(): Parts {
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  return {
    y: k.getUTCFullYear(),
    m: k.getUTCMonth() + 1,
    d: k.getUTCDate(),
    hh: k.getUTCHours(),
    mm: k.getUTCMinutes()
  };
}
function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const ITEM = 36; // 휠 한 칸 높이(px) — CSS .dtp-wheel-item height와 일치해야 한다.

function Wheel({
  count,
  value,
  onChange,
  label
}: {
  count: number;
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(value);
  const settleRef = useRef<number | null>(null);
  const progAt = useRef(0); // 프로그램적 스크롤 시각 — 그로 인한 settle은 onChange를 건너뛴다.

  // 외부 값이 바뀌면(또는 처음) 그 칸이 가운데 오게 스크롤.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    progAt.current = Date.now();
    el.scrollTop = value * ITEM;
    setActive(value);
  }, [value]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(count - 1, Math.round(el.scrollTop / ITEM)));
    if (i !== active) {
      setActive(i);
      hapticTick(); // 한 칸 넘어갈 때마다 톡 — 손맛
    }
    if (settleRef.current) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      const idx = Math.max(0, Math.min(count - 1, Math.round(el.scrollTop / ITEM)));
      el.scrollTo({ top: idx * ITEM, behavior: "smooth" });
      // 방금 프로그램적으로 맞춘 스크롤이 일으킨 settle이면 값 쓰지 않음(열자마자 자동 기록 방지).
      if (Date.now() - progAt.current > 140) onChange(idx);
    }, 90);
  };

  // 잡고 있다는 느낌(grabbing) — 누르는 동안 밴드가 또렷해진다.
  const [grabbing, setGrabbing] = useState(false);
  // 마우스로 잡아 위아래로 긁으면 촤르륵 굴러간다(웹). 터치는 네이티브 스크롤 그대로.
  // 포인터 캡처는 '실제로 움직이기 시작한 뒤'에만 건다 — 안 그러면 순수 클릭이 컨테이너에 캡처돼
  // 칸(±1·±2) 버튼의 onClick이 안 먹는다(=2분일 때 1·3분 클릭이 안 되던 원인).
  const drag = useRef<{ y: number; top: number; moved: boolean; captured: boolean; id: number } | null>(null);
  const justDragged = useRef(false); // 긁은 직후의 우발 click 1회 무시
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setGrabbing(true); // 터치·마우스 모두 '잡았다' 표시
    if (e.pointerType !== "mouse") return; // 터치/펜은 네이티브 스크롤
    const el = ref.current;
    if (!el) return;
    drag.current = { y: e.clientY, top: el.scrollTop, moved: false, captured: false, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    if (!d.moved && Math.abs(e.clientY - d.y) > 3) {
      d.moved = true;
      el.setPointerCapture?.(d.id); // 끌기 시작 → 그때부터 캡처(밖으로 나가도 따라옴)
      d.captured = true;
    }
    if (d.moved) el.scrollTop = d.top - (e.clientY - d.y);
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    setGrabbing(false);
    const d = drag.current;
    if (!d) return;
    if (d.moved) justDragged.current = true;
    if (d.captured) ref.current?.releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  return (
    <div className="dtp-wheel-col">
      <span className="dtp-wheel-cap">{label}</span>
      <div className="dtp-wheel-wrap">
        <div className="dtp-wheel-band" aria-hidden="true" />
        <div
          className={`dtp-wheel${grabbing ? " grabbing" : ""}`}
          onPointerCancel={endDrag}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onScroll={onScroll}
          ref={ref}
        >
          <div className="dtp-wheel-pad" />
          {Array.from({ length: count }, (_, i) => {
            // 다이얼 느낌 — 중심에서 멀수록 작아지고 흐려진다(크기·투명도만). 클릭 영역은 36px 그대로.
            const ad = Math.abs(i - active);
            const scale = ad === 0 ? 1.16 : ad === 1 ? 0.92 : ad === 2 ? 0.74 : 0.6;
            const opacity = ad === 0 ? 1 : ad === 1 ? 0.7 : ad === 2 ? 0.42 : 0.22;
            return (
              <button
                className={`dtp-wheel-item${i === active ? " on" : ""}`}
                key={i}
                onClick={() => {
                  // 긁다가 멈춘 직후의 우발 클릭은 1회 무시. 그 외엔 어느 칸(±1·±2 포함)이든 눌러 선택.
                  if (justDragged.current) {
                    justDragged.current = false;
                    return;
                  }
                  const el = ref.current;
                  if (el) el.scrollTo({ top: i * ITEM, behavior: "smooth" });
                  hapticTick();
                  onChange(i);
                }}
                type="button"
               data-act="dtp-wheel-item">
                {/* 다이얼 느낌은 크기(scale)+투명도로만 — rotateX는 글자를 위아래로 밀어 '보이는 위치
                    ≠ 버튼 영역'을 만들어(7을 눌러도 6이 선택) 빼고, 중심 정렬을 유지해 ±1·±2도 정확히
                    눌러 선택되게 한다. */}
                <span className="dtp-wheel-digit" style={{ transform: `scale(${scale})`, opacity }}>
                  {z2(i)}
                </span>
              </button>
            );
          })}
          <div className="dtp-wheel-pad" />
        </div>
      </div>
    </div>
  );
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  open: openProp,
  onOpenChange
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  // open/onOpenChange를 주면 열림 상태를 부모가 제어한다(모바일 뒤로가기 스택에 한 층으로 넣기 위함).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const p = parse(value);
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOpenState(v));
  const [mobile, setMobile] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const init = p ?? nowKstParts();
  const [viewY, setViewY] = useState(init.y);
  const [viewM, setViewM] = useState(init.m);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // 열 때 현재 값 기준 월로 맞추고, 웹이면 트리거 위치를 잡는다.
  // 트리거 위치에 맞춰 팝오버 좌표 갱신(화면 밖으로 안 나가게 클램프). 스크롤·리사이즈 때도 호출.
  const reposition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 500));
    const top = Math.min(r.bottom + 6, Math.max(8, window.innerHeight - 380));
    setAnchor({ left, top, width: r.width });
  };
  const openPicker = () => {
    if (disabled) return;
    const cur = parse(value) ?? nowKstParts();
    setViewY(cur.y);
    setViewM(cur.m);
    reposition();
    hapticTick();
    setOpen(true);
  };
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    // 웹 팝오버: 바깥 스크롤/리사이즈 시 닫지 말고 트리거를 따라 위치만 갱신한다(닫혀 사라지지 않게).
    // 단, 시간 휠 내부 스크롤(피커 안)은 무시 — 휠이 위치 맞추며 낸 scroll까지 처리하면 깜빡인다.
    const onScroll = (e: Event) => {
      if (mobile) return;
      const t = e.target as HTMLElement | null;
      if (t && typeof t.closest === "function" && t.closest(".dtp-pop, .dtp-panel")) return;
      reposition();
    };
    const onResize = () => {
      if (!mobile) reposition();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // close/reposition은 렌더마다 새 클로저 — open/mobile 전환 때만 리스너를 다시 달면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mobile]);

  // 현재 선택(없으면 오늘 21:00을 기본으로 채워 선택 시작점으로).
  const base: Parts = p ?? { ...nowKstParts(), hh: 21, mm: 0 };

  const justSwiped = useRef(false);
  const setDay = (d: number) => {
    if (justSwiped.current) {
      justSwiped.current = false; // 좌우로 민 직후의 우발 날짜 클릭은 무시
      return;
    }
    onChange(fmtValue({ y: viewY, m: viewM, d, hh: base.hh, mm: base.mm }));
    hapticTick();
  };
  // 달력 좌우 스와이프(또는 마우스 드래그)로 월 이동 — 왼쪽으로 밀면 다음 달.
  const calSwipe = useRef<{ x: number; y: number } | null>(null);
  const onCalDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    calSwipe.current = { x: e.clientX, y: e.clientY };
  };
  const onCalUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = calSwipe.current;
    calSwipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      justSwiped.current = true;
      stepMonth(dx < 0 ? 1 : -1);
    }
  };
  const setHour = (hh: number) => onChange(fmtValue({ ...base, hh }));
  const setMin = (mm: number) => onChange(fmtValue({ ...base, mm }));
  const stepMonth = (dir: number) => {
    let y = viewY;
    let m = viewM + dir;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewY(y);
    setViewM(m);
    hapticTick();
  };
  const setToday = () => {
    const n = nowKstParts(); // 정확한 현재 KST(분 반올림/내림 없이 그대로)
    setViewY(n.y);
    setViewM(n.m);
    onChange(fmtValue(n));
    hapticTick();
  };
  const clear = () => {
    onChange("");
    hapticTick();
    close();
  };

  const firstWd = weekdayOf(viewY, viewM, 1);
  const days = daysInMonth(viewY, viewM);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  const today = nowKstParts();

  const panel = (
    <div className="dtp-panel" role="dialog" aria-label="공개 시각 선택" onClick={(e) => e.stopPropagation()}>
      {mobile ? (
        <div className="dtp-grip" aria-hidden="true" />
      ) : null}
      <div className="dtp-body">
        <div className="dtp-cal" onPointerDown={onCalDown} onPointerUp={onCalUp}>
          {/* 월 이동(< >)은 달력 위에만 — 오른쪽 시간/닫기(X)와 안 겹친다. */}
          <div className="dtp-head">
            <button className="dtp-nav" onClick={() => stepMonth(-1)} type="button" aria-label="이전 달" data-act="이전 달">
              <ChevronLeft size={18} />
            </button>
            <strong className="dtp-title">
              {viewY}년 {viewM}월
            </strong>
            <button className="dtp-nav" onClick={() => stepMonth(1)} type="button" aria-label="다음 달" data-act="다음 달">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="dtp-wdrow" aria-hidden="true">
            {WD.map((w, i) => (
              <span className={i === 0 ? "sun" : i === 6 ? "sat" : ""} key={w}>
                {w}
              </span>
            ))}
          </div>
          <div className="dtp-grid" key={`${viewY}-${viewM}`}>
            {cells.map((d, i) => {
              if (d === null) return <span className="dtp-cell empty" key={`e${i}`} />;
              const sel = p && p.y === viewY && p.m === viewM && p.d === d;
              const isToday = today.y === viewY && today.m === viewM && today.d === d;
              const wd = (firstWd + d - 1) % 7;
              // 국가지정 공휴일(대체공휴일 포함)도 일요일과 같은 빨간날로 — 메인 달력과 동일 기준.
              const iso = `${viewY}-${z2(viewM)}-${z2(d)}`;
              const holiday = getDayMark(iso)?.isHoliday === true;
              return (
                <button
                  className={`dtp-cell${sel ? " sel" : ""}${isToday ? " today" : ""}${wd === 0 || holiday ? " sun" : wd === 6 ? " sat" : ""}`}
                  key={d}
                  onClick={() => setDay(d)}
                  type="button"
                 data-act="dtp-cell">
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div className="dtp-time">
          <div className="dtp-readout" aria-hidden="true">
            {base.hh < 12 ? "오전" : "오후"} {base.hh % 12 === 0 ? 12 : base.hh % 12}:{z2(base.mm)}
          </div>
          <div className="dtp-wheels">
            <Wheel count={24} label="시" onChange={setHour} value={base.hh} />
            <span className="dtp-colon" aria-hidden="true">:</span>
            <Wheel count={60} label="분" onChange={setMin} value={base.mm} />
          </div>
        </div>
      </div>
      <div className="dtp-foot">
        <button className="dtp-foot-btn ghost" onClick={clear} type="button" data-act="dtp-foot-btn">
          지우기
        </button>
        <button className="dtp-foot-btn ghost" onClick={setToday} type="button" data-act="dtp-foot-btn">
          지금
        </button>
        <button className="dtp-foot-btn primary" onClick={close} type="button" data-act="dtp-foot-btn">
          확인
        </button>
      </div>
    </div>
  );

  return (
    <div className="dtp">
      <button
        className={`dtp-trigger${p ? " has" : ""}`}
        disabled={disabled}
        onClick={openPicker}
        ref={triggerRef}
        type="button"
       data-act="dtp-trigger">
        <CalendarDays aria-hidden="true" size={16} />
        <span className="dtp-trigger-text">{fmtLabel(p)}</span>
      </button>
      {open
        ? createPortal(
            mobile ? (
              <div className="dtp-sheet-backdrop" onClick={close} role="presentation">
                <div className="dtp-sheet">{panel}</div>
              </div>
            ) : (
              <div className="dtp-pop-backdrop" onClick={close} role="presentation">
                <div
                  className="dtp-pop"
                  style={anchor ? { left: anchor.left, top: anchor.top } : undefined}
                >
                  {panel}
                  <button className="dtp-pop-x" onClick={close} type="button" aria-label="닫기" data-act="close-datetime-picker">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ),
            document.body
          )
        : null}
    </div>
  );
}
