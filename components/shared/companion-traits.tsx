"use client";

import { Heart, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { RowLabel, SettingsSegment, Switch } from "@/components/shared/settings-controls";
import { COMPANION_PERSONALITY_NAMES, COMPANION_PERSONALITY_SUMMARIES, companionPersonalityIsManual, releaseCompanionPersonalityChoice, subscribeCompanionPreferences, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_PERSONALITY_LAYOUT } from "@/lib/ui/viewer-companion/personality-layout";
import { resetCompanionHabits } from "@/lib/ui/viewer-companion/care";
import { resetCompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { hapticTick } from "@/lib/ui/haptics";
import { playSfx } from "@/lib/ui/sfx";
import { logActivity } from "@/lib/activity/client";
import { companionBehaviorPreferences } from "@/lib/ui/viewer-companion/settings-levels";

// The same local drawing the portrait uses; it loads with that portrait, never with the settings page.
const CompanionWardrobePreview = dynamic(() => import("./companion-wardrobe-preview").then(module => module.CompanionWardrobePreview), { loading: () => null });

/** The move that shows a character at a glance (redesign stage 5). It follows the
 * choices as the companion acts on them, so a preview never shows what it would not do. */
export function companionPersonalityPreview(preferences: Readonly<CompanionPreferences>): string {
  const acts = companionBehaviorPreferences(preferences);
  return { performer: "cheer-rehearsal", curious: "pounce", affectionate: acts.petting ? "ask-petting" : "bow", sleepy: acts.sleep ? "doze-curl" : "stretch", tidy: "groom", mischievous: "tumble", gourmet: "bow", homebody: "paper-knead", balanced: "bow" }[acts.personality];
}

// Look, character and learning: the controls that sit on the "함께 지내기" page
// (settings redesign stage 3). A small module of its own, so that page does not
// pull in the whole settings page.

// Mount only while its page is visible. Leaving it discards a pending
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

/** Who the companion is: look and character. Lives on the "함께 지내기" page next to its portrait (redesign stage 3). */
export function CompanionTraitControls({ preferences, onChange, active, personalityRequest = 0, previewing = false, onPreview }: { preferences: CompanionPreferences; onChange: (patch: Partial<CompanionPreferences>) => void; active: boolean; personalityRequest?: number; /** A character was just chosen here: show its move. The host rests its own portrait meanwhile. */ previewing?: boolean; onPreview?: () => void }) {
  const section = useRef<HTMLDivElement>(null), focusedRequest = useRef(0);
  const [manual, setManual] = useState(false);
  // Read where it is stored, and again whenever any tab changes the record.
  useEffect(() => { const read = () => setManual(companionPersonalityIsManual()); read(); return subscribeCompanionPreferences(read); }, [preferences.personality, active]);
  useLayoutEffect(() => {
    if (!active || personalityRequest <= 0 || focusedRequest.current === personalityRequest) return;
    const selected = section.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]');
    if (!section.current || !selected) return;
    focusedRequest.current = personalityRequest;
    // The home's character label leads here. It shows the existing choices; it picks nothing by itself.
    section.current.scrollIntoView({ block: "start", behavior: "instant" });
    selected.focus({ preventScroll: true });
  }, [active, personalityRequest]);
  return <div className="rhh-group-card rhh-profile-controls">
    <div className="role-help-haptics rhh-stack-sm rhh-companion-choice-row">
      <RowLabel icon={<Sparkles size={15} />} tone="leaf">동물 모드</RowLabel>
      <SettingsSegment ariaLabel="빅타민 동물 모드" columns={3} dataAct="companion-animal" onChange={animalMode => onChange({ animalMode })} options={[{ value: "default", label: "빅타민" }, { value: "cat", label: "고양이" }, { value: "dog", label: "강아지" }]} value={preferences.animalMode} />
    </div>
    <div className="role-help-haptics rhh-stack-sm rhh-companion-choice-row rhh-personality-section" ref={section}>
      <RowLabel icon={<Sparkles size={15} />} tone="leaf">성격</RowLabel>
      <SettingsSegment ariaLabel="빅타민 성격" columns={3} dataAct="companion-personality" onChange={personality => { onChange({ personality }); setManual(true); onPreview?.(); }} onReselect={personality => { onChange({ personality }); setManual(true); onPreview?.(); }} options={COMPANION_PERSONALITY_LAYOUT.map(value => ({ value, label: COMPANION_PERSONALITY_NAMES[value] }))} value={preferences.personality} />
      {/* Choosing a character shows its own move here (stage 5). It appears below the choices, so nothing under the pointer moves. */}
      {active && previewing ? <div className="rhh-personality-preview" data-personality-preview={preferences.personality}>
        <CompanionWardrobePreview key={preferences.personality} accessory={null} behaviors={[companionPersonalityPreview(preferences)]} enabled={preferences.enabled} interactive={false} />
        <div><strong>{COMPANION_PERSONALITY_NAMES[preferences.personality]}</strong><p>{COMPANION_PERSONALITY_SUMMARIES[preferences.personality]}</p></div>
      </div> : null}
      <div className="rhh-personality-random">
        <p aria-live="polite" className="rhh-group-foot">{manual ? "직접 고른 성격이라 새로고침해도 그대로예요." : "고르지 않았다면 새로고침마다 무작위로 정해져요."}</p>
        <button className="rhh-link" data-act="companion-personality-random" disabled={!manual} onClick={() => { releaseCompanionPersonalityChoice(); setManual(false); /* the button now goes off: hand focus to the character that stays */ section.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true }); }} type="button"><span className="vmid">무작위로 되돌리기</span></button>
      </div>
    </div>
  </div>;
}

/** Learning switch and the reset of what it learned, beside the list of learned habits. */
export function CompanionLearningControls({ preferences, onChange, active }: { preferences: CompanionPreferences; onChange: (patch: Partial<CompanionPreferences>) => void; active: boolean }) {
  const id = useId();
  return <div className="rhh-group-card rhh-learning-controls">
    <div className="role-help-haptics">
      <RowLabel icon={<Heart size={15} />} tone="leaf">함께 지내며 배우기</RowLabel>
      <Switch dataAct="companion-learning-enabled" dataActOpt={preferences.learnFromYou ? "off" : "on"} label="빅타민 함께 지내며 배우기 켜기/끄기" on={preferences.learnFromYou} onToggle={() => onChange({ learnFromYou: !preferences.learnFromYou })} />
    </div>
    {active ? <LearnedStateReset id={id} /> : null}
  </div>;
}
