"use client";

import { ArrowDownToLine, EyeOff, Gauge, Grab, Heart, Leaf, PanelTopOpen, Pointer, Sparkles, Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RowLabel, SettingsNote, SettingsSegment, Switch, flashSettingsPlace } from "@/components/shared/settings-controls";
import { COMPANION_SETTINGS_PLACE_LABELS, companionRowBlock, companionSoundStatus, type CompanionBlockedRow, type CompanionSettingsNote, type CompanionSettingsPlace, type CompanionSiteGates } from "@/lib/ui/viewer-companion/settings-status";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_SOUND_AUDITIONS, COMPANION_SOUND_NAMES, auditionCompanionSound, companionSoundAllowed, previewCompanionSoundLevel, previewCompanionSoundVolume, type CompanionSoundMoment } from "@/lib/ui/viewer-companion/companion-sound";
import { companionSoundLevel, companionSoundLevelPatch, type CompanionSoundLevel } from "@/lib/ui/viewer-companion/settings-levels";
import { logActivity } from "@/lib/activity/client";

type CompanionToggle = "activeWhileVisible" | "roam" | "jump" | "sleep" | "heartPrank" | "cardPrank" | "ambientPrank" | "panelPrank" | "rarePrank" | "drag" | "petting" | "feeding";
const companionToggleActions: Record<CompanionToggle, string> = {
  activeWhileVisible: "companion-active-visible",
  roam: "companion-roam", jump: "companion-jump", sleep: "companion-sleep",
  heartPrank: "companion-heart-prank", cardPrank: "companion-card-prank", ambientPrank: "companion-hide", panelPrank: "companion-panel-prank", rarePrank: "companion-rare-prank",
  drag: "companion-drag-enabled", petting: "companion-petting-enabled", feeding: "companion-feeding-enabled"
};

const blockedRows: Partial<Record<CompanionToggle, CompanionBlockedRow>> = { roam: "roam", jump: "jump", heartPrank: "heartPrank", cardPrank: "cardPrank", ambientPrank: "ambientPrank", panelPrank: "panelPrank", rarePrank: "rarePrank" };
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
  const note = (value: CompanionSettingsNote | null, key?: string) => value && !off ? <SettingsNote key={key} onGoTo={place => goTo(place as CompanionSettingsPlace)} place={value.place} placeLabel={value.place && COMPANION_SETTINGS_PLACE_LABELS[value.place]} text={value.text} /> : null;
  // Rows that share one reason say it once, under the last of them.
  const rows = (items: readonly (readonly [CompanionToggle, string, ReactNode])[]) => items.flatMap(([key, label, icon], index) => {
    const blockedRow = blockedRows[key], reason = blockedRow ? block(blockedRow) : off ? { text: "" } : null, next = items[index + 1];
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
        {rows([["roam", "돌아다니기", <Pointer key="i" size={15} />], ["jump", "깡충 뛰기", <Sparkles key="i" size={15} />]])}
      </div>
      <div className="rhh-group-card">
        {rows([["heartPrank", "하트 콩", <Heart key="i" size={15} />], ["cardPrank", "일정 기울이기", <PanelTopOpen key="i" size={15} />], ["ambientPrank", "숨바꼭질", <Leaf key="i" size={15} />],
          ["panelPrank", "패널 자리 장난", <ArrowDownToLine key="i" size={15} />], ["rarePrank", "희귀 소품 장난", <Sparkles key="i" size={15} />]])}
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
        {row("activeWhileVisible", "다른 창 작업 중에도 활동", <Pointer size={15} />)}
        {row("drag", "집어 옮기기", <Grab size={15} />)}
        {row("petting", "쓰다듬기", <Heart size={15} />)}
        {row("feeding", "밥주기", <Leaf size={15} />)}
      </div>
    </details>
  </div>;
}
