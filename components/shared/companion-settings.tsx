"use client";

import { ArrowDownToLine, EyeOff, Footprints, Gauge, Grab, Heart, Leaf, Pointer, Sparkles, Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RowLabel, SettingsNote, SettingsSegment, Switch, flashSettingsPlace } from "@/components/shared/settings-controls";
import { COMPANION_SETTINGS_PLACE_LABELS, companionRowBlock, companionSoundStatus, type CompanionBlockedRow, type CompanionSettingsNote, type CompanionSettingsPlace, type CompanionSiteGates } from "@/lib/ui/viewer-companion/settings-status";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_SOUND_AUDITIONS, COMPANION_SOUND_NAMES, auditionCompanionSound, companionSoundAllowed, previewCompanionSoundLevel, previewCompanionSoundVolume, type CompanionSoundMoment } from "@/lib/ui/viewer-companion/companion-sound";
import { companionMotionLevel, companionMotionLevelPatch, companionPlayful, companionPlayfulPatch, companionSoundLevel, companionSoundLevelPatch, type CompanionMotionLevel, type CompanionSoundLevel } from "@/lib/ui/viewer-companion/settings-levels";
import { logActivity } from "@/lib/activity/client";
import { CompanionWardrobePreview } from "./companion-wardrobe-preview";
import { COMPANION_PREVIEW_WALK } from "@/lib/ui/viewer-companion/wardrobe-preview";

/** What the small preview does for each movement level (redesign stage 5). */
export const COMPANION_MOTION_PREVIEWS: Readonly<Record<CompanionMotionLevel, readonly string[]>> = Object.freeze({ still: [], walk: [COMPANION_PREVIEW_WALK], run: [COMPANION_PREVIEW_WALK, "pounce"] });
const motionPreviewNotes: Readonly<Record<CompanionMotionLevel, string>> = Object.freeze({ still: "제자리에 가만히 있어요. 부르면 집으로 와요.", walk: "걸어서 돌아다녀요. 뛰어오르지는 않아요.", run: "걷다가 뛰어오르기도 해요." });

type CompanionToggle = "activeWhileVisible" | "sleep" | "panelPrank" | "drag" | "petting" | "feeding";
const companionToggleActions: Record<CompanionToggle, string> = {
  activeWhileVisible: "companion-active-visible", sleep: "companion-sleep", panelPrank: "companion-panel-prank",
  drag: "companion-drag-enabled", petting: "companion-petting-enabled", feeding: "companion-feeding-enabled"
};

export type CompanionPlaceRequest = Readonly<{ place: CompanionSettingsPlace; n: number }>;

/** Shared setting controls stay editable while OFF, so a quiet preset can be prepared first.
 * A row that an outer setting keeps from working stays operable with its value;
 * it is dimmed and says which setting is in the way (stage 1, proposal 3-4). */
