"use client";

import { ArrowDownToLine, EyeOff, Gauge, Grab, Heart, Leaf, PanelTopOpen, PartyPopper, Pointer, Sparkles, Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { RowLabel, SettingsNote, SettingsSegment, Switch, flashSettingsPlace } from "@/components/shared/settings-controls";
import { COMPANION_SETTINGS_PLACE_LABELS, companionRowBlock, companionSoundStatus, type CompanionBlockedRow, type CompanionSettingsNote, type CompanionSettingsPlace, type CompanionSiteGates } from "@/lib/ui/viewer-companion/settings-status";
import { COMPANION_PERSONALITY_NAMES, COMPANION_PERSONALITY_SUMMARIES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_PERSONALITY_LAYOUT } from "@/lib/ui/viewer-companion/personality-layout";
import { CompanionWardrobePreview } from "./companion-wardrobe-preview";
import { COMPANION_SOUND_AUDITIONS, COMPANION_SOUND_NAMES, auditionCompanionSound, companionSoundAllowed, previewCompanionSoundLevel, previewCompanionSoundVolume, type CompanionSoundMoment } from "@/lib/ui/viewer-companion/companion-sound";
import { companionSoundLevel, companionSoundLevelPatch, type CompanionSoundLevel } from "@/lib/ui/viewer-companion/settings-levels";
import { resetCompanionHabits } from "@/lib/ui/viewer-companion/care";
import { resetCompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { hapticTick } from "@/lib/ui/haptics";
import { playSfx } from "@/lib/ui/sfx";
import { logActivity } from "@/lib/activity/client";

const companionTabs = [
  { key: "personality", label: "기본", icon: <Sparkles size={16} /> },
  { key: "motion", label: "움직임", icon: <Pointer size={16} /> },
  { key: "pranks", label: "장난", icon: <PartyPopper size={16} /> },
  { key: "affection", label: "교감", icon: <Heart size={16} /> },
  { key: "sound", label: "소리", icon: <Volume2 size={16} /> }
] as const;
type CompanionTab = typeof companionTabs[number]["key"];
type CompanionToggle = "activeWhileVisible" | "roam" | "jump" | "sleep" | "heartPrank" | "cardPrank" | "ambientPrank" | "panelPrank" | "rarePrank" | "drag" | "petting" | "feeding" | "learnFromYou";
const companionToggleActions: Record<CompanionToggle, string> = {
  activeWhileVisible: "companion-active-visible",
  roam: "companion-roam", jump: "companion-jump", sleep: "companion-sleep",
  heartPrank: "companion-heart-prank", cardPrank: "companion-card-prank", ambientPrank: "companion-hide", panelPrank: "companion-panel-prank", rarePrank: "companion-rare-prank",
  drag: "companion-drag-enabled", petting: "companion-petting-enabled", feeding: "companion-feeding-enabled", learnFromYou: "companion-learning-enabled"
};

// Mount only for the visible basic settings page. Leaving it discards a pending
// confirmation, without reading/resetting learned data or storing a new choice.
function LearnedStateReset({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false), [completed, setCompleted] = useState(false);
  const opener = useRef<HTMLButtonElement>(null), cancel = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false);
  useLayoutEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (restoreFocus.current) { restoreFocus.current = false; opener.current?.focus({ preventScroll: true }); }
  }, [confirming]);
  const dismiss = () => { restoreFocus.current = true; setConfirming(false); };
  return <div className={`rhh-habit-actions${confirming ? " rhh-reset-confirmation" : ""}`}
    role={confirming ? "group" : undefined} aria-labelledby={confirming ? `${id}-reset-question` : undefined}
    onKeyDownCapture={event => { if (confirming && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); } }}>
    {confirming ? <>
      <p className="rhh-trait-reset-note"><strong id={`${id}-reset-question`}>배운 내용을 초기화할까요?</strong><span id={`${id}-reset-note`}>습관·취향·특성 초기화 · 도감·선물 유지</span></p>
      <div className="rhh-reset-buttons">
        <button className="rhh-link" data-activity-manual="" onClick={dismiss} ref={cancel} type="button"><span className="vmid">취소</span></button>
        <button aria-describedby={`${id}-reset-note`} aria-label="배운 습관 초기화 확정" className="rhh-link rhh-reset-confirm" data-act="companion-learning-reset" data-activity-manual="" onClick={() => {
          resetCompanionHabits(); resetCompanionTastes(); hapticTick(); playSfx("tab");
          // Opening/cancelling is preparatory UI, not a completed reset. Keep
          // the existing fixed target, one explicit completion and no metadata.
          logActivity("ui.click", { target: "companion-learning-reset" });
          setCompleted(true); dismiss();
        }} type="button"><span className="vmid">초기화</span></button>
      </div>
    </> : <>
      <p className="rhh-trait-reset-note" id={`${id}-reset-note`} role={completed ? "status" : undefined}>{completed ? "초기화했어요. 도감·선물은 유지돼요." : "습관·취향·특성 초기화 · 도감·선물 유지"}</p>
      <button aria-describedby={`${id}-reset-note`} aria-label="배운 습관 초기화" className="rhh-link" data-act="companion-learning-reset" data-activity-manual="" onClick={() => { setCompleted(false); setConfirming(true); }} ref={opener} type="button"><span className="vmid">초기화</span></button>
    </>}
  </div>;
}

