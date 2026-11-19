import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { companionRadioBlock, companionRowBlock, companionSoundStatus, COMPANION_SETTINGS_PLACES, COMPANION_SETTINGS_PLACE_LABELS, type CompanionBlockedRow, type CompanionSiteGates } from "@/lib/ui/viewer-companion/settings-status";
import { ACT } from "@/lib/activity/labels";

// Redesign stage 1: the screen says why a setting is not taking effect, using
// the rules that are true today. Nothing here changes a setting or a rule.
const prefs = (overrides: Partial<CompanionPreferences> = {}): CompanionPreferences => ({ ...DEFAULT_COMPANION_PREFERENCES, ...overrides });
const site = (overrides: Partial<CompanionSiteGates> = {}): CompanionSiteGates => ({ soundOn: true, soundVolume: 60, reduceMotion: false, gfx: "full", ...overrides });
const radio = { enabled: true, volume: 35, react: true, excludedIds: [] };

describe("companion sound status line (proposal 4-5)", () => {
  it("names the outermost reason first", () => {
    const everythingOff = prefs({ enabled: false, sound: false, soundVolume: 0, soundCare: false, soundMotion: false, soundKeepsakes: false });
    expect(companionSoundStatus(everythingOff, site({ soundOn: false, soundVolume: 0, reduceMotion: true }))).toEqual({ state: "off", text: "지금은 소리가 안 나요 — 사이트 효과음이 꺼져 있어요", place: "site-sound" });
    expect(companionSoundStatus(everythingOff, site({ soundVolume: 0 }))).toEqual({ state: "off", text: "지금은 소리가 안 나요 — 사이트 음량이 0이에요", place: "site-sound" });
    expect(companionSoundStatus(everythingOff, site())).toEqual({ state: "off", text: "지금은 소리가 안 나요 — 빅타민이 쉬는 중이에요", place: "companion-power" });
    expect(companionSoundStatus(prefs({ sound: false }), site({ reduceMotion: true }))).toEqual({ state: "off", text: "빅타민 소리를 꺼 두셨어요" });
    expect(companionSoundStatus(prefs({ sound: false, soundVolume: 0 }), site())).toEqual({ state: "off", text: "빅타민 소리를 꺼 두셨어요" });
    expect(companionSoundStatus(prefs({ soundVolume: 0 }), site())).toEqual({ state: "off", text: "빅타민 음량이 0이에요" });
    // Raising the volume alone would not help here, so the volume is not named.
    expect(companionSoundStatus(prefs({ soundVolume: 0, soundCare: false }), site())).toEqual({ state: "off", text: "빅타민 소리를 꺼 두셨어요" });
    // The old care group off reads as the level off.
    expect(companionSoundStatus(prefs({ soundCare: false }), site())).toEqual({ state: "off", text: "빅타민 소리를 꺼 두셨어요" });
  });

  it("says touch-only, by choice or because the device rests what it does by itself", () => {
    expect(companionSoundStatus(prefs({ soundMotion: false }), site({ reduceMotion: true, gfx: "off" }))).toEqual({ state: "partial", text: "내가 만질 때만 소리가 나요" });
    expect(companionSoundStatus(prefs({ soundKeepsakes: false }), site())).toEqual({ state: "partial", text: "내가 만질 때만 소리가 나요" });
    expect(companionSoundStatus(prefs(), site({ reduceMotion: true, gfx: "soft" }))).toEqual({ state: "partial", text: "지금은 내가 만질 때만 소리가 나요 — 사이트의 '생동감 있는 동작'이 꺼져 있어요", place: "site-motion" });
    expect(companionSoundStatus(prefs(), site({ gfx: "soft" }))).toEqual({ state: "partial", text: "지금은 내가 만질 때만 소리가 나요 — 이 기기는 배경 효과가 '효과 쉬기'로 맞춰져 있어요", place: "site-gfx" });
    expect(companionSoundStatus(prefs(), site({ gfx: "off" }))).toEqual({ state: "partial", text: "지금은 내가 만질 때만 소리가 나요 — 배경 효과가 꺼져 있어요", place: "site-gfx" });
    expect(companionSoundStatus(prefs(), site({ gfx: "lite" }))).toEqual({ state: "on", text: "지금 소리가 나요" });
  });

  it("matches the real gate in every combination", async () => {
    // on = what it does by itself sounds; partial = only the user's touch does; off = nothing does.
    const bools = [false, true];
    let cases = 0;
    for (const soundOn of bools) for (const enabled of bools) for (const sound of bools) for (const soundVolume of [0, 40]) for (const soundCare of bools) for (const soundMotion of bools) for (const soundKeepsakes of bools)
      for (const reduceMotion of bools) for (const gfx of ["full", "lite", "soft", "off"]) for (const siteVolume of [0, 60]) {
        const p = prefs({ enabled, sound, soundVolume, soundCare, soundMotion, soundKeepsakes }), s = site({ soundOn, soundVolume: siteVolume, reduceMotion, gfx });
        const level = !sound || soundVolume === 0 || !soundCare ? "off" : soundMotion && soundKeepsakes ? "all" : "touch";
        const direct = soundOn && siteVolume > 0 && enabled && level !== "off", auto = direct && level === "all" && !reduceMotion && gfx !== "soft" && gfx !== "off";
        expect(companionSoundStatus(p, s).state, JSON.stringify({ p, s })).toBe(auto ? "on" : direct ? "partial" : "off");
        cases += 1;
      }
    expect(cases).toBe(2048);
  });

  it("no longer uses the old row name after stage 2-라", () => {
    const bools = [false, true];
    for (const reduceMotion of bools) for (const gfx of ["full", "soft", "off"]) for (const soundMotion of bools) for (const sound of bools)
      expect(companionSoundStatus(prefs({ soundMotion, sound }), site({ reduceMotion, gfx })).text).not.toMatch(/음악에 반응/);
  });
});

