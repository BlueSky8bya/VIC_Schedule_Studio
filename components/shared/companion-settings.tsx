"use client";

import { ArrowDownToLine, EyeOff, Gauge, Grab, Heart, Leaf, PanelTopOpen, PartyPopper, Pointer, Sparkles, Volume1, Volume2, VolumeX } from "lucide-react";
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { RowLabel, SettingsSegment, Switch } from "@/components/shared/settings-controls";
import { COMPANION_PERSONALITIES, COMPANION_PERSONALITY_NAMES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_SOUND_CATEGORY_NAMES, previewCompanionSound } from "@/lib/ui/viewer-companion/companion-sound";
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

/** Shared setting controls stay editable while OFF, so a quiet preset can be prepared first. */
export function CompanionBehaviorSettings({ preferences, onChange, globalSoundOn, active, radio }: { preferences: CompanionPreferences; onChange: (patch: Partial<CompanionPreferences>) => void; globalSoundOn: boolean; active: boolean; radio: ReactNode }) {
  const [tab, setTab] = useState<CompanionTab>("personality");
  const id = useId();
  const nav = useRef<HTMLDivElement>(null);
  const row = (key: CompanionToggle, label: string, icon: ReactNode) => (
    <div className="role-help-haptics" key={key}>
      <RowLabel icon={icon} tone="leaf">{label}</RowLabel>
      <Switch dataAct={companionToggleActions[key]} dataActOpt={preferences[key] ? "off" : "on"} label={`빅타민 ${label} 켜기/끄기`} on={preferences[key]} onToggle={() => onChange({ [key]: !preferences[key] })} />
    </div>
  );
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
  return <div className="rhh-companion-settings">
    <div className="rhh-group-card rhh-companion-master">
      <div className="role-help-haptics">
        <RowLabel icon={<Sparkles size={20} />} tone="leaf"><span className="rhh-companion-master-copy"><strong>빅타민</strong><span>{preferences.enabled ? "함께 지내는 중" : "쉬는 중"}</span></span></RowLabel>
        <Switch dataAct="companion-enabled" dataActOpt={preferences.enabled ? "off" : "on"} label="AI 빅타민 켜기/끄기" on={preferences.enabled} onToggle={() => onChange({ enabled: !preferences.enabled })} />
      </div>
    </div>
    <div aria-label="빅타민 설정" className="rhh-seg rhh-companion-nav" ref={nav} role="tablist" style={{ "--n": companionTabs.length, "--i": companionTabs.findIndex(item => item.key === tab) } as CSSProperties}>
      <span aria-hidden="true" className="rhh-seg-thumb" />
      {companionTabs.map(item => <button aria-controls={`${id}-${item.key}-panel`} aria-selected={tab === item.key} className={tab === item.key ? "on" : ""} data-act="settings-companion-tab" data-act-opt={item.key} data-companion-tab={item.key} id={`${id}-${item.key}`} key={item.key} onClick={() => { if (tab !== item.key) playSfx("tab"); setTab(item.key); }} onKeyDown={onKey} role="tab" tabIndex={tab === item.key ? 0 : -1} type="button"><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
    </div>
    <div aria-labelledby={`${id}-motion`} hidden={tab !== "motion"} id={`${id}-motion-panel`} role="tabpanel" tabIndex={0}>
      <div className="rhh-group-card">
        {row("roam", "돌아다니기", <Pointer size={15} />)}
        {row("jump", "깡충 뛰기", <Sparkles size={15} />)}
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
        {row("heartPrank", "하트 콩", <Heart size={15} />)}
        {row("cardPrank", "일정 기울이기", <PanelTopOpen size={15} />)}
        {row("ambientPrank", "숨바꼭질", <Leaf size={15} />)}
        {row("panelPrank", "패널 자리 장난", <ArrowDownToLine size={15} />)}
        {row("rarePrank", "희귀 소품 장난", <Sparkles size={15} />)}
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
      <div className="rhh-group-card rhh-companion-sound">
        <div className="role-help-haptics"><RowLabel icon={<Volume2 size={15} />} tone="water">빅타민 효과음</RowLabel><Switch dataAct="companion-sound-enabled" dataActOpt={preferences.sound ? "off" : "on"} label="빅타민 효과음 켜기/끄기" on={preferences.sound} onToggle={() => onChange({ sound: !preferences.sound })} /></div>
        <div className="role-help-haptics rhh-stack-sm"><RowLabel icon={<Volume1 size={15} />} tone="water">빅타민 음량</RowLabel><div className="rhh-volume"><VolumeX aria-hidden="true" size={15} /><input aria-label="빅타민 음량" aria-valuetext={`${preferences.soundVolume}%`} data-act="companion-sound-volume" data-sfx="off" max={100} min={0} onChange={event => onChange({ soundVolume: Number(event.currentTarget.value) })} onKeyUp={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) previewCompanionSound("care", { ...preferences, soundVolume: Number(event.currentTarget.value) }); }} onPointerUp={event => previewCompanionSound("care", { ...preferences, soundVolume: Number(event.currentTarget.value) })} step={5} style={{ "--vol": `${preferences.soundVolume}%` } as CSSProperties} type="range" value={preferences.soundVolume} /><Volume2 aria-hidden="true" size={15} /><b className="rhh-vol-num">{preferences.soundVolume}</b></div></div>
        {([{ category: "care", key: "soundCare", action: "companion-sound-care" }, { category: "motion", key: "soundMotion", action: "companion-sound-motion" }, { category: "keepsakes", key: "soundKeepsakes", action: "companion-sound-keepsakes" }] as const).map(({ category, key, action }) => <div className="role-help-haptics" key={category}><RowLabel icon={category === "care" ? <Heart size={15} /> : category === "motion" ? <Sparkles size={15} /> : <PartyPopper size={15} />} tone="water">{COMPANION_SOUND_CATEGORY_NAMES[category]}</RowLabel><div className="rhh-companion-sound-actions"><button aria-label={`${COMPANION_SOUND_CATEGORY_NAMES[category]} 소리 미리 듣기`} className="rhh-link" data-act="companion-sound-preview" data-act-opt={category} data-sfx="off" disabled={!globalSoundOn || !preferences.enabled || !preferences.sound || !preferences[key] || preferences.soundVolume === 0} onClick={() => previewCompanionSound(category, preferences)} type="button"><Volume1 aria-hidden="true" size={16} /></button><Switch dataAct={action} dataActOpt={preferences[key] ? "off" : "on"} label={`빅타민 ${COMPANION_SOUND_CATEGORY_NAMES[category]} 소리 켜기/끄기`} on={preferences[key]} onToggle={() => onChange({ [key]: !preferences[key] })} /></div></div>)}
      </div>
      {!globalSoundOn && <p className="rhh-group-foot">전체 효과음이 꺼져 있어요.</p>}
      {active && tab === "sound" && radio}
    </div>
    <div aria-labelledby={`${id}-personality`} hidden={tab !== "personality"} id={`${id}-personality-panel`} role="tabpanel" tabIndex={0}>
      <div className="rhh-group-card rhh-profile-controls">
        <h3 className="rhh-companion-card-title">기본 설정</h3>
        <div className="role-help-haptics rhh-stack-sm">
          <RowLabel icon={<Sparkles size={15} />} tone="leaf">동물 모드</RowLabel>
          <SettingsSegment ariaLabel="빅타민 동물 모드" dataAct="companion-animal" onChange={animalMode => onChange({ animalMode })} options={[{ value: "default", label: "빅타민" }, { value: "cat", label: "고양이" }, { value: "dog", label: "강아지" }]} value={preferences.animalMode} />
        </div>
        <div className="role-help-haptics rhh-stack-sm">
          <RowLabel icon={<Sparkles size={15} />} tone="leaf">기본 성격</RowLabel>
          <SettingsSegment ariaLabel="빅타민 성격" columns={4} dataAct="companion-personality" onChange={personality => onChange({ personality })} options={COMPANION_PERSONALITIES.map(value => ({ value, label: COMPANION_PERSONALITY_NAMES[value] }))} value={preferences.personality} />
        </div>
        {row("learnFromYou", "함께 지내며 배우기", <Heart size={15} />)}
      </div>
      <div className="rhh-habit-actions"><p className="rhh-trait-reset-note" id={`${id}-reset-note`}>습관·취향·특성 초기화 · 도감·선물 유지</p><button aria-describedby={`${id}-reset-note`} aria-label="배운 습관 초기화" className="rhh-link" data-act="companion-learning-reset" onClick={() => { resetCompanionHabits(); resetCompanionTastes(); hapticTick(); playSfx("tab"); }} type="button">초기화</button></div>
    </div>
  </div>;
}
