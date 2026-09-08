// 밤하늘의 드문 사건(2026-09-08) — 별똥별·혜성. 여기서 지키는 것은 두 가지다.
//  ① **순수성** — 하네스의 계약이 "같은 URL = 같은 프레임"이고 `advance(1000) = advance(250)×4`라서, 사건이
//     호출 횟수나 상태에 기대면 캡처가 흔들린다(VISUAL_QA_PROTOCOL §3.5-1). 눈으로는 절대 못 잡는 종류의 결함이다.
//  ② **드묾의 실제 값** — "가끔"은 감각어라 코드로는 평균 간격으로만 말할 수 있다. 너무 잦으면 싸구려가 되고
//     너무 드물면 그린 그림을 아무도 못 본다(첫 판의 혜성 18분이 그랬다).
import { describe, expect, it } from "vitest";
import { aimSprite, ART_HEADING, SKY_EVENTS, skyEventAt, skyEventSchedule, type SkyEventKind } from "@/components/shared/ambient/world/sky-events";

const KINDS: SkyEventKind[] = ["shooting-star", "comet"];

describe("world/sky-events — 밤하늘의 드문 사건", () => {
  it("순수하다 — 같은 (시드, t)면 언제나 같은 답", () => {
    for (const kind of KINDS) {
      for (const t of [5, 40.5, 130, 537.25, 1200]) {
        const a = skyEventAt(7, kind, t, 1);
        const b = skyEventAt(7, kind, t, 1);
        expect(JSON.stringify(a), `${kind} t=${t}`).toBe(JSON.stringify(b));
      }
    }
  });

  it("훑어 온 t와 건너뛴 t가 같은 답을 준다 — advance를 어떻게 쪼개도 하늘이 같아야 한다", () => {
    for (const kind of KINDS) {
      // 잘게 훑으며 캐시를 키운 상태와, 새 시드로 한 번에 물었을 때가 같아야 한다.
      for (let t = 0; t <= 600; t += 0.25) skyEventAt(11, kind, t, 1);
      const walked = skyEventAt(11, kind, 537.25, 1);
      const jumped = skyEventAt(11, kind, 537.25, 1);
      expect(JSON.stringify(walked)).toBe(JSON.stringify(jumped));
    }
  });

  it("시드가 다르면 다른 밤이 된다", () => {
    const a = skyEventSchedule(1, "shooting-star", 600);
    const b = skyEventSchedule(2, "shooting-star", 600);
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("겹치지 않는다 — 간격이 지속 시간보다 늘 길다", () => {
    for (const kind of KINDS) {
      expect(SKY_EVENTS[kind].gap[0], kind).toBeGreaterThan(SKY_EVENTS[kind].dur);
    }
  });

  it("드묾이 뜻대로다 — 별똥별은 분당 한 번쯤, 혜성은 십 분에 한 번쯤", () => {
    const mean = (kind: SkyEventKind, seeds = 40, span = 7200) => {
      let n = 0;
      for (let s = 1; s <= seeds; s++) n += skyEventSchedule(s, kind, span).length;
      return (span * seeds) / Math.max(1, n); // 사건 사이 평균 초
    };
    const star = mean("shooting-star");
    const comet = mean("comet");
    expect(star, `별똥별 평균 간격 ${star.toFixed(0)}초`).toBeGreaterThan(40);
    expect(star, `별똥별 평균 간격 ${star.toFixed(0)}초`).toBeLessThan(100);
    expect(comet, `혜성 평균 간격 ${(comet / 60).toFixed(1)}분`).toBeGreaterThan(5 * 60);
    expect(comet, `혜성 평균 간격 ${(comet / 60).toFixed(1)}분`).toBeLessThan(15 * 60);
  });

  it("확률로 거른 슬롯이 있다 — 간격만 무작위면 규칙적으로 느껴진다", () => {
    for (const kind of KINDS) {
      // 표에 오른 슬롯보다 실제로 뜨는 것이 적어야 한다(chance < 1).
      expect(SKY_EVENTS[kind].chance).toBeLessThan(1);
    }
    const used = skyEventSchedule(3, "shooting-star", 3600).length;
    const slots = 3600 / ((SKY_EVENTS["shooting-star"].gap[0] + SKY_EVENTS["shooting-star"].gap[1]) / 2);
    expect(used).toBeLessThan(slots);
  });

  it("여력이 낮으면 뜨지 않는다 — 약한 기기에서 드문 장식부터 접는다", () => {
    const seed = 5;
    const t = skyEventSchedule(seed, "shooting-star", 600)[0];
    expect(t).toBeGreaterThan(0);
    expect(skyEventAt(seed, "shooting-star", t + 0.2, 1)).toBeTruthy();
    expect(skyEventAt(seed, "shooting-star", t + 0.2, 0.1)).toBeNull();
  });

  it("진행도는 0에서 1로 흐르고 끝나면 사라진다", () => {
    const seed = 9;
    const t0 = skyEventSchedule(seed, "comet", 1200)[0];
    const dur = SKY_EVENTS.comet.dur;
    expect(skyEventAt(seed, "comet", t0 - 0.1, 1)).toBeNull();
    expect(skyEventAt(seed, "comet", t0 + dur * 0.25, 1)?.u).toBeCloseTo(0.25, 2);
    expect(skyEventAt(seed, "comet", t0 + dur * 0.75, 1)?.u).toBeCloseTo(0.75, 2);
    expect(skyEventAt(seed, "comet", t0 + dur + 0.1, 1)).toBeNull();
  });
});

describe("world/sky-events — 꼬리는 진행 방향을 따른다", () => {
  // `drawArt`가 실제로 하는 합성: translate → rotate(rot) → scale(flip ? -k : k, k).
  // 뒤집기가 **회전 뒤에** 오므로 스프라이트 고유각 art는 뒤집혔을 때 (π − art)가 된다.
  const finalAngle = (rot: number, art: number, flip: boolean) => {
    const a = flip ? rot + Math.PI - art : rot + art;
    return Math.atan2(Math.sin(a), Math.cos(a)); // −π~π로 정규화
  };

  it("어느 방향으로 가든 그림의 머리가 진행 방향을 향한다", () => {
    for (const art of [ART_HEADING.comet, ART_HEADING["shooting-star"], 0, 0.7]) {
      for (const travel of [0, Math.PI, 0.397, Math.PI - 0.397, -0.8, 2.6]) {
        for (const flip of [false, true]) {
          const got = finalAngle(aimSprite(travel, art, flip), art, flip);
          const want = Math.atan2(Math.sin(travel), Math.cos(travel));
          expect(got, `art=${art} travel=${travel} flip=${flip}`).toBeCloseTo(want, 6);
        }
      }
    }
  });

  it("납품된 그림은 머리가 오른쪽이다 — 왼쪽으로 갈 때만 뒤집는다는 전제", () => {
    // |고유각| < 90°면 머리가 오른쪽(+x)을 향한다. 이게 깨지면 `flip = dir < 0` 규칙이 통째로 뒤집혀야 한다.
    for (const kind of KINDS) expect(Math.abs(ART_HEADING[kind]), kind).toBeLessThan(Math.PI / 2);
  });
});
