import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ART_SLOTS,
  batchPrompt,
  codexMasterPrompt,
  dotBlock,
  dotGrid,
  pilotFiles,
  pilotPrompt,
  pilotSlots,
  slotFiles,
  slotPrompt,
  dotsAcross,
  isFiller,
  recommendedVariants,
  SOURCE_EDGE,
  targetEdge,
  viewKoOf,
  viewTagOf
} from "@/components/shared/ambient/art/manifest";
import { CODEX } from "@/components/shared/ambient/world/codex";
import { monthTraces } from "@/components/shared/ambient/world/traces";

describe("ambient/art — 매니페스트", () => {
  it("id는 유일하고 파일 이름으로 안전하다", () => {
    const ids = ART_SLOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("도감의 모든 종이 2차 자리로 들어온다(목록이 둘로 갈라지지 않는다)", () => {
    for (const sp of CODEX) {
      const slot = ART_SLOTS.find((s) => s.id === sp.id);
      expect(slot, sp.id).toBeTruthy();
      expect(slot?.phase).toBe(2);
    }
  });
  it("변형 자리는 -1..-n 파일, 나머지는 <id>.png 하나", () => {
    const lily = ART_SLOTS.find((s) => s.id === "lilypad")!;
    // 2026-09-08 PLAN-009: 한 화면에 12장이 깔리는데 변형이 3개였다 → 6.
    expect(slotFiles(lily)).toEqual(["lilypad-1.png", "lilypad-2.png", "lilypad-3.png", "lilypad-4.png", "lilypad-5.png", "lilypad-6.png"]);
    // 참나무는 2026-09-07에 변형 2가 됐다(소유자: "참나무라고 모양이 똑같은 것만 있으면 어색") — 파일 이름이 -1/-2로 바뀐다.
    const oak = ART_SLOTS.find((s) => s.id === "tree-oak-winter")!;
    expect(slotFiles(oak)).toEqual(["tree-oak-winter-1.png","tree-oak-winter-2.png","tree-oak-winter-3.png","tree-oak-winter-4.png","tree-oak-winter-5.png","tree-oak-winter-6.png"]);
    const acorn = ART_SLOTS.find((s) => s.id === "acorn")!;
    expect(slotFiles(acorn)).toEqual(["acorn.png"]);
  });
  it("마스터 프롬프트는 모든 자리의 id·스타일 규칙·금지색을 담고, phase로 좁혀진다", () => {
    const all = codexMasterPrompt();
    for (const s of ART_SLOTS) expect(all).toContain(`| ${s.id} |`);
    expect(all).toContain("선명한 빨강·주황·노랑 금지");
    expect(all).toContain("soopoolleaf.com/ko/acnh/Fish/");
    expect(all).toContain("투명");
    const p1 = codexMasterPrompt(1);
    expect(p1).toContain("| tree-oak-winter |");
    expect(p1).not.toContain("| animal-hare |");
    const p2 = codexMasterPrompt(2);
    expect(p2).toContain("| animal-hare |");
    expect(p2).not.toContain("| tree-oak-winter |");
  });
  // 2026-09-07 결정 ⓐ′ — 도트를 살리는 조건은 "1024를 정수배로 줄인다" 하나로 요약된다. 목표 변이나 격자가 1024를
  // 정수로 나누지 못하면 nearest 축소가 도트를 들쭉날쭉 버리고, 그때 화면에서 화풍이 갈린다.
  it("저장 목표 변과 도트 격자는 1024를 정수로 나눈다", () => {
    for (const s of ART_SLOTS) {
      const edge = targetEdge(s.px);
      const grid = dotGrid(s.px, s.grid);
      expect(SOURCE_EDGE % edge, `${s.id} 목표 변 ${edge}`).toBe(0);
      expect(SOURCE_EDGE % grid, `${s.id} 격자 ${grid}`).toBe(0);
      expect(dotBlock(s.px, s.grid), `${s.id} 블록`).toBe(SOURCE_EDGE / grid);
      // 저장본은 자리 상자를 DPR 2로 그릴 만큼은 커야 한다(화면 px의 2배 이상).
      expect(edge, `${s.id} 저장 변이 화면보다 작다`).toBeGreaterThanOrEqual(Math.min(512, Math.max(s.px[0], s.px[1]) * 2));
    }
  });
  it("도트 격자는 자리 크기를 따라간다 — 고정값이면 작은 자리의 도트가 화면에서 사라진다", () => {
    // 화면 도트 = 자리 긴 변 × DPR 2 ÷ 격자. 1.5~8 장치px 안에 들어야 "굵은 점"으로 읽힌다.
    for (const s of ART_SLOTS.filter((x) => x.phase === 1)) {
      const dot = (Math.max(s.px[0], s.px[1]) * 2) / dotGrid(s.px, s.grid);
      expect(dot, `${s.id} 화면 도트 ${dot.toFixed(2)} 장치px`).toBeGreaterThanOrEqual(1.5);
      expect(dot, `${s.id} 화면 도트 ${dot.toFixed(2)} 장치px`).toBeLessThanOrEqual(8);
    }
  });
  // 2026-09-07: 12 → 14. 가을·겨울 소나무에 변형 2를 더했다 — 장면이 계절마다 **다른 파일**을 고르므로
  // (`land.ts` pineId), 봄·여름에만 변형이 둘이면 가을·겨울 산은 한 장을 40번 찍는다(반복감의 주범).
  // 2026-09-08: 16 → 20. 바위가 4 → 8변형(PLAN-009) — 재작업이라 8장을 한 번에 받는다. 4장만 봐선 "다양한가"를 판정할 수 없다.
  // 2026-09-08: 14 → 16. 짧은 새털(`cloud-wisp`) 2장. 긴 것(6.5:1)만으로는 어떤 가로 행의 49%가 구름이 되는데
  // 그 상한은 자리 종횡비라 코드로 못 내린다(라운드 17 검토 A #3) — 섞어 놓을 짧은 조각이 필요하다.
  it("파일럿 배치는 20장이고, 그 프롬프트는 파일럿 파일만 싣는다", () => {
    const slots = pilotSlots();
    const files = slots.flatMap((s) => pilotFiles(s));
    expect(files.length).toBe(20);
    for (const s of slots) expect(pilotFiles(s).length, s.id).toBeLessThanOrEqual(slotFiles(s).length);
    const p = pilotPrompt();
    for (const f of files) expect(p).toContain(f);
    // 파일럿에서 빼 둔 변형(갈대 3·4번, 시스택 2번)은 이번 표에 없어야 한다.
    expect(p).not.toContain("reed-3.png");
    expect(p).not.toContain("sea-stack-2.png");
    expect(p).toContain("| tree-pine |");
  });
  it("now는 실제로 화면에 그려지는 것과 맞는다 — 코드 대체물이 있으면 none이 아니다", () => {
    // `now: "none"`은 "아직 정하지 않았다"가 아니라 **화면이 비어 있다**는 뜻이다(보드가 빨간 띠로 표시하고 따로 센다).
    // 이 값이 낡으면 계획서를 이 필드로 읽는 사람이 빈 자리 수를 잘못 센다(2026-09-07에 14개가 낡아 있었다).
    // 2026-09-07 도감 대개편으로 131종이 2차 자리가 됐고 그중 120종은 아직 화면에 없다 — 빈 자리가 26 → 146.
    const empty = ART_SLOTS.filter((s) => s.now === "none");
    expect(empty.length).toBe(146);
    expect(empty.map((s) => s.id)).not.toContain("rock");
    expect(empty.map((s) => s.id)).toContain("sea-stack");
  });
  it("자리 프롬프트는 파일 이름·카메라·그릴 것·스타일 가이드를 담는다", () => {
    const s = ART_SLOTS.find((x) => x.id === "mushroom")!;
    const p = slotPrompt(s);
    expect(p).toContain("mushroom-1.png, mushroom-2.png");
    expect(p).toContain("동물의 숲 카메라");
    expect(p).toContain(s.brief);
    expect(p).toContain("## 스타일 가이드");
  });

  // 2026-09-08: 하늘 자리는 view가 "flat"이지만 지면이 아니다(눌리지 않는다). 자리 프롬프트만 고치고 배치 표를
  // 안 고쳐 한 번 어긋났다 — 표에 원시 키 "flat"이 찍히면 가이드의 "flat = 세로가 눌린다"와 정면으로 부딪힌다.
  it("하늘 자리는 자리 프롬프트와 배치 표 **양쪽에서** 눌림 없는 카메라로 나간다", () => {
    const sky = ART_SLOTS.filter((s) => s.category === "sky");
    expect(sky.length).toBeGreaterThan(0);
    for (const s of sky) {
      expect(viewKoOf(s), s.id).toContain("정면 그대로");
      expect(viewTagOf(s), s.id).not.toBe("flat");
      expect(slotPrompt(s), s.id).not.toContain("세로가 살짝 눌린 타원");
    }
    const table = batchPrompt(sky, "하늘");
    expect(table).not.toContain("| flat |");
    // 지면 자리는 그대로여야 한다(하늘 분기가 번지지 않았는지).
    const ground = ART_SLOTS.find((s) => s.id === "lilypad")!;
    expect(viewTagOf(ground)).toBe("flat");
    expect(viewKoOf(ground)).toContain("눌린");
  });
});

describe("ambient/art — 도트 예산과 표면 배분(2026-09-08 소유자 지적)", () => {
  it("바위처럼 칸이 적은 자리도 예산을 프롬프트에 싣는다", () => {
    const rock = ART_SLOTS.find((s) => s.id === "rock")!;
    const pine = ART_SLOTS.find((s) => s.id === "tree-pine")!;
    // 바위는 소나무보다 훨씬 적은 칸으로 그려야 한다 — 그 사실을 생성기가 먼저 알아야 한다.
    expect(dotsAcross(rock.px, rock.grid)).toBeLessThan(dotsAcross(pine.px, pine.grid));
    const p2 = slotPrompt(rock);
    expect(p2).toContain(`도트 예산: 물체 가로 약 ${dotsAcross(rock.px, rock.grid)}칸`);
    expect(p2).toContain("명암 3단");
    expect(batchPrompt([rock], "t")).toContain("가로 도트");
  });

  it("바위 브리프는 이끼를 변형 하나로만 제한한다(마른 해안·눈밭에도 깔린다)", () => {
    // 2026-09-08: 변형 4 → 8(PLAN-009)이라 배분 문구도 여덟 장 기준으로 다시 썼다.
    const rock = ART_SLOTS.find((s) => s.id === "rock")!;
    expect(rock.brief).toContain("이끼는 여덟 중 하나뿐이다");
    // 이끼가 기본값처럼 읽히던 옛 문구가 되살아나면 실패한다.
    expect(rock.brief).not.toContain("이끼가 조금 앉았다");
  });
});

describe("ambient/art — 변형 수는 한 화면 동시 개수에서 나온다(PLAN-009)", () => {
  // 2026-09-08 소유자: "돌은 최대한 모양이 다양할수록 이득 … 돌 종류가 최소 8개는 되어야지. 자연이 얼마나 다양한데."
  // 감으로 정하면 다시 낡는다 — 장면 코드에서 센 perScreen이 변형 수를 정하고, 이 테스트가 그걸 강제한다.
  it("perScreen이 적힌 자리는 권장 변형 수를 채운다", () => {
    const withCount = ART_SLOTS.filter((s) => s.perScreen);
    expect(withCount.length).toBeGreaterThanOrEqual(25);
    for (const s of withCount) {
      const want = recommendedVariants(s.perScreen!, isFiller(s));
      expect(s.variants ?? 1, `${s.id} — 한 화면 ${s.perScreen}개인데 변형 ${s.variants ?? 1}개`).toBeGreaterThanOrEqual(want);
    }
  });

  it("권장 수식은 반복 한도와 상·하한을 지킨다", () => {
    expect(recommendedVariants(12)).toBe(6); // 한 화면 12 → 한 변형이 2회
    expect(recommendedVariants(16)).toBe(8);
    expect(recommendedVariants(40)).toBe(8); // 상한 8 — 그 위는 생성 비용이 이득을 넘는다
    expect(recommendedVariants(2)).toBe(2); // 하한은 화면 개수를 넘지 않는다 — 둘뿐이면 둘이면 된다
    expect(recommendedVariants(8)).toBe(4);
    expect(recommendedVariants(34, true)).toBe(6); // 잔 소품 상한 6
    expect(recommendedVariants(2, true)).toBe(2);
  });

  it("반복이 가장 심하던 세 자리가 실제로 올라갔다(소나무·참나무·낮은 구름)", () => {
    const of = (id: string) => ART_SLOTS.find((s) => s.id === id)!;
    expect(of("tree-pine").variants).toBeGreaterThanOrEqual(8); // 산 12~20그루에 2변형이었다
    expect(of("tree-oak-autumn").variants).toBeGreaterThanOrEqual(6);
    expect(of("cloud-low").variants).toBeGreaterThanOrEqual(8);
    expect(of("rock").variants).toBeGreaterThanOrEqual(8);
  });

  it("프롬프트가 '한 화면 몇 개'를 말한다 — 왜 달라야 하는지가 지시에 있어야 한다", () => {
    const rock = ART_SLOTS.find((s) => s.id === "rock")!;
    const p2 = slotPrompt(rock);
    expect(p2).toContain(`한 화면에 최대 ${rock.perScreen}개가 동시에 놓인다`);
    expect(batchPrompt([rock], "t")).toContain("한 화면");
  });
});

describe("ambient/art — 목록은 남은 것만 답한다(PLAN-010)", () => {
  // 2026-09-08 소유자: "배경아트보드 창 아직 너무 어수선해." 목록 카드가 브리프를 통째로 싣던 것이 뿌리였다 —
  // 카드 하나가 화면 절반이 됐고 프롬프트용 마크다운의 별표까지 그대로 보였다. 규격·브리프는 자리 상세로 갔다.
  it("목록 카드 소스에 브리프·규격 칩이 없다", () => {
    const src = fs.readFileSync("components/studio/ambient-art-board.tsx", "utf8");
    const card = src.slice(src.indexOf("const Card = memo("), src.indexOf("export function AmbientArtBoard"));
    expect(card).not.toContain("slot.brief");
    expect(card).not.toContain("art-brief");
    expect(card).not.toContain("VIEW_SHORT");
    // 대신 진행을 칸으로 그린다.
    expect(card).toContain("art-pips");
  });

  it("자리 상세는 그 셋을 전부 맡는다", () => {
    const src = fs.readFileSync("components/studio/ambient-art-slot.tsx", "utf8");
    expect(src).toContain("slot.brief");
    expect(src).toContain("artslot-spec");
    expect(src).toContain("dotsAcross");
  });
});

describe("traces — 연잎 간격", () => {
  it("8월 말 연잎 12장은 서로 겹치지 않게 떨어져 있다(가로 .045·세로 .06 밖)", () => {
    const pads = monthTraces("vic", 2026, 8).filter((t) => t.kind === "lilypad");
    expect(pads.length).toBe(12);
    let close = 0;
    for (let i = 0; i < pads.length; i++)
      for (let j = i + 1; j < pads.length; j++)
        if (Math.abs(pads[i].u - pads[j].u) <= 0.045 && Math.abs(pads[i].v - pads[j].v) <= 0.06) close++;
    expect(close).toBeLessThanOrEqual(1);
  });
});