export function CompanionBehaviorSettings({ preferences, onChange, site, onGoTo, placeRequest, active, radio }: { preferences: CompanionPreferences; onChange: (patch: Partial<CompanionPreferences>) => void; site: CompanionSiteGates; onGoTo: (place: CompanionSettingsPlace) => void; placeRequest?: CompanionPlaceRequest; active: boolean; radio: ReactNode }) {
  const id = useId();
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
      <div className={`role-help-haptics${stopped(reason) ? " is-blocked" : ""}`}>
        <RowLabel icon={icon} tone="leaf">{label}</RowLabel>
        <Switch dataAct={companionToggleActions[key]} dataActOpt={preferences[key] ? "off" : "on"} label={`빅타민 ${label} 켜기/끄기`} on={preferences[key]} onToggle={() => onChange({ [key]: !preferences[key] })} />
      </div>
      {note(reason)}
    </>;
  };
  // Movement is one choice of three and the four pranks one switch (stage 4); both are read from and written to the existing fields.
  const motionLevel = companionMotionLevel(preferences), playful = companionPlayful(preferences);
  const motionBlock = block("motion"), playfulBlock = block("playful");
  const soundStatus = companionSoundStatus(preferences, site), soundLevel = companionSoundLevel(preferences);
  const chooseSoundLevel = (level: CompanionSoundLevel) => { const patch = companionSoundLevelPatch(level, preferences); onChange(patch); previewCompanionSoundLevel(level, { ...preferences, ...patch }); };
  // Setting the volume lets the current level be heard at that volume; off stays silent.
  const auditionVolume = (soundVolume: number) => previewCompanionSoundVolume({ ...preferences, soundVolume });
  // A tile is pressable exactly when its real sound could be heard now; nothing here bypasses a setting.
  const [auditioned, setAuditioned] = useState<CompanionSoundMoment | null>(null);
  const siteSilent = !site.soundOn || site.soundVolume <= 0;
  return <div className="rhh-companion-settings rhh-companion-cards" ref={root}>
    {off ? <SettingsNote className="rhh-note-resting" text="빅타민이 쉬는 중이라 아래 설정은 켜면 적용돼요" /> : null}
    <section aria-labelledby={`${id}-sound-title`} className="rhh-companion-section">
      <h3 className="rhh-companion-section-title" id={`${id}-sound-title`}>소리</h3>
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
      {active && radio}
    </section>
    <section aria-labelledby={`${id}-motion-title`} className="rhh-companion-section">
      <h3 className="rhh-companion-section-title" id={`${id}-motion-title`}>움직임과 장난</h3>
      <div className="rhh-group-card">
        <div className={`role-help-haptics rhh-stack-sm rhh-companion-choice-row${stopped(motionBlock) ? " is-blocked" : ""}`} data-settings-place="companion-roam">
          <RowLabel icon={<Footprints size={15} />} tone="leaf">움직임</RowLabel>
          <div className="rhh-motion-preview" data-motion-preview={motionLevel}>
            <div aria-hidden="true" className="rhh-motion-preview-art">{active && <CompanionWardrobePreview accessory={null} behaviors={COMPANION_MOTION_PREVIEWS[motionLevel]} enabled={preferences.enabled && !motionBlock} interactive={false} />}</div>
            <p>{motionPreviewNotes[motionLevel]}</p>
          </div>
          <SettingsSegment<CompanionMotionLevel> ariaLabel="빅타민 움직임" columns={3} dataAct="companion-motion-level" onChange={level => onChange(companionMotionLevelPatch(level))} options={[{ value: "still", label: "가만히" }, { value: "walk", label: "걷기만" }, { value: "run", label: "뛰어다니기" }]} value={motionLevel} />
        </div>
        {note(motionBlock)}
      </div>
      <div className="rhh-group-card">
        <div className={`role-help-haptics${stopped(playfulBlock) ? " is-blocked" : ""}`}>
          <RowLabel icon={<Sparkles size={15} />} tone="leaf">장난치기</RowLabel>
          <Switch dataAct="companion-playful" dataActOpt={playful ? "off" : "on"} label="빅타민 장난치기 켜기/끄기" on={playful} onToggle={() => onChange(companionPlayfulPatch(!playful))} />
        </div>
        {note(playfulBlock)}
        {row("panelPrank", "패널 자리 옮기기", <ArrowDownToLine size={15} />, "panelPrank")}
      </div>
    </section>
    {/* Rarely changed, each still its own choice. Folded on every opening: remembering it would need a new stored value. */}
    <details className="rhh-companion-more">
      <summary data-act="companion-settings-more" data-activity-manual="" onClick={event => logActivity("ui.click", { target: event.currentTarget.closest("details")?.open ? "companion-settings-more#close" : "companion-settings-more#open" })}>더 보기 <span>걸음 · 잠 · 다른 창 · 집어 옮기기 · 쓰다듬기 · 밥주기</span></summary>
      <div className="rhh-group-card">
        <div className={`role-help-haptics rhh-stack-sm${off ? " is-blocked" : ""}`}>
          <RowLabel icon={<Gauge size={15} />} tone="leaf">걸음</RowLabel>
          <SettingsSegment ariaLabel="빅타민 걸음" dataAct="companion-speed" onChange={speed => onChange({ speed })} options={[{ value: "relaxed", label: "느긋하게" }, { value: "normal", label: "보통" }, { value: "lively", label: "발랄하게" }]} value={preferences.speed} />
        </div>
        {row("sleep", "자동 잠자기", <EyeOff size={15} />)}
        {row("activeWhileVisible", "다른 창 쓸 때도 놀기", <Pointer size={15} />)}
        {row("drag", "집어 옮기기", <Grab size={15} />)}
        {row("petting", "쓰다듬기", <Heart size={15} />)}
        {row("feeding", "밥주기", <Leaf size={15} />)}
      </div>
    </details>
  </div>;
}
