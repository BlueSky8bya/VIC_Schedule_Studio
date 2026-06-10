"use client";

import { useEffect, useRef } from "react";
import { hapticTick } from "@/lib/ui/haptics";
import "./worldcup-studio-ball.css";

// 편집실용 — 중력 받는 축구공 1개. 화면 안에서 마우스로 잡아 던지면 떨어지고 바닥/벽에 튕기다
// 굴러 멈춘다. 골대·선수·점수 없음. 월드컵 기간에만(부모가 그때만 마운트). 일정 작업 방해 0
// (레이어 pointer-events:none, 공만 auto). 위치는 transform만(reflow 0), 멈추면 rAF 중단.

const BALL = 42;
const GRAVITY = 1700; // px/s^2
const REST = 0.66; // 바닥/벽 튕김
const AIR = 0.999; // 공기저항(아주 약하게)
const ROLL_FRICTION = 0.985; // 바닥에서 구를 때 수평 감속
const STOP = 10;

export function WorldCupStudioBall() {
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
    place();

    const onFloor = pos.current.y >= floor - 0.5;
    const slow = Math.abs(vel.current.x) < STOP && Math.abs(vel.current.y) < STOP;
    if (dragging.current || !(onFloor && slow)) {
      raf.current = window.requestAnimationFrame(step);
    } else {
      raf.current = null;
    }
  };
  const ensureLoop = () => {
    if (raf.current == null) raf.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
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
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
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
    <div className="wcsb-layer" ref={layerRef} aria-hidden="true">
      <div
        className="wcsb-ball"
        ref={ballRef}
        style={{ width: `${BALL}px`, height: `${BALL}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        ⚽
      </div>
    </div>
  );
}
