"use client";

// 생일 캡슐 뽑기 기계(2026-10-06 소유자: "2월 19일 토리님 생일 버튼을 누르면 뽑기 창이 크게 — 동전 넣고 손잡이
// 돌리면 캡슐, 열면 사진과 축하글"). 흐름: 동전 넣기 → 손잡이 한 바퀴(끌어서 돌리거나 눌러서) → 캡슐이 굴러
// 나옴 → 캡슐 누르면 열려 카드(그림·등급·축하글) → 한 번 더 / 닫기. 지금은 기능 확인용 — 무제한, 견본 상품
// (lib/ui/gacha-items). 소리는 lib/ui/sfx(효과음 설정을 따른다), 움직임은 동작 줄이기면 즉시 결과.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { addGachaCollected, drawGachaItem, gachaCollected, GACHA_ITEMS, RARITY_LABEL, type GachaItem } from "@/lib/ui/gacha-items";
import { playSfx } from "@/lib/ui/sfx";
import { hapticTick } from "@/lib/ui/haptics";

type Phase = "idle" | "coined" | "turning" | "dropped" | "opened";
const CAPSULE_COLORS = ["#ff8fb1", "#ffd166", "#7cc4ff", "#b39cff", "#7fe0b8", "#ffb38a"];
const RARITY_CAPSULE: Record<GachaItem["rarity"], string> = {
  common: "#ffd166",
  rare: "#ff8fb1",
  legend: "conic-gradient(from 0deg, #ff8fb1, #ffd166, #7fe0b8, #7cc4ff, #b39cff, #ff8fb1)"
};

function reduced(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-reduce-motion");
}

