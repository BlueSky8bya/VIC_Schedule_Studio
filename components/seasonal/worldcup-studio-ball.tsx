"use client";

import { useEffect, useRef, useState } from "react";
import { hapticTick } from "@/lib/ui/haptics";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만
import "./worldcup-studio-ball.css";

// 편집실용 — 중력 받는 축구공 1개. 화면 안에서 마우스로 잡아 던지면 떨어지고 바닥/벽에 튕기다
// 굴러 멈춘다. 골대·선수·점수 없음. 월드컵 기간에만(부모가 그때만 마운트). 일정 작업 방해 0
// (레이어 pointer-events:none, 공만 auto). 위치는 transform만(reflow 0), 멈추면 rAF 중단.

const BALL = 64; // 시청자 모바일·웹 공용 — 너무 크지 않게(모바일 화면폭의 ~16%)
const GRAVITY = 1700; // px/s^2
const REST = 0.66; // 바닥/벽 튕김
const AIR = 0.999; // 공기저항(아주 약하게)
const ROLL_FRICTION = 0.985; // 바닥에서 구를 때 수평 감속
const STOP = 10;

// pauseWhenMinigameOn: 시청자 화면에선 미니게임이 켜지면 중력공을 숨긴다(둘 다 뜨면 어수선).
// 편집실(미니게임 없음)에선 false로 줘 항상 보이게.
export function WorldCupStudioBall({ pauseWhenMinigameOn = true }: { pauseWhenMinigameOn?: boolean }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const spin = useRef(0); // 굴러가는 회전각(시각용)
  const dragging = useRef(false);
  const grabOffset = useRef({ x: 0, y: 0 });
  const lastPointer = useRef({ x: 0, y: 0, t: 0 });
  const pointerVel = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const reduced = useRef(false);
  const ghostPrev = useRef({ x: 0, y: 0, t: 0 }); // 드래그한 일정 카드의 직전 중심(속도 추정)
  // 미니게임이 켜져 있으면 중력공은 숨긴다(둘 다 뜨면 어수선). 초기값=미니게임 enabled(localStorage
  // "off"가 아니면 켜짐). WorldCupBallGoal이 토글마다 'wc-minigame-enabled' 이벤트로 알린다.
  const [hidden, setHidden] = useState<boolean>(() => {
    if (!pauseWhenMinigameOn || typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("vic.worldcupGame") !== "off";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!pauseWhenMinigameOn) return;
    const onMini = (e: Event) => setHidden(!!(e as CustomEvent).detail?.enabled);
    window.addEventListener("wc-minigame-enabled", onMini);
    return () => window.removeEventListener("wc-minigame-enabled", onMini);
  }, [pauseWhenMinigameOn]);
  // 숨길 땐 물리 루프 중단. 다시 보이면 루프 재시작 → 멈춰 있던 공에 중력이 다시 적용돼 떨어진다.
  useEffect(() => {
    if (hidden) {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    } else {
      place();
      ensureLoop();
    }
  }, [hidden]);

  const bounds = () => {
    const el = layerRef.current;
    return { w: el?.clientWidth ?? window.innerWidth, h: el?.clientHeight ?? window.innerHeight };
  };
  const place = () => {
    const el = ballRef.current;
    if (el) {
      el.style.transform = `translate3d(${pos.current.x - BALL / 2}px, ${pos.current.y - BALL / 2}px, 0) rotate(${spin.current}deg)`;
    }
  };

  const step = () => {
    const { w, h } = bounds();
    const dt = 1 / 60;
    const r = BALL / 2;
    const floor = h - r;
    if (!dragging.current) {
      vel.current.y += GRAVITY * dt;
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      vel.current.x *= AIR;
      vel.current.y *= AIR;
      // 좌우 벽
      if (pos.current.x < r) {
        pos.current.x = r;
        vel.current.x = -vel.current.x * REST;
      } else if (pos.current.x > w - r) {
        pos.current.x = w - r;
        vel.current.x = -vel.current.x * REST;
      }
      // 천장
      if (pos.current.y < r) {
        pos.current.y = r;
        vel.current.y = -vel.current.y * REST;
      }
      // 바닥 — 튕기고, 굴러가다 멈춤.
      if (pos.current.y > floor) {
        pos.current.y = floor;
        vel.current.y = -vel.current.y * REST;
        if (Math.abs(vel.current.y) < 60) vel.current.y = 0; // 작은 튕김은 멈춘다
        vel.current.x *= ROLL_FRICTION; // 바닥 마찰로 구르다 감속
      }
      spin.current += vel.current.x * dt * 1.2; // 수평 속도만큼 회전
    }

    // 드래그 중인 일정 카드(.event-drag-ghost)와 충돌 — 카드를 휘두르면 공이 맞고 튕긴다.
    const ghostHit = collideDragGhost();

    place();

    const onFloor = pos.current.y >= floor - 0.5;
    const slow = Math.abs(vel.current.x) < STOP && Math.abs(vel.current.y) < STOP;
    if (dragging.current || ghostHit || !(onFloor && slow)) {
      raf.current = window.requestAnimationFrame(step);
    } else {
      raf.current = null;
    }
  };

  // 드래그 중인 일정 카드 사각형과 공(원) 충돌. 카드 이동속도를 공에 실어준다(휘두르면 날아감).
  const collideDragGhost = (): boolean => {
    const ghost = document.querySelector(".event-drag-ghost") as HTMLElement | null;
    const layer = layerRef.current;
    if (!ghost || !layer) {
      ghostPrev.current.t = 0;
      return false;
    }
    const gr = ghost.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const x0 = gr.left - lr.left;
    const y0 = gr.top - lr.top;
    const x1 = gr.right - lr.left;
    const y1 = gr.bottom - lr.top;
    const gcx = (x0 + x1) / 2;
    const gcy = (y0 + y1) / 2;
    const now = performance.now();
    let gvx = 0;
    let gvy = 0;
    if (ghostPrev.current.t) {
      const dtg = Math.max(8, now - ghostPrev.current.t);
      gvx = ((gcx - ghostPrev.current.x) / dtg) * 1000;
      gvy = ((gcy - ghostPrev.current.y) / dtg) * 1000;
    }
    ghostPrev.current = { x: gcx, y: gcy, t: now };
    if (dragging.current) return true; // 공 잡는 중이면 물리 안 검(루프만 유지)

    const r = BALL / 2;
    const cx = pos.current.x;
    const cy = pos.current.y;
    const nx = Math.max(x0, Math.min(cx, x1));
    const ny = Math.max(y0, Math.min(cy, y1));
    const dx = cx - nx;
    const dy = cy - ny;
    let d = Math.hypot(dx, dy);
    if (d >= r) return true; // 카드 있음(루프 유지) — 닿진 않음
    let ux: number;
    let uy: number;
    if (d > 0.0001) {
      ux = dx / d;
      uy = dy / d;
    } else {
      const l = cx - x0;
      const rr = x1 - cx;
      const tp = cy - y0;
      const bt = y1 - cy;
      const m = Math.min(l, rr, tp, bt);
      ux = m === l ? -1 : m === rr ? 1 : 0;
      uy = m === tp ? -1 : m === bt ? 1 : 0;
      if (ux === 0 && uy === 0) uy = -1;
      d = 0;
    }
    pos.current.x += ux * (r - d);
    pos.current.y += uy * (r - d);
    // 상대속도 기반 반사 + 카드 속도 전달(CARRY로 증폭 — 살짝 휘둘러도 잘 실린다).
    const CARRY = 1.6; // 카드 이동속도 전달 배수
    const rvx = vel.current.x - gvx * CARRY;
    const rvy = vel.current.y - gvy * CARRY;
    const vn = rvx * ux + rvy * uy;
    if (vn < 0) {
      vel.current.x -= (1 + REST) * vn * ux;
      vel.current.y -= (1 + REST) * vn * uy;
    }
    // 닿기만 해도 톡 쳐지게 — 법선 방향 최소 발사속도 보장(느린 접촉도 공이 반응).
    const MIN_KICK = 300; // px/s
    const outN = vel.current.x * ux + vel.current.y * uy; // 카드 바깥(공 쪽) 성분
    if (outN < MIN_KICK) {
      const add = MIN_KICK - outN;
      vel.current.x += ux * add;
      vel.current.y += uy * add;
    }
    return true;
  };
  const ensureLoop = () => {
    if (raf.current == null) raf.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    reduced.current = reduceMotionEnabled(); // OS reduce-motion 무시 — 앱 토글만
    const { w, h } = bounds();
    pos.current = { x: w * 0.5, y: reduced.current ? h - BALL / 2 : h * 0.3 };
    vel.current = { x: 0, y: 0 };
    place();
    if (!reduced.current) ensureLoop(); // 처음 한 번 톡 떨어뜨린다(reduced면 바닥에 둔다)

    const onResize = () => {
      const b = bounds();
      pos.current.x = Math.min(Math.max(pos.current.x, BALL / 2), b.w - BALL / 2);
      pos.current.y = Math.min(Math.max(pos.current.y, BALL / 2), b.h - BALL / 2);
      place();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (raf.current != null) {
          window.cancelAnimationFrame(raf.current);
          raf.current = null;
        }
      }
    };
    // 일정 카드를 끌고 휘두르는 동안엔(고스트 존재) 멈춰 있던 공도 깨워 충돌 판정이 돌게 한다.
    const onDocMove = () => {
      if (document.querySelector(".event-drag-ghost")) ensureLoop();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointermove", onDocMove, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointermove", onDocMove);
      if (raf.current != null) window.cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    const rect = layerRef.current?.getBoundingClientRect();
    const lx = e.clientX - (rect?.left ?? 0);
    const ly = e.clientY - (rect?.top ?? 0);
    grabOffset.current = { x: lx - pos.current.x, y: ly - pos.current.y };
    lastPointer.current = { x: lx, y: ly, t: performance.now() };
    pointerVel.current = { x: 0, y: 0 };
    vel.current = { x: 0, y: 0 };
    hapticTick();
    ensureLoop();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const rect = layerRef.current?.getBoundingClientRect();
    const lx = e.clientX - (rect?.left ?? 0);
    const ly = e.clientY - (rect?.top ?? 0);
    pos.current.x = lx - grabOffset.current.x;
    pos.current.y = ly - grabOffset.current.y;
    const now = performance.now();
    const dt = Math.max(8, now - lastPointer.current.t);
    pointerVel.current = {
      x: ((lx - lastPointer.current.x) / dt) * 1000,
      y: ((ly - lastPointer.current.y) / dt) * 1000
    };
    lastPointer.current = { x: lx, y: ly, t: now };
    place();
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    const max = 1500;
    let vx = pointerVel.current.x * 1.15;
    let vy = pointerVel.current.y * 1.15;
    const sp = Math.hypot(vx, vy);
    if (sp > max) {
      vx = (vx / sp) * max;
      vy = (vy / sp) * max;
    }
    vel.current = { x: vx, y: vy };
    ensureLoop();
  };

  return (
    <div
      className="wcsb-layer"
      ref={layerRef}
      aria-hidden="true"
      style={hidden ? { display: "none" } : undefined}
    >
      <div
        className="wcsb-ball"
        ref={ballRef}
        style={{ width: `${BALL}px`, height: `${BALL}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 미니게임과 동일한 Twemoji(CC-BY 4.0) ⚽ 솔리드 SVG — 꽉 찬 원이라 투명/뚫림 없음. */}
        <svg className="wcsb-ball-svg" viewBox="0 0 36 36" aria-hidden="true">
          <circle fill="#F5F8FA" cx="18" cy="18" r="18" />
          <path
            fill="#CCD6DD"
            d="M18 11c-.552 0-1-.448-1-1V3c0-.552.448-1 1-1s1 .448 1 1v7c0 .552-.448 1-1 1zm-6.583 4.5c-.1 0-.202-.015-.302-.047l-8.041-2.542c-.527-.167-.819-.728-.652-1.255.166-.527.73-.818 1.255-.652l8.042 2.542c.527.167.819.729.652 1.255-.136.426-.53.699-.954.699zm13.625-.291c-.434 0-.833-.285-.96-.722-.154-.531.151-1.085.682-1.239l6.75-1.958c.531-.153 1.085.153 1.238.682.154.531-.151 1.085-.682 1.239l-6.75 1.958c-.092.027-.186.04-.278.04zm2.001 14.958c-.306 0-.606-.14-.803-.403l-5.459-7.333c-.33-.442-.238-1.069.205-1.399.442-.331 1.069-.238 1.399.205l5.459 7.333c.33.442.238 1.069-.205 1.399-.179.134-.389.198-.596.198zm-18.294-.083c-.197 0-.395-.058-.57-.179-.454-.316-.565-.938-.25-1.392l5.125-7.375c.315-.454.938-.566 1.392-.251.454.315.565.939.25 1.392l-5.125 7.375c-.194.281-.506.43-.822.43zM3.5 27.062c-.44 0-.844-.293-.965-.738L.347 18.262c-.145-.533.17-1.082.704-1.227.535-.141 1.083.171 1.227.704l2.188 8.062c.145.533-.17 1.082-.704 1.226-.088.025-.176.035-.262.035zM22 34h-9c-.552 0-1-.447-1-1s.448-1 1-1h9c.553 0 1 .447 1 1s-.447 1-1 1zm10.126-6.875c-.079 0-.16-.009-.24-.029-.536-.132-.864-.674-.731-1.21l2.125-8.625c.133-.536.679-.862 1.21-.732.536.132.864.674.731 1.211l-2.125 8.625c-.113.455-.521.76-.97.76zM30.312 7.688c-.17 0-.342-.043-.5-.134L22.25 3.179c-.478-.277-.642-.888-.364-1.367.275-.478.886-.643 1.366-.365l7.562 4.375c.478.277.642.888.364 1.367-.185.32-.521.499-.866.499zm-24.811 0c-.312 0-.618-.145-.813-.417-.322-.45-.22-1.074.229-1.396l6.188-4.438c.449-.322 1.074-.219 1.396.229.322.449.219 1.074-.229 1.396L6.083 7.5c-.177.126-.38.188-.582.188z"
          />
          <path
            fill="#31373D"
            d="M25.493 13.516l-7.208-5.083c-.348-.245-.814-.243-1.161.006l-7.167 5.167c-.343.248-.494.684-.375 1.091l2.5 8.583c.124.426.515.72.96.72H22c.43 0 .81-.274.948-.681l2.917-8.667c.141-.419-.011-.881-.372-1.136zM1.292 19.542c.058 0 .117-.005.175-.016.294-.052.55-.233.697-.494l3.375-6c.051-.091.087-.188.108-.291L6.98 6.2c.06-.294-.016-.6-.206-.832C6.584 5.135 6.3 5 6 5h-.428C2.145 8.277 0 12.884 0 18c0 .266.028.525.04.788l.602.514c.182.156.413.24.65.24zm9.325-16.547c.106.219.313.373.553.412l6.375 1.042c.04.006.081.01.121.01.04 0 .081-.003.122-.01l6.084-1c.2-.033.38-.146.495-.314.116-.168.158-.375.118-.575l-.292-1.443C22.26.407 20.18 0 18 0c-2.425 0-4.734.486-6.845 1.356l-.521.95c-.117.213-.123.47-.017.689zm20.517 2.724l-1.504-.095c-.228-.013-.455.076-.609.249-.152.173-.218.402-.175.63l1.167 6.198c.017.086.048.148.093.224 1.492 2.504 3.152 5.301 3.381 5.782.024.084.062.079.114.151.14.195.372.142.612.142h.007c.198 0 .323.094 1.768-.753.001-.083.012-.164.012-.247 0-4.753-1.856-9.064-4.866-12.281zM14.541 33.376c.011-.199-.058-.395-.191-.544l-4.5-5c-.06-.066-.131-.122-.211-.163-5.885-3.069-5.994-3.105-6.066-3.13-.078-.025-.161-.039-.242-.039-.537 0-.695.065-1.185 2.024 2.236 4.149 6.053 7.316 10.644 8.703l1.5-1.333c.149-.132.239-.319.251-.518zm17.833-8.567c-.189-.08-.405-.078-.592.005l-6.083 2.667c-.106.046-.2.116-.274.205l-4.25 5.083c-.129.154-.19.352-.172.552.02.2.117.384.272.51.683.559 1.261 1.03 1.767 1.44 4.437-1.294 8.154-4.248 10.454-8.146l-.712-1.889c-.072-.193-.221-.347-.41-.427z"
          />
        </svg>
      </div>
    </div>
  );
}
