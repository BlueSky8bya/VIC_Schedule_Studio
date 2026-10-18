import { describe, expect, it } from "vitest";
import { ACT, describeTarget, sortAreas } from "@/lib/activity/labels";
import { sanitizeMeta, sanitizeTarget } from "@/lib/activity/kinds";
import { buildGist, buildStory, type NarrativeItem } from "@/lib/activity/narrative";

const TOGGLES = [
  "companion-enabled", "companion-roam", "companion-jump", "companion-sleep",
  "companion-heart-prank", "companion-card-prank", "companion-hide", "companion-panel-prank",
  "companion-drag-enabled", "companion-petting-enabled", "companion-feeding-enabled", "companion-learning-enabled",
  "companion-sound-enabled", "companion-sound-care", "companion-sound-motion", "companion-sound-keepsakes", "companion-radio-enabled", "companion-radio-react"
] as const;
const SETTINGS = [
  "settings-companion-tab", ...TOGGLES, "companion-speed", "companion-animal", "companion-personality", "companion-learning-reset"
] as const;
const ACTIONS = [
  "companion-home-open", "companion-home-close", "companion-home-fold", "companion-home-call",
  "companion-food-spawn", "companion-food-move", "companion-food-discard", "companion-food-clear",
  "companion-pet", "companion-drag", "companion-throw", "companion-bonk", "companion-rest",
  "companion-find", "companion-extract", "companion-heart-clear", "companion-card-restore"
] as const;
const COLLECTION = [
  ["companion-profile-page#together", "빅타민 프로필 보기 · 함께 지내기"],
  ["companion-profile-page#discover", "빅타민 프로필 보기 · 도감"],
  ["companion-profile-page#dress", "빅타민 프로필 보기 · 옷장"],
  ["companion-collection-category#food", "빅타민 도감 종류 · 냠냠 도감"],
  ["companion-collection-category#behavior", "빅타민 도감 종류 · 재롱"],
  ["companion-collection-category#moment", "빅타민 도감 종류 · 특별한 순간"],
  ["companion-collection-inspect#food", "빅타민 도감 항목 살펴보기 · 냠냠 도감"],
  ["companion-collection-inspect#behavior", "빅타민 도감 항목 살펴보기 · 재롱"],
  ["companion-collection-inspect#moment", "빅타민 도감 항목 살펴보기 · 특별한 순간"],
  ["companion-collection-page#prev", "빅타민 도감 넘기기 · 이전"],
  ["companion-collection-page#next", "빅타민 도감 넘기기 · 다음"],
  ["companion-sound-enabled#on", "빅타민 효과음 · 켜기"],
  ["companion-sound-volume", "빅타민 음량"],
  ["companion-sound-care#off", "빅타민 돌보기 소리 · 끄기"],
  ["companion-sound-motion#on", "빅타민 움직임 소리 · 켜기"],
  ["companion-sound-keepsakes#off", "빅타민 발견·선물 소리 · 끄기"],
  ["companion-sound-preview#motion", "빅타민 소리 미리 듣기 · 움직임"],
  ["companion-radio-enabled#on", "빅타민 집 라디오 · 켜기"],
  ["companion-radio-volume", "빅타민 라디오 음량"],
  ["companion-radio-react#off", "빅타민 음악 반응 · 끄기"],
  ["companion-radio-mood#graceful", "빅타민 라디오 분위기 · 우아하게"],
  ["companion-radio-track-toggle", "빅타민 라디오 곡 고르기"],
  ["companion-radio-list#open", "빅타민 라디오 곡 목록 · 펴기"],
  ["companion-radio-list#close", "빅타민 라디오 곡 목록 · 접기"],
  ["companion-radio-play", "빅타민 라디오 재생"],
  ["companion-radio-next", "빅타민 라디오 다음 곡"],
  ["companion-radio-stop", "빅타민 라디오 정지"],
  ["companion-wardrobe-preview", "빅타민 장신구 미리보기"],
  ["companion-accessory-select", "빅타민 장신구 살펴보기"],
  ["companion-gift-open", "빅타민 선물 열기"],
  ["companion-accessory-equip#on", "빅타민 장신구 · 착용하기"],
  ["companion-accessory-equip#off", "빅타민 장신구 · 벗기"],
  ["companion-gift-dismiss", "빅타민 선물 결과 닫기"]
] as const;