export function GachaMachine({ onClose, onLegend }: { onClose: () => void; onLegend?: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [angle, setAngle] = useState(0);
  const [prize, setPrize] = useState<GachaItem | null>(null);
  const [collected, setCollected] = useState<Set<string>>(() => new Set());
  const [shake, setShake] = useState(0);
  const dragRef = useRef<{ last: number; total: number; step: number } | null>(null);
  const knobRef = useRef<HTMLButtonElement | null>(null);
  const autoRef = useRef(0);

  // onClose는 부모가 렌더마다 새로 만든다 — deps에 넣으면 정리 함수가 렌더마다 돌아 자동 돌리기(rAF)를 끊었다
  // (실측: 손잡이가 '드르륵…'에서 멈춤). 최신 값은 ref로 읽고, 정리는 닫힐 때(언마운트) 한 번만.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    setCollected(gachaCollected());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(autoRef.current);
    };
  }, []);

  // 돔 안 캡슐들 — 자리·색·기울기는 한 번만 정한다(렌더마다 흔들리지 않게).
  const balls = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: 12 + ((i * 37) % 76),
        top: 38 + ((i * 53) % 48),
        rot: (i * 47) % 360,
        color: CAPSULE_COLORS[i % CAPSULE_COLORS.length]
      })),
    []
  );

  const insertCoin = () => {
    if (phase !== "idle") return;
    playSfx("coin");
    hapticTick();
    setPhase("coined");
  };

  // 손잡이 한 바퀴가 다 돌면 캡슐이 떨어진다.
  const finishTurn = () => {
    const item = drawGachaItem();
    setPrize(item);
    setPhase("dropped");
    playSfx("gacha-drop");
  };
  const tickStep = () => {
    playSfx("detent");
    setShake((s) => s + 1);
  };

  const center = () => {
    const r = knobRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
  };
  const angleAt = (e: { clientX: number; clientY: number }) => {
    const c = center();
    return (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI;
  };
  const onKnobDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (phase !== "coined") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { last: angleAt(e), total: 0, step: 0 };
    setPhase("turning");
  };
  const onKnobMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const a = angleAt(e);
    let delta = a - d.last;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.last = a;
    if (delta <= 0) return; // 시계 방향으로만 돈다(실제 뽑기 기계처럼)
    d.total += delta;
    setAngle((v) => v + delta);
    const step = Math.floor(d.total / 60);
    if (step > d.step) {
      d.step = step;
      tickStep();
    }
    if (d.total >= 360) {
      dragRef.current = null;
      finishTurn();
    }
  };
  const onKnobUp = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    // 덜 돌리고 놓으면 남은 만큼 자동으로 마저 돈다(너무 깐깐하지 않게).
    autoTurn(360 - d.total, d.step);
  };
  // 눌러서(또는 키보드로) 돌리기 — 한 바퀴를 부드럽게 자동으로.
  const autoTurn = (remain = 360, stepStart = 0) => {
    if (reduced()) {
      setAngle((v) => v + remain);
      finishTurn();
      return;
    }
    setPhase("turning");
    const start = performance.now();
    const dur = Math.max(350, (remain / 360) * 1100);
    let last = 0;
    let step = stepStart;
    const run = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const done = eased * remain;
      setAngle((v) => v + (done - last));
      last = done;
      const s = Math.floor((360 - remain + done) / 60);
      if (s > step) {
        step = s;
        tickStep();
      }
      if (t < 1) autoRef.current = requestAnimationFrame(run);
      else finishTurn();
    };
    autoRef.current = requestAnimationFrame(run);
  };

  const openCapsule = () => {
    if (phase !== "dropped" || !prize) return;
    setPhase("opened");
    setCollected(addGachaCollected(prize.id));
    if (prize.rarity === "legend") {
      playSfx("grand");
      onLegend?.();
    } else {
      playSfx("capsule-open");
    }
  };
  const again = () => {
    setPrize(null);
    setPhase("idle");
  };

  const capsuleBg = prize ? RARITY_CAPSULE[prize.rarity] : "#ffd166";
  return (
    <div className="gacha-layer" onClick={onClose} role="presentation">
      <div aria-label="생일 캡슐 뽑기" aria-modal="true" className="gacha-stage" onClick={(e) => e.stopPropagation()} role="dialog">
        <button aria-label="닫기" className="gacha-close" data-act="gacha-close" onClick={onClose} type="button">
          <X aria-hidden="true" size={18} strokeWidth={2.6} />
        </button>
        <p className="gacha-title">🎂 토리님 생일 캡슐 뽑기</p>
        <p className="gacha-count">
          모은 캡슐 <b>{collected.size}</b> / {GACHA_ITEMS.length}
        </p>

        <div className={`gacha-machine${phase === "turning" ? " is-turning" : ""}`} style={{ "--shake": shake } as CSSProperties}>
          <div className="gacha-dome">
            <span aria-hidden="true" className="gacha-dome-shine" />
            {balls.map((b, i) => (
              <span
                aria-hidden="true"
                className="gacha-ball"
                key={i}
                style={{ left: `${b.left}%`, top: `${b.top}%`, "--rot": `${b.rot}deg`, "--c": b.color, "--i": i } as CSSProperties}
              />
            ))}
          </div>
          <div className="gacha-body">
            <button
              className={`gacha-slot${phase === "idle" ? " is-ready" : ""}`}
              data-act="gacha-coin"
              disabled={phase !== "idle"}
              onClick={insertCoin}
              type="button"
            >
              <span aria-hidden="true" className="gacha-slot-hole" />
              <span className="gacha-slot-label">{phase === "idle" ? "🪙 동전 넣기" : "동전 OK"}</span>
            </button>
            <button
              aria-label="손잡이 돌리기"
              className={`gacha-knob${phase === "coined" ? " is-ready" : ""}`}
              data-act="gacha-turn"
              disabled={phase !== "coined" && phase !== "turning"}
              onClick={() => {
                if (phase === "coined" && !dragRef.current) autoTurn();
              }}
              onPointerCancel={onKnobUp}
              onPointerDown={onKnobDown}
              onPointerMove={onKnobMove}
              onPointerUp={onKnobUp}
              ref={knobRef}
              style={{ transform: `rotate(${angle}deg)` }}
              type="button"
            >
              <span aria-hidden="true" className="gacha-knob-bar" />
            </button>
            <p className="gacha-hint">
              {phase === "idle" ? "동전을 넣어 주세요" : phase === "coined" ? "손잡이를 돌려요 ↻" : phase === "turning" ? "드르륵…" : phase === "dropped" ? "캡슐을 눌러 열어요!" : ""}
            </p>
            <div className="gacha-chute">
              {phase === "dropped" || phase === "opened" ? (
                <button
                  aria-label="캡슐 열기"
                  className={`gacha-capsule${phase === "opened" ? " is-open" : ""}${prize?.rarity === "legend" ? " is-legend" : ""}`}
                  data-act="gacha-open"
                  onClick={openCapsule}
                  style={{ "--cap": capsuleBg } as CSSProperties}
                  type="button"
                >
                  <span aria-hidden="true" className="gacha-capsule-top" />
                  <span aria-hidden="true" className="gacha-capsule-bottom" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {phase === "opened" && prize ? (
          <div className={`gacha-card rarity-${prize.rarity}`}>
            <span aria-hidden="true" className="gacha-rays" />
            <div className="gacha-card-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={prize.title}
                decoding="async"
                src={prize.src}
                style={{ objectPosition: prize.focus, transform: `scale(${prize.zoom})`, transformOrigin: prize.focus }}
              />
            </div>
            <span className="gacha-card-rarity">{prize.rarity === "legend" ? "✦ " : ""}{RARITY_LABEL[prize.rarity]}</span>
            <b className="gacha-card-title">{prize.title}</b>
            <p className="gacha-card-msg">{prize.message}</p>
            <div className="gacha-card-actions">
              <button className="gacha-btn primary" data-act="gacha-again" onClick={again} type="button">
                한 번 더
              </button>
              <button className="gacha-btn" data-act="gacha-done" onClick={onClose} type="button">
                닫기
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
