"use client";

import { ArrowDownToLine, EyeOff, Gauge, Grab, Heart, Leaf, Pointer, Sparkles, Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RowLabel, SettingsNote, SettingsSegment, Switch, flashSettingsPlace } from "@/components/shared/settings-controls";
import { COMPANION_SETTINGS_PLACE_LABELS, companionRowBlock, companionSiteVolumeBlock, companionSoundStatus, type CompanionBlockedRow, type CompanionSettingsNote, type CompanionSettingsPlace, type CompanionSiteGates } from "@/lib/ui/viewer-companion/settings-status";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_SOUND_AUDITIONS, COMPANION_SOUND_HINTS, COMPANION_SOUND_NAMES, auditionCompanionSound, companionSoundAllowed, previewCompanionSoundLevel, previewCompanionSoundVolume, type CompanionSoundMoment } from "@/lib/ui/viewer-companion/companion-sound";
import { companionPlayful, companionPlayfulPatch, companionSoundLevel, companionSoundLevelPatch, type CompanionSoundLevel } from "@/lib/ui/viewer-companion/settings-levels";
import { logActivity } from "@/lib/activity/client";

/** What each row does, in a few words. Shown when the row is hovered or its
 * control has keyboard focus, and given to the control as its spoken
 * description. Keep each to one short line. */
export const COMPANION_SETTING_HINTS = Object.freeze({
  playful: "가끔 일정 카드 뒤에 숨거나 장난감을 어질러요.",
  panelPrank: "옆 패널을 잠깐 반대쪽으로 옮겨요.",
  speed: "걷는 빠르기예요.",
  sleep: "가만히 두면 스스로 잠들어요.",
  activeWhileVisible: "방송 프로그램 등을 쓰는 동안에도 계속 놀아요.",
  drag: "마우스로 집어서 옮길 수 있어요.",
  petting: "문지르거나 톡 치면 좋아해요.",
  feeding: "집에 밥통이 생겨 밥을 줄 수 있어요.",
} as const);
/** The site volume row on the sound card: the same slider as 설정 › 소리. */
export const SITE_VOLUME_HINT = "사이트 전체 소리 크기예요. 소리 탭과 같은 값이에요.";
/** The sound level explains each choice by itself. */
export const COMPANION_SOUND_LEVEL_HINTS = Object.freeze({ off: "소리를 내지 않아요.", touch: "쓰다듬거나 집을 때만 소리가 나요.", all: "혼자 놀다 내는 소리까지 나요." } as const);
/** Whether "더 보기" is open. Kept for this page load only: reopening the settings finds it as it was left, a reload folds it again. Nothing is stored. */
let moreOpen = false;

type CompanionToggle = "activeWhileVisible" | "sleep" | "panelPrank" | "drag" | "petting" | "feeding";
const companionToggleActions: Record<CompanionToggle, string> = {
  activeWhileVisible: "companion-active-visible", sleep: "companion-sleep", panelPrank: "companion-panel-prank",
  drag: "companion-drag-enabled", petting: "companion-petting-enabled", feeding: "companion-feeding-enabled"
};

export type CompanionPlaceRequest = Readonly<{ place: CompanionSettingsPlace; n: number }>;

/** Shared setting controls stay editable while OFF, so a quiet preset can be prepared first.
 * A row that an outer setting keeps from working stays operable with its value;
 * it is dimmed and says which setting is in the way (stage 1, proposal 3-4). */