describe("blocked companion rows", () => {
  // Stage 4: movement is one level and the four pranks one switch, so the reasons are per shown row.
  const rows: CompanionBlockedRow[] = ["motion", "playful", "panelPrank", "radioSelfStart"];

  it("has no note when nothing is in the way", () => {
    for (const row of rows) expect(companionRowBlock(row, prefs(), site()), row).toBeNull();
    for (const row of rows) expect(companionRowBlock(row, prefs(), site({ gfx: "lite" })), row).toBeNull();
  });

  it("puts the companion's own power first", () => {
    for (const row of rows) expect(companionRowBlock(row, prefs({ enabled: false, roam: false }), site({ reduceMotion: true, gfx: "off" }))).toEqual({ text: "빅타민이 쉬는 중이라 아래 설정은 켜면 적용돼요", place: "companion-power" });
  });

  it("then the site's motion switch, for every row it stops", () => {
    const blocked = (row: CompanionBlockedRow) => companionRowBlock(row, prefs({ roam: false }), site({ reduceMotion: true, gfx: "soft" }));
    expect(blocked("motion")).toEqual({ text: "사이트의 '생동감 있는 동작'이 꺼져 있어 걷거나 뛰지 않아요", place: "site-motion" });
    expect(blocked("playful")).toEqual({ text: "사이트의 '생동감 있는 동작'이 꺼져 있어 장난을 치지 않아요", place: "site-motion" });
    expect(blocked("panelPrank")).toEqual({ text: "사이트의 '생동감 있는 동작'이 꺼져 있어 패널을 옮기지 않아요", place: "site-motion" });
    expect(blocked("radioSelfStart")).toEqual({ text: "사이트의 '생동감 있는 동작'이 꺼져 있어 스스로 라디오를 틀지 않아요", place: "site-motion" });
  });

  it("then the background effect: it stops self-start and the panel move, and only partly rests the pranks", () => {
    const blocked = (row: CompanionBlockedRow, gfx = "soft") => companionRowBlock(row, prefs(), site({ gfx }));
    expect(blocked("radioSelfStart", "off")).toEqual({ text: "배경 효과가 꺼져 있어 스스로 라디오를 틀지 않아요", place: "site-gfx" });
    expect(blocked("panelPrank", "off")).toEqual({ text: "배경 효과가 꺼져 있어 패널을 옮기지 않아요", place: "site-gfx" });
    expect(blocked("panelPrank")).toBeNull();
    // The pranks go on except the ones the effect rests: said, but the row is not dimmed.
    expect(blocked("playful")).toEqual({ text: "이 기기는 배경 효과가 '효과 쉬기'로 맞춰져 있어 소품 묘기를 쉬어요", place: "site-gfx", partial: true });
    expect(blocked("playful", "off")).toEqual({ text: "배경 효과가 꺼져 있어 소품 묘기와 일정 기울이기를 쉬어요", place: "site-gfx", partial: true });
    for (const gfx of ["soft", "off"]) expect(blocked("motion", gfx), gfx).toBeNull();
    // With the pranks off (any one of the four stored off) there is nothing left to rest: no note.
    for (const gfx of ["soft", "off"]) for (const key of ["heartPrank", "cardPrank", "ambientPrank", "rarePrank"] as const) expect(companionRowBlock("playful", prefs({ [key]: false }), site({ gfx })), `${gfx}/${key}`).toBeNull();
  });

  it("never claims the rules of earlier stages", () => {
    const bools = [false, true];
    for (const row of rows) for (const enabled of bools) for (const roam of bools) for (const jump of bools) for (const reduceMotion of bools) for (const gfx of ["full", "lite", "soft", "off"]) {
      const text = companionRowBlock(row, prefs({ enabled, roam, jump }), site({ reduceMotion, gfx }))?.text ?? "";
      expect(text).not.toMatch(/음악에 반응|돌아다니기|깡충/);
    }
  });

  it("then standing still, for what movement carries", () => {
    // Both stored mixes that read as "가만히" say the same.
    for (const jump of [false, true]) {
      const blocked = (row: CompanionBlockedRow) => companionRowBlock(row, prefs({ roam: false, jump }), site());
      expect(blocked("motion")).toBeNull();
      expect(blocked("playful")).toEqual({ text: "움직임이 '가만히'라 장난을 치지 않아요", place: "companion-roam" });
      expect(blocked("panelPrank")).toEqual({ text: "움직임이 '가만히'라 패널을 옮기지 않아요", place: "companion-roam" });
      expect(blocked("radioSelfStart")).toEqual({ text: "움직임이 '가만히'라 스스로 라디오를 틀지 않아요", place: "companion-roam" });
    }
    // Standing still comes before the partial background note.
    expect(companionRowBlock("playful", prefs({ roam: false }), site({ gfx: "soft" }))?.partial).toBeUndefined();
  });

  it("starting the radio by itself also needs the 'all' sound level", () => {
    const blocked = (overrides: Partial<CompanionPreferences>) => companionRowBlock("radioSelfStart", prefs(overrides), site());
    expect(blocked({})).toBeNull();
    expect(blocked({ soundMotion: false })).toEqual({ text: "빅타민 소리가 '만질 때만'이라 스스로 라디오를 틀지 않아요", place: "companion-sound" });
    expect(blocked({ sound: false })).toEqual({ text: "빅타민 소리가 '끔'이라 스스로 라디오를 틀지 않아요", place: "companion-sound" });
    // An outer reason still comes first.
    expect(companionRowBlock("radioSelfStart", prefs({ sound: false, roam: false }), site())?.place).toBe("companion-roam");
  });
});