const placeTabs: Partial<Record<CompanionSettingsPlace, CompanionTab>> = { "companion-roam": "motion", "companion-sound": "sound", "companion-radio": "sound" };
const blockedRows: Partial<Record<CompanionToggle, CompanionBlockedRow>> = { roam: "roam", jump: "jump", heartPrank: "heartPrank", cardPrank: "cardPrank", ambientPrank: "ambientPrank", panelPrank: "panelPrank", rarePrank: "rarePrank" };
export type CompanionPlaceRequest = Readonly<{ place: CompanionSettingsPlace; n: number }>;

/** Shared setting controls stay editable while OFF, so a quiet preset can be prepared first.
 * A row that an outer setting keeps from working stays operable with its value;
 * it is dimmed and says which setting is in the way (stage 1, proposal 3-4). */
export function CompanionBehaviorSettings({ preferences, onChange, site, onGoTo, placeRequest, active, radio, personalityRequest = 0 }: { preferences: CompanionPreferences; onChange: (patch: Partial<CompanionPreferences>) => void; site: CompanionSiteGates; onGoTo: (place: CompanionSettingsPlace) => void; placeRequest?: CompanionPlaceRequest; active: boolean; radio: ReactNode; personalityRequest?: number }) {
  const [tab, setTab] = useState<CompanionTab>("personality");
  const id = useId();
  const personalityPreview = { performer: "cheer-rehearsal", curious: preferences.jump ? "pounce" : "bow", affectionate: preferences.petting ? "ask-petting" : "bow", sleepy: preferences.sleep ? "doze-curl" : "stretch", tidy: "groom", mischievous: preferences.jump ? "tumble" : "bow", gourmet: "bow", homebody: "paper-knead", balanced: "bow" }[preferences.personality];
  const nav = useRef<HTMLDivElement>(null);
  const personalitySection = useRef<HTMLDivElement>(null), focusedRequest = useRef(0);
  useLayoutEffect(() => {
    if (!active || personalityRequest <= 0 || focusedRequest.current === personalityRequest) return;
    if (tab !== "personality") { setTab("personality"); return; }
    const section = personalitySection.current, selected = section?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]');
    if (!section || !selected) return;
    focusedRequest.current = personalityRequest;
    // An explicit shortcut exposes the existing three-by-three controls. It
    // does not synthesize another click, persist a choice or start a timer.
    section.scrollIntoView({ block: "start", behavior: "instant" });
    selected.focus({ preventScroll: true });
  }, [active, personalityRequest, tab]);
  const root = useRef<HTMLDivElement>(null);
  // A place inside this page is reached here; any other place belongs to the host.
  const [localPlace, setLocalPlace] = useState<CompanionPlaceRequest>({ place: "companion-power", n: 0 }), servedPlace = useRef(""), tabbedPlace = useRef(""), hostPlace = useRef(placeRequest?.n ?? 0);
  useEffect(() => { if (placeRequest && placeRequest.n !== hostPlace.current) { hostPlace.current = placeRequest.n; setLocalPlace(current => ({ place: placeRequest.place, n: current.n + 1 })); } }, [placeRequest]);
  // A page opened straight onto a place (the blocked home radio) arrives with its request already set.
  useEffect(() => { if (placeRequest && placeRequest.n > 0) setLocalPlace(current => current.n ? current : { place: placeRequest.place, n: 1 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (place: CompanionSettingsPlace) => { if (place.startsWith("companion-")) setLocalPlace(current => ({ place, n: current.n + 1 })); else onGoTo(place); };
  useLayoutEffect(() => {
    const key = `${localPlace.place}:${localPlace.n}`;
    if (!active || !localPlace.n || servedPlace.current === key) return;
    const wanted = placeTabs[localPlace.place];
    if (wanted && wanted !== tab) {
      // Switch once. If the tab differs again, the user chose another one: the request is over.
      if (tabbedPlace.current === key) { servedPlace.current = key; return; }
      tabbedPlace.current = key; setTab(wanted); return;
    }
    // The radio card mounts a moment after its tab; look again for a few frames, then give up for good.
    let frame = 0, tries = 0;
    const attempt = () => { if (flashSettingsPlace(root.current, localPlace.place) || ++tries >= 40) servedPlace.current = key; else frame = requestAnimationFrame(attempt); };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, [active, localPlace, tab]);
  const off = !preferences.enabled;
  const block = (key: CompanionBlockedRow) => companionRowBlock(key, preferences, site);
  const note = (value: CompanionSettingsNote | null, key?: string) => value && !off ? <SettingsNote key={key} onGoTo={place => goTo(place as CompanionSettingsPlace)} place={value.place} placeLabel={value.place && COMPANION_SETTINGS_PLACE_LABELS[value.place]} text={value.text} /> : null;
  // Rows that share one reason say it once, under the last of them.
  const rows = (items: readonly (readonly [CompanionToggle, string, ReactNode])[]) => items.flatMap(([key, label, icon], index) => {
    const blockedRow = blockedRows[key], reason = blockedRow ? block(blockedRow) : off && key !== "learnFromYou" ? { text: "" } : null, next = items[index + 1];
    // Several rows stopped by one setting: say it once, above them, where it is seen without scrolling.
    // A single stopped row keeps its reason right under it.
    const same = (other: readonly [CompanionToggle, string, ReactNode] | undefined) => { const otherRow = other && blockedRows[other[0]]; return Boolean(reason?.text && otherRow && block(otherRow)?.text === reason.text); };
    const previous = items[index - 1], leads = same(next) && !same(previous), follows = same(previous);
    return [
      leads ? note(reason, `${key}-lead`) : null,
      <div className={`role-help-haptics${reason ? " is-blocked" : ""}`} data-settings-place={key === "roam" ? "companion-roam" : undefined} key={key}>
        <RowLabel icon={icon} tone="leaf">{label}</RowLabel>
        <Switch dataAct={companionToggleActions[key]} dataActOpt={preferences[key] ? "off" : "on"} label={`빅타민 ${label} 켜기/끄기`} on={preferences[key]} onToggle={() => onChange({ [key]: !preferences[key] })} />
      </div>,
      leads || follows ? null : note(reason?.text ? reason : null, `${key}-note`),
    ];
  });
  const row = (key: CompanionToggle, label: string, icon: ReactNode) => rows([[key, label, icon]]);
  const soundStatus = companionSoundStatus(preferences, site), soundLevel = companionSoundLevel(preferences);
  const chooseSoundLevel = (level: CompanionSoundLevel) => { const patch = companionSoundLevelPatch(level, preferences); onChange(patch); previewCompanionSoundLevel(level, { ...preferences, ...patch }); };
  // Setting the volume lets the current level be heard at that volume; off stays silent.
  const auditionVolume = (soundVolume: number) => previewCompanionSoundVolume({ ...preferences, soundVolume });
  // A tile is pressable exactly when its real sound could be heard now; nothing here bypasses a setting.
  const [auditioned, setAuditioned] = useState<CompanionSoundMoment | null>(null);
  const siteSilent = !site.soundOn || site.soundVolume <= 0;
  const onKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const index = companionTabs.findIndex(item => item.key === tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? companionTabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % companionTabs.length : event.key === "ArrowLeft" ? (index - 1 + companionTabs.length) % companionTabs.length : -1;
    if (next < 0) return;
    event.preventDefault();
    event.stopPropagation();
    setTab(companionTabs[next].key);
    if (companionTabs[next].key !== tab) logActivity("ui.click", { target: `settings-companion-tab#${companionTabs[next].key}` });
    nav.current?.querySelector<HTMLButtonElement>(`[data-companion-tab="${companionTabs[next].key}"]`)?.focus();
    playSfx("tab");
  };
  return <div className="rhh-companion-settings" ref={root}>
    <div className="rhh-group-card rhh-companion-master">
      <div className="role-help-haptics" data-settings-place="companion-power">
        <RowLabel icon={<Sparkles size={20} />} tone="leaf"><span className="rhh-companion-master-copy"><strong>빅타민</strong><span>{preferences.enabled ? "함께 지내는 중" : "쉬는 중"}</span></span></RowLabel>
        <Switch dataAct="companion-enabled" dataActOpt={preferences.enabled ? "off" : "on"} label="AI 빅타민 켜기/끄기" on={preferences.enabled} onToggle={() => onChange({ enabled: !preferences.enabled })} />
      </div>
    </div>
    <div aria-label="빅타민 설정" className="rhh-seg rhh-companion-nav" ref={nav} role="tablist" style={{ "--n": companionTabs.length, "--i": companionTabs.findIndex(item => item.key === tab) } as CSSProperties}>
      <span aria-hidden="true" className="rhh-seg-thumb" />
      {companionTabs.map(item => <button aria-controls={`${id}-${item.key}-panel`} aria-selected={tab === item.key} className={tab === item.key ? "on" : ""} data-act="settings-companion-tab" data-act-opt={item.key} data-companion-tab={item.key} id={`${id}-${item.key}`} key={item.key} onClick={() => { if (tab !== item.key) playSfx("tab"); setTab(item.key); }} onKeyDown={onKey} role="tab" tabIndex={tab === item.key ? 0 : -1} type="button"><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
    </div>
    {off && tab !== "personality" ? <SettingsNote className="rhh-note-resting" text="빅타민이 쉬는 중이라 아래 설정은 켜면 적용돼요" /> : null}
    <div aria-labelledby={`${id}-motion`} hidden={tab !== "motion"} id={`${id}-motion-panel`} role="tabpanel" tabIndex={0}>
      <div className="rhh-group-card">
        {rows([["roam", "돌아다니기", <Pointer key="i" size={15} />], ["jump", "깡충 뛰기", <Sparkles key="i" size={15} />]])}
        {row("activeWhileVisible", "다른 창 작업 중에도 활동", <Pointer size={15} />)}
        {row("sleep", "자동 잠자기", <EyeOff size={15} />)}
        <div className="role-help-haptics rhh-stack-sm">
          <RowLabel icon={<Gauge size={15} />} tone="leaf">걸음</RowLabel>
          <SettingsSegment ariaLabel="빅타민 걸음" dataAct="companion-speed" onChange={speed => onChange({ speed })} options={[{ value: "relaxed", label: "느긋하게" }, { value: "normal", label: "보통" }, { value: "lively", label: "발랄하게" }]} value={preferences.speed} />
        </div>
      </div>
    </div>
    <div aria-labelledby={`${id}-pranks`} hidden={tab !== "pranks"} id={`${id}-pranks-panel`} role="tabpanel" tabIndex={0}>
      <div className="rhh-group-card">
        {rows([["heartPrank", "하트 콩", <Heart key="i" size={15} />], ["cardPrank", "일정 기울이기", <PanelTopOpen key="i" size={15} />], ["ambientPrank", "숨바꼭질", <Leaf key="i" size={15} />],
          ["panelPrank", "패널 자리 장난", <ArrowDownToLine key="i" size={15} />], ["rarePrank", "희귀 소품 장난", <Sparkles key="i" size={15} />]])}
      </div>
    </div>
    <div aria-labelledby={`${id}-affection`} hidden={tab !== "affection"} id={`${id}-affection-panel`} role="tabpanel" tabIndex={0}>
      <div className="rhh-group-card">
        {row("drag", "집어 옮기기", <Grab size={15} />)}
        {row("petting", "쓰다듬기", <Heart size={15} />)}
        {row("feeding", "밥주기", <Leaf size={15} />)}
      </div>
    </div>
    <div aria-labelledby={`${id}-sound`} hidden={tab !== "sound"} id={`${id}-sound-panel`} role="tabpanel" tabIndex={0}>
      <div aria-live="polite" className="rhh-sound-status-slot"><SettingsNote className="rhh-sound-status" onGoTo={place => goTo(place as CompanionSettingsPlace)} place={soundStatus.place} placeLabel={soundStatus.place && COMPANION_SETTINGS_PLACE_LABELS[soundStatus.place]} state={soundStatus.state} text={soundStatus.text} /></div>
      <div className="rhh-group-card rhh-companion-sound">
        {/* One choice instead of a master switch and three groups (redesign 2-나). Choosing a level plays what that level sounds like, once. */}
        <div className={`role-help-haptics rhh-stack-sm rhh-companion-choice-row${off ? " is-blocked" : ""}`} data-settings-place="companion-sound">
          <RowLabel icon={<Volume2 size={15} />} tone="water">빅타민 소리</RowLabel>
          <SettingsSegment<CompanionSoundLevel> ariaLabel="빅타민 소리" columns={3} dataAct="companion-sound-level" onChange={chooseSoundLevel} onReselect={chooseSoundLevel} options={[{ value: "off", label: "끔" }, { value: "touch", label: "만질 때만" }, { value: "all", label: "전부" }]} value={soundLevel} />
        </div>
        <div className={`role-help-haptics rhh-stack-sm${off || !preferences.sound || !preferences.soundCare ? " is-blocked" : ""}`}><RowLabel icon={<Volume1 size={15} />} tone="water">빅타민 음량</RowLabel><div className="rhh-volume"><VolumeX aria-hidden="true" size={15} /><input aria-label="빅타민 음량" aria-valuetext={`${preferences.soundVolume}%`} data-act="companion-sound-volume" data-sfx="off" max={100} min={0} onChange={event => onChange({ soundVolume: Number(event.currentTarget.value) })} onKeyUp={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) auditionVolume(Number(event.currentTarget.value)); }} onPointerUp={event => auditionVolume(Number(event.currentTarget.value))} step={5} style={{ "--vol": `${preferences.soundVolume}%` } as CSSProperties} type="range" value={preferences.soundVolume} /><Volume2 aria-hidden="true" size={15} /><b className="rhh-vol-num">{preferences.soundVolume}</b></div></div>
        <details className="rhh-sound-auditions">
          <summary data-act="companion-sound-audition-fold" data-activity-manual="" onClick={event => logActivity("ui.click", { target: event.currentTarget.closest("details")?.open ? "companion-sound-audition-fold#close" : "companion-sound-audition-fold#open" })}>소리 들어 보기</summary>
          <div className="rhh-sound-board">
            {COMPANION_SOUND_AUDITIONS.map(group => <div className="rhh-sound-group" key={group.label}>
              <span className="rhh-font-group-label">{group.label}</span>
              <div className="rhh-sound-tiles">
                {group.moments.map(moment => <button className={`rhh-sound-tile${auditioned === moment ? " playing" : ""}`} data-act="companion-sound-audition" data-act-opt={moment} data-sfx="off" disabled={siteSilent || !companionSoundAllowed(preferences, group.origin, site)} key={moment} onAnimationEnd={() => setAuditioned(current => current === moment ? null : current)} onClick={() => { if (!auditionCompanionSound(moment, preferences)) return; setAuditioned(null); requestAnimationFrame(() => setAuditioned(moment)); }} type="button"><span className="rhh-sound-label">{COMPANION_SOUND_NAMES[moment]}</span></button>)}
              </div>
            </div>)}
          </div>
          <p className="rhh-group-foot">{"같은 소리라도 내가 만져서 나면 '만질 때' 소리, 빅타민이 혼자 내면 '혼자 놀 때' 소리예요. 다른 탭을 볼 때는 쉬어요."}</p>
        </details>
      </div>
      {active && tab === "sound" && radio}
    </div>
    <div aria-labelledby={`${id}-personality`} hidden={tab !== "personality"} id={`${id}-personality-panel`} role="tabpanel" tabIndex={0}>
      <div className="rhh-group-card rhh-profile-controls">
        <h3 className="rhh-companion-card-title">기본 설정</h3>
        <div className="role-help-haptics rhh-stack-sm rhh-companion-choice-row">
          <RowLabel icon={<Sparkles size={15} />} tone="leaf">동물 모드</RowLabel>
          <SettingsSegment ariaLabel="빅타민 동물 모드" columns={3} dataAct="companion-animal" onChange={animalMode => onChange({ animalMode })} options={[{ value: "default", label: "빅타민" }, { value: "cat", label: "고양이" }, { value: "dog", label: "강아지" }]} value={preferences.animalMode} />
        </div>
        <div className="role-help-haptics rhh-stack-sm rhh-companion-choice-row rhh-personality-section" ref={personalitySection}>
          <RowLabel icon={<Sparkles size={15} />} tone="leaf">지금 성격</RowLabel>
          <div className="rhh-personality-preview" data-personality-preview={preferences.personality}>
            <CompanionWardrobePreview key={preferences.personality} accessory={null} behaviors={[personalityPreview]} enabled={active && tab === "personality" && preferences.enabled} interactive={false} />
            <div><strong>{COMPANION_PERSONALITY_NAMES[preferences.personality]}</strong><p>{COMPANION_PERSONALITY_SUMMARIES[preferences.personality]}</p></div>
          </div>
          <SettingsSegment ariaLabel="빅타민 성격" columns={3} dataAct="companion-personality" onChange={personality => onChange({ personality })} onReselect={personality => onChange({ personality })} options={COMPANION_PERSONALITY_LAYOUT.map(value => ({ value, label: COMPANION_PERSONALITY_NAMES[value] }))} value={preferences.personality} />
          <p className="rhh-group-foot">직접 고른 성격은 새로고침 후에도 유지돼요. 고르지 않았다면 새로고침마다 무작위로 정해져요.</p>
        </div>
        {row("learnFromYou", "함께 지내며 배우기", <Heart size={15} />)}
      </div>
      {active && tab === "personality" ? <LearnedStateReset id={id} /> : null}
    </div>
  </div>;
}