export function CompanionBehaviorSettings({ preferences, onChange, site, siteVolume, onGoTo, placeRequest, active, radio }: { preferences: CompanionPreferences; onChange: (patch: Partial<CompanionPreferences>) => void; site: CompanionSiteGates; siteVolume?: ReactNode; onGoTo: (place: CompanionSettingsPlace) => void; placeRequest?: CompanionPlaceRequest; active: boolean; radio: ReactNode }) {
  const soundHintId = useId();
  const root = useRef<HTMLDivElement>(null);
  // A place inside this page is reached here; any other place belongs to the host.
  const [localPlace, setLocalPlace] = useState<CompanionPlaceRequest>({ place: "companion-power", n: 0 }), servedPlace = useRef(""), hostPlace = useRef(placeRequest?.n ?? 0);
  useEffect(() => { if (placeRequest && placeRequest.n !== hostPlace.current) { hostPlace.current = placeRequest.n; setLocalPlace(current => ({ place: placeRequest.place, n: current.n + 1 })); } }, [placeRequest]);
  // A page opened straight onto a place (the blocked home radio) arrives with its request already set.
  useEffect(() => { if (placeRequest && placeRequest.n > 0) setLocalPlace(current => current.n ? current : { place: placeRequest.place, n: 1 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (place: CompanionSettingsPlace) => { if (place.startsWith("companion-")) setLocalPlace(current => ({ place, n: current.n + 1 })); else onGoTo(place); };
  useLayoutEffect(() => {
    const key = `${localPlace.place}:${localPlace.n}`;
    if (!active || !localPlace.n || servedPlace.current === key) return;
    // The radio card mounts a moment after this page; look again for a few frames, then give up for good.
    // The power switch lives in the shared header above the pages, so the search starts from the whole companion block.
    let frame = 0, tries = 0;
    const attempt = () => { if (flashSettingsPlace(root.current?.closest(".rhh-companion-profile") ?? root.current, localPlace.place) || ++tries >= 40) servedPlace.current = key; else frame = requestAnimationFrame(attempt); };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, [active, localPlace]);
  const off = !preferences.enabled;
  const block = (key: CompanionBlockedRow) => companionRowBlock(key, preferences, site);
  const note = (value: CompanionSettingsNote | null) => value && !off ? <SettingsNote onGoTo={place => goTo(place as CompanionSettingsPlace)} place={value.place} placeLabel={value.place && COMPANION_SETTINGS_PLACE_LABELS[value.place]} text={value.text} /> : null;
  // A stopped row is dimmed and says why right under it; a row an outer setting only partly rests keeps its look.
  const stopped = (reason: CompanionSettingsNote | null) => off || Boolean(reason && !reason.partial);
  const row = (key: CompanionToggle, label: string, icon: ReactNode, blockedRow?: CompanionBlockedRow) => {
    const reason = blockedRow ? block(blockedRow) : null;
    return <>
      <div className={`role-help-haptics${stopped(reason) ? " is-blocked" : ""}`} data-tip={COMPANION_SETTING_HINTS[key]}>
        <RowLabel icon={icon} tone="leaf">{label}</RowLabel>
        <Switch dataAct={companionToggleActions[key]} dataActOpt={preferences[key] ? "off" : "on"} description={COMPANION_SETTING_HINTS[key]} label={`빅타민 ${label} 켜기/끄기`} on={preferences[key]} onToggle={() => onChange({ [key]: !preferences[key] })} />
      </div>
      {note(reason)}
    </>;
  };
  // The four pranks are one switch, read from and written to the existing fields. Movement is not a setting: it is always free.
  const playful = companionPlayful(preferences), playfulBlock = block("playful");
  const [more, setMore] = useState(moreOpen);
  const soundStatus = companionSoundStatus(preferences, site), soundLevel = companionSoundLevel(preferences);
  const chooseSoundLevel = (level: CompanionSoundLevel) => { const patch = companionSoundLevelPatch(level, preferences); onChange(patch); previewCompanionSoundLevel(level, { ...preferences, ...patch }); };
  // Setting the volume lets the current level be heard at that volume; off stays silent.
  const auditionVolume = (soundVolume: number) => previewCompanionSoundVolume({ ...preferences, soundVolume });
  // A tile is pressable exactly when its real sound could be heard now; nothing here bypasses a setting.
  const [auditioned, setAuditioned] = useState<CompanionSoundMoment | null>(null);
  const siteSilent = !site.soundOn || site.soundVolume <= 0;
  const siteVolumeBlock = companionSiteVolumeBlock(site);
  return <div className="rhh-companion-settings rhh-companion-cards" ref={root}>
    {off ? <SettingsNote className="rhh-note-resting" text="빅타민이 쉬는 중이라 아래 설정은 켜면 적용돼요" /> : null}
    <section aria-label="소리" className="rhh-companion-section">
      <div className="rhh-group-card rhh-companion-sound">
        {/* One choice instead of a master switch and three groups (redesign 2-나). Choosing a level plays what that level sounds like, once.
            Whether a sound can be heard right now is said on the same line, to the right of the name. */}
        <div className={`role-help-haptics rhh-companion-choice-row rhh-companion-sound-row${off ? " is-blocked" : ""}`} data-settings-place="companion-sound">
          <RowLabel icon={<Volume2 size={15} />} tone="water">빅타민 소리</RowLabel>
          <div aria-live="polite" className="rhh-sound-status-slot"><SettingsNote className="rhh-sound-status" onGoTo={place => goTo(place as CompanionSettingsPlace)} place={soundStatus.place} placeLabel={soundStatus.place && COMPANION_SETTINGS_PLACE_LABELS[soundStatus.place]} state={soundStatus.state} text={soundStatus.text} /></div>
          <SettingsSegment<CompanionSoundLevel> ariaLabel="빅타민 소리" columns={3} dataAct="companion-sound-level" onChange={chooseSoundLevel} onReselect={chooseSoundLevel} options={[{ value: "off", label: "끔", tip: COMPANION_SOUND_LEVEL_HINTS.off }, { value: "touch", label: "만질 때만", tip: COMPANION_SOUND_LEVEL_HINTS.touch }, { value: "all", label: "전부", tip: COMPANION_SOUND_LEVEL_HINTS.all }]} value={soundLevel} />
        </div>
        {/* The site's own volume, the same control and value as 설정 › 소리 (owner 2026-11-19). The status line above reads it live. */}
        {siteVolume ? <>
          <div className={`role-help-haptics rhh-stack-sm${siteVolumeBlock ? " is-blocked" : ""}`} data-tip={SITE_VOLUME_HINT}><RowLabel icon={<Volume2 size={15} />} tone="water">전체 음량</RowLabel>{siteVolume}</div>
          {siteVolumeBlock ? <SettingsNote onGoTo={place => goTo(place as CompanionSettingsPlace)} place={siteVolumeBlock.place} placeLabel={siteVolumeBlock.place && COMPANION_SETTINGS_PLACE_LABELS[siteVolumeBlock.place]} text={siteVolumeBlock.text} /> : null}
        </> : null}
        <div className={`role-help-haptics rhh-stack-sm${off || !preferences.sound || !preferences.soundCare ? " is-blocked" : ""}`}><RowLabel icon={<Volume1 size={15} />} tone="water">빅타민 음량</RowLabel><div className="rhh-volume"><VolumeX aria-hidden="true" size={15} /><input aria-label="빅타민 음량" aria-valuetext={`${preferences.soundVolume}%`} data-act="companion-sound-volume" data-sfx="off" max={100} min={0} onChange={event => onChange({ soundVolume: Number(event.currentTarget.value) })} onKeyUp={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) auditionVolume(Number(event.currentTarget.value)); }} onPointerUp={event => auditionVolume(Number(event.currentTarget.value))} step={5} style={{ "--vol": `${preferences.soundVolume}%` } as CSSProperties} type="range" value={preferences.soundVolume} /><Volume2 aria-hidden="true" size={15} /><b className="rhh-vol-num">{preferences.soundVolume}</b></div></div>
        <details className="rhh-sound-auditions">
          <summary data-act="companion-sound-audition-fold" data-activity-manual="" onClick={event => logActivity("ui.click", { target: event.currentTarget.closest("details")?.open ? "companion-sound-audition-fold#close" : "companion-sound-audition-fold#open" })}>소리 들어 보기</summary>
          {/* One even grid. A sound only the companion makes by itself carries a dot: it is heard at "전부" only. */}
          <div className="rhh-sound-board">
            {COMPANION_SOUND_AUDITIONS.flatMap(group => group.moments.map(moment => <button aria-label={COMPANION_SOUND_NAMES[moment]} aria-describedby={`${soundHintId}-${moment}`} className={`rhh-sound-tile${auditioned === moment ? " playing" : ""}`} data-act="companion-sound-audition" data-act-opt={moment} data-own={group.origin === "auto" ? "" : undefined} data-sfx="off" data-tip={COMPANION_SOUND_HINTS[moment]} disabled={siteSilent || !companionSoundAllowed(preferences, group.origin, site)} key={moment} onAnimationEnd={() => setAuditioned(current => current === moment ? null : current)} onClick={() => { if (!auditionCompanionSound(moment, preferences)) return; setAuditioned(null); requestAnimationFrame(() => setAuditioned(moment)); }} type="button"><span className="rhh-sound-label">{COMPANION_SOUND_NAMES[moment]}</span><span className="sr-only" id={`${soundHintId}-${moment}`}>{COMPANION_SOUND_HINTS[moment]}</span></button>))}
          </div>
          <p className="rhh-group-foot"><i aria-hidden="true" className="rhh-sound-own-dot" />{"점이 있는 소리는 빅타민이 혼자 내는 소리라, 빅타민 소리가 '전부'일 때만 나요."}</p>
        </details>
      </div>
      {active && radio}
    </section>
    <section aria-label="장난" className="rhh-companion-section">
      <div className="rhh-group-card">
        <div className={`role-help-haptics${stopped(playfulBlock) ? " is-blocked" : ""}`} data-tip={COMPANION_SETTING_HINTS.playful}>
          <RowLabel icon={<Sparkles size={15} />} tone="leaf">장난치기</RowLabel>
          <Switch dataAct="companion-playful" dataActOpt={playful ? "off" : "on"} description={COMPANION_SETTING_HINTS.playful} label="빅타민 장난치기 켜기/끄기" on={playful} onToggle={() => onChange(companionPlayfulPatch(!playful))} />
        </div>
        {note(playfulBlock)}
        {/* One of the pranks, as its own choice under the switch: it is the only prank that moves the screen.
            With the prank switch off it shows off and cannot be pressed; the stored choice is not touched, so it
            comes back as it was (on stays on, off stays off) when the pranks are switched on again. */}
        <div className={`role-help-haptics rhh-sub-row${stopped(block("panelPrank")) || !playful ? " is-blocked" : ""}`} data-tip={COMPANION_SETTING_HINTS.panelPrank}>
          <RowLabel icon={<ArrowDownToLine size={15} />} tone="leaf">패널 자리 옮기기</RowLabel>
          <Switch dataAct={companionToggleActions.panelPrank} dataActOpt={preferences.panelPrank ? "off" : "on"} description={COMPANION_SETTING_HINTS.panelPrank} disabled={!playful} label="빅타민 패널 자리 옮기기 켜기/끄기" on={playful && preferences.panelPrank} onToggle={() => onChange({ panelPrank: !preferences.panelPrank })} />
        </div>
        {playful ? note(block("panelPrank")) : null}
      </div>
    </section>
    {/* Rarely changed, each still its own choice. How it was left is remembered until the page is reloaded; nothing is stored. */}
    <details className="rhh-companion-more" onToggle={event => { moreOpen = event.currentTarget.open; setMore(moreOpen); }} open={more}>
      <summary data-act="companion-settings-more" data-activity-manual="" onClick={event => logActivity("ui.click", { target: event.currentTarget.closest("details")?.open ? "companion-settings-more#close" : "companion-settings-more#open" })}>더 보기</summary>
      <div className="rhh-group-card">
        <div className={`role-help-haptics rhh-stack-sm${off ? " is-blocked" : ""}`} data-tip={COMPANION_SETTING_HINTS.speed}>
          <RowLabel icon={<Gauge size={15} />} tone="leaf">걸음</RowLabel>
          <SettingsSegment ariaLabel="빅타민 걸음" dataAct="companion-speed" description={COMPANION_SETTING_HINTS.speed} onChange={speed => onChange({ speed })} options={[{ value: "relaxed", label: "느긋하게" }, { value: "normal", label: "보통" }, { value: "lively", label: "발랄하게" }]} value={preferences.speed} />
        </div>
        {row("sleep", "자동 잠자기", <EyeOff size={15} />)}
        {row("activeWhileVisible", "다른 프로그램 쓸 때도 놀기", <Pointer size={15} />)}
        {row("drag", "집어 옮기기", <Grab size={15} />)}
        {row("petting", "쓰다듬기", <Heart size={15} />)}
        {row("feeding", "밥주기", <Leaf size={15} />)}
      </div>
    </details>
  </div>;
}