describe("빅타민 행동 기록 이름과 저장 경계", () => {
  it("패널과 최초공개의 새 고정 조작도 이름·선택값을 잃지 않는다", () => {
    for (const target of ["tag-filter-fold#open", "tag-filter-fold#close", "season-panel-fold#open", "season-panel-fold#close", "premiere-resume", "premiere-other-month", "premiere-exit#calendar", "premiere-exit#dismiss", "premiere-read", "premiere-cheer", "premiere-rehearsal"]) {
      expect(sanitizeTarget(target), target).toBe(target);
      const label = describeTarget("ui.click", target);
      expect(label.unnamed, target).toBeUndefined(); expect(label.retired, target).toBeUndefined(); expect(label.area, target).toBe("시청자 화면");
      expect(label.name, target).not.toContain("premiere-");
      expect(sanitizeTarget(`${target.split("#")[0]}#sensitive-canary@example.test`)).toBe(target.split("#")[0]);
    }
  });
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
      ["settings-companion-tab#personality", "빅타민 설정 묶음 · 프로필"],
      ["settings-companion-tab#sound", "빅타민 설정 묶음 · 소리"],
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

  it("발견·꾸미기 고정 버튼이 타임라인과 적게 쓰인 기능에서 같은 현재 이름으로 읽힌다", () => {
    const items: NarrativeItem[] = COLLECTION.map(([target], index) => ({ t: Date.UTC(2026, 9, 18, 3, 0, index * 5), kind: "ui.click", target, targetLabel: null, meta: null, durMs: null, source: "client" }));
    const story = buildStory(items).join(" ");
    for (const [target, name] of COLLECTION) {
      expect(sanitizeTarget(target)).toBe(target);
      const label = describeTarget("ui.click", target);
      expect(label.name).toBe(name); expect(label.unnamed).toBeUndefined(); expect(label.retired).toBeUndefined();
      expect(label.area).toBe(["companion-gift-open", "companion-radio-play"].includes(target) ? "빅타민" : "설정");
      expect(story).toContain(name);
    }
    expect(story).not.toContain("companion-");
    expect(buildGist(items)).toBe("빅타민 설정 31번 사용 · 빅타민과 2번 상호작용");
  });

  it("신규 버튼은 실제 음식·행동·장신구·선물 ID와 미등록/전역 옵션을 저장하지 않는다", () => {
    const bases = [...new Set(COLLECTION.map(([target]) => target.split("#")[0]))];
    for (const base of bases) for (const option of ["apple", "dragon-fruit", "ask-petting", "sunglasses", "gift-wrapped", "sensitive-canary@example.test", "public", "spring", "on#apple", "__proto__"]) {
      expect(sanitizeTarget(`${base}#${option}`)).toBe(base);
    }
    for (const base of ["companion-accessory-select", "companion-gift-open", "companion-gift-dismiss"]) {
      for (const option of ["on", "off", "food", "behavior"]) expect(sanitizeTarget(`${base}#${option}`)).toBe(base);
    }
    expect(sanitizeMeta({ foodId: "apple", behaviorId: "ask-petting", accessoryId: "sunglasses", giftContents: "beret", foods: ["apple"], behaviors: ["groom"], favorite: "pear" })).toBeNull();
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

  it("모든 빅타민 조작은 자기에게 등록된 선택지만 허용한다", () => {
    for (const [base, control] of Object.entries(ACT).filter(([key]) => key.startsWith("companion-") || key === "settings-companion-tab")) {
      for (const option of ["public", "spring", "food", "on", "curious", "apple", "radio-01", "__proto__"]) {
        expect(sanitizeTarget(`${base}#${option}`), `${base} must not inherit an unrelated global option`).toBe(Object.hasOwn(control.opts ?? {}, option) ? `${base}#${option}` : base);
      }
    }
  });

  it("예전 자동 추정 빅타민 별칭도 같은 고정 키·허용 선택지로 접는다", () => {
    for (const prefix of ["auto:", "auto:."]) {
      expect(sanitizeTarget(`${prefix}companion-enabled`)).toBe("companion-enabled");
      expect(sanitizeTarget(`${prefix}companion-enabled#off`)).toBe("companion-enabled#off");
      expect(sanitizeTarget(`${prefix}companion-food-spawn#apple`)).toBe("companion-food-spawn");
      expect(sanitizeTarget(`${prefix}companion-unregistered-sensitive@example.test`)).toBeNull();
    }
    expect(sanitizeTarget("auto:.month-nav-btn")).toBe("auto:.month-nav-btn");
  });
});
