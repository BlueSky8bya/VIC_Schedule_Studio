import { describe, expect, it } from "vitest";
import { ACT, describeTarget, sortAreas } from "@/lib/activity/labels";
import { sanitizeMeta, sanitizeTarget } from "@/lib/activity/kinds";
import { buildGist, buildStory, type NarrativeItem } from "@/lib/activity/narrative";

const TOGGLES = [
  "companion-enabled", "companion-roam", "companion-jump", "companion-sleep",
  "companion-heart-prank", "companion-card-prank", "companion-hide", "companion-panel-prank",
  "companion-drag-enabled", "companion-petting-enabled", "companion-feeding-enabled", "companion-learning-enabled"
] as const;
const SETTINGS = [
  "settings-companion-tab", ...TOGGLES, "companion-speed", "companion-animal", "companion-personality", "companion-learning-reset"
] as const;
const ACTIONS = [
  "companion-home-open", "companion-home-close", "companion-home-fold", "companion-home-call",
  "companion-food-spawn", "companion-food-move", "companion-food-discard", "companion-food-clear",
  "companion-pet", "companion-drag", "companion-bonk", "companion-rest",
  "companion-find", "companion-extract", "companion-heart-clear"
] as const;

describe("빅타민 행동 기록 이름과 저장 경계", () => {
  it("행동 흐름과 복사 요약도 같은 사람 말 이름을 쓴다", () => {
    const items: NarrativeItem[] = ["companion-pet", "companion-food-spawn", "companion-speed#lively"].map((target, i) => ({
      t: Date.UTC(2026, 9, 16, 3, 0, i * 5), kind: "ui.click", target,
      targetLabel: null, meta: null, durMs: null, source: "client"
    }));
    const story = buildStory(items).join(" ");
    const gist = buildGist(items);
    for (const item of items) expect(story).toContain(describeTarget("ui.click", item.target!).name);
    expect(gist).toBe("빅타민 설정 1번 사용 · 빅타민과 2번 상호작용");
    expect(`${story} ${gist}`).not.toContain("companion-");
  });
  it("모든 설정·직접 교감은 저장 뒤에도 이름과 위치가 남는다", () => {
    for (const [targets, area] of [[SETTINGS, "설정"], [ACTIONS, "빅타민"]] as const) {
      for (const target of targets) {
        expect(sanitizeTarget(target), target).toBe(target);
        const label = describeTarget("ui.click", target);
        expect(label.area, target).toBe(area);
        expect(label.name, target).toContain("빅타민");
        expect(label.unnamed, target).toBeUndefined();
        expect(label.retired, target).toBeUndefined();
      }
    }
  });

  it("켜기와 끄기는 같은 기능의 다른 선택으로 구분된다", () => {
    for (const target of TOGGLES) {
      for (const [option, label] of [["on", "켜기"], ["off", "끄기"]] as const) {
        const id = `${target}#${option}`;
        expect(sanitizeTarget(id), id).toBe(id);
        expect(describeTarget("ui.click", id).name, id).toBe(`${ACT[target].name} · ${label}`);
      }
    }
  });

  it("설정 묶음과 걸음·동물·성격 선택이 코드 대신 화면 이름으로 읽힌다", () => {
    const examples = [
      ["settings-tab#companion", "설정 묶음 고르기 · 빅타민"],
      ["settings-companion-tab#motion", "빅타민 설정 묶음 · 움직임"],
      ["settings-companion-tab#pranks", "빅타민 설정 묶음 · 장난"],
      ["settings-companion-tab#affection", "빅타민 설정 묶음 · 교감"],
      ["settings-companion-tab#personality", "빅타민 설정 묶음 · 성격"],
      ["companion-speed#relaxed", "빅타민 걸음 · 느긋하게"],
      ["companion-speed#normal", "빅타민 걸음 · 보통"],
      ["companion-speed#lively", "빅타민 걸음 · 발랄하게"],
      ["companion-animal#default", "빅타민 동물 모드 · 빅타민"],
      ["companion-animal#cat", "빅타민 동물 모드 · 고양이"],
      ["companion-animal#dog", "빅타민 동물 모드 · 강아지"],
      ["companion-personality#curious", "빅타민 성격 · 호기심"],
      ["companion-personality#affectionate", "빅타민 성격 · 애교쟁이"],
      ["companion-personality#sleepy", "빅타민 성격 · 잠꾸러기"],
      ["companion-home-fold#open", "빅타민 집 · 펴기"],
      ["companion-home-fold#close", "빅타민 집 · 접기"]
    ];
    for (const [id, label] of examples) {
      expect(sanitizeTarget(id), id).toBe(id);
      expect(describeTarget("ui.click", id).name, id).toBe(label);
    }
  });

  it("장난 하트 지우기는 실제 하트 누르기와 섞이지 않는다", () => {
    const label = describeTarget("ui.click", "companion-heart-clear");
    expect(label.name).toBe("빅타민 보라 하트 지우기");
    expect(label.hint).toContain("실제 하트 집계를 바꾸지 않는");
    expect(label.name).not.toBe(describeTarget("ui.click", "event-heart").name);
  });

  it("위치 필터에서 빅타민을 시청자 화면 옆에 둔다", () => {
    expect(sortAreas(["기타", "설정", "빅타민", "시청자 화면"])).toEqual(["시청자 화면", "빅타민", "설정", "기타"]);
  });

  it("자유 문구와 일정·좌표 canary는 새 기능의 기록으로 저장되지 않는다", () => {
    const canary = "sensitive-canary@example.test";
    for (const target of [...SETTINGS, ...ACTIONS]) {
      // 기존 정책: 미등록 옵션은 고르개 자체로 접어 자유 문구를 버린다.
      expect(sanitizeTarget(`${target}#${canary}`), target).toBe(target);
    }
    expect(sanitizeTarget(`companion-${canary}`)).toBeNull();
    expect(sanitizeTarget(`auto:.${canary}`)).toBeNull();
    expect(sanitizeMeta({ title: canary, body: canary, foodId: canary, eventId: canary, x: 123, y: 456, nickname: canary })).toBeNull();
  });
});