describe("home radio block", () => {
  it("names what keeps a press from playing, outermost first", () => {
    const off = prefs({ enabled: false, sound: false, soundVolume: 0 }), quietRadio = { ...radio, enabled: false, volume: 0 };
    expect(companionRadioBlock(off, quietRadio, { soundOn: false, soundVolume: 0 })).toEqual({ text: "전체 소리가 꺼져 있어요", place: "site-sound" });
    expect(companionRadioBlock(off, quietRadio, { soundOn: true, soundVolume: 0 })).toEqual({ text: "전체 음량이 0이에요", place: "site-sound" });
    expect(companionRadioBlock(off, quietRadio, { soundOn: true, soundVolume: 60 })).toEqual({ text: "빅타민이 꺼져 있어요", place: "companion-power" });
    expect(companionRadioBlock(prefs(), quietRadio, { soundOn: true, soundVolume: 60 })).toEqual({ text: "라디오가 꺼져 있어요" });
    expect(companionRadioBlock(prefs(), { ...radio, volume: 0 }, { soundOn: true, soundVolume: 60 })).toEqual({ text: "라디오 음량이 0이에요" });
    expect(companionRadioBlock(prefs(), radio, { soundOn: true, soundVolume: 60 })).toBeNull();
  });

  it("is apart from the companion's own sound: any level lets the user play it (stage 2-라)", () => {
    for (const overrides of [{ sound: false }, { soundVolume: 0 }, { soundCare: false }, { soundMotion: false }, { sound: false, soundVolume: 0, soundCare: false, soundMotion: false, soundKeepsakes: false }])
      expect(companionRadioBlock(prefs(overrides), radio, { soundOn: true, soundVolume: 60 }), JSON.stringify(overrides)).toBeNull();
  });
});

describe("go-to places", () => {
  it("have a button label and a registered activity name each", () => {
    const options = (ACT["settings-go"] as { opts?: Record<string, string> }).opts ?? {};
    for (const place of COMPANION_SETTINGS_PLACES) { expect(COMPANION_SETTINGS_PLACE_LABELS[place], place).toBeTruthy(); expect(options[place], place).toBeTruthy(); }
    expect(Object.keys(options).sort()).toEqual([...COMPANION_SETTINGS_PLACES].sort());
    expect(ACT["companion-radio-blocked"]).toMatchObject({ area: "빅타민" });
  });
});
