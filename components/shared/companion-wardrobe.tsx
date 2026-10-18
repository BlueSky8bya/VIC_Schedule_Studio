"use client";

import dynamic from "next/dynamic";
import { Check, Shirt } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CompanionCollectionArt } from "@/components/poster/viewer-companion/companion-collection-art";
import { onCollectionKey } from "./companion-collection-navigation";
import { equipCompanionAccessory, openCompanionGift, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_WEARABLE_IDS, COMPANION_ACCESSORY_NAMES, type CompanionAccessoryId } from "@/lib/ui/viewer-companion/gifts";
import { playCompanionSound } from "@/lib/ui/viewer-companion/companion-sound";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { hapticSuccess } from "@/lib/ui/haptics";

const CompanionWardrobePreview = dynamic(() => import("./companion-wardrobe-preview").then(module => module.CompanionWardrobePreview));

/** Undefined follows what is really worn; null is an explicit bare preview.
 * Selecting a keepsake is a local try-on, never an implicit equipment write. */
export function CompanionWardrobe({ collection, preferences, active }: { collection: CompanionCollection | null; preferences: CompanionPreferences; active: boolean }) {
  const [selectedAccessory, setSelectedAccessory] = useState<CompanionAccessoryId | null>(collection?.gifts.equipped ?? null);
  const [previewChoice, setPreviewChoice] = useState<CompanionAccessoryId | null | undefined>(undefined), [announcement, setAnnouncement] = useState("");
  const host = useRef<HTMLDivElement>(null), touched = useRef(false), pendingFocus = useRef<CompanionAccessoryId | null>(null);
  const gifts = collection?.gifts, owned = selectedAccessory !== null && Boolean(gifts?.unlocked.includes(selectedAccessory));
  const previewCandidate = previewChoice === undefined ? gifts?.equipped ?? null : previewChoice;
  const previewAccessory = previewCandidate && gifts?.unlocked.includes(previewCandidate) ? previewCandidate : null;
  const focusAccessory = selectedAccessory ?? COMPANION_WEARABLE_IDS[0];
  const ownedCount = COMPANION_WEARABLE_IDS.filter(accessory => gifts?.unlocked.includes(accessory)).length;
  useEffect(() => {
    if (!touched.current) setSelectedAccessory(collection?.gifts.equipped ?? null);
  }, [collection?.gifts.equipped]);
  useEffect(() => {
    if (!active) { pendingFocus.current = null; return; }
    const item = pendingFocus.current;
    if (!item) return;
    host.current?.querySelector<HTMLButtonElement>(`[data-accessory="${item}"]`)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [active, collection, selectedAccessory]);
  const select = (accessory: CompanionAccessoryId) => {
    touched.current = true; setSelectedAccessory(accessory);
    setPreviewChoice(gifts?.unlocked.includes(accessory) ? accessory : null);
  };
  const openGift = () => {
    const received = openCompanionGift();
    if (!received) return;
    touched.current = true; pendingFocus.current = received; setSelectedAccessory(received); setPreviewChoice(received);
    hapticSuccess(); playCompanionSound("gift", preferences); setAnnouncement(`${COMPANION_ACCESSORY_NAMES[received]} 선물을 받았어요.`);
  };
  const equip = (accessory: CompanionAccessoryId | null) => {
    if (!equipCompanionAccessory(accessory)) return;
    touched.current = true; pendingFocus.current = selectedAccessory ?? gifts?.equipped ?? null;
    // Removing an item clears the preview in this same update. Following the
    // old selected tile here kept showing an accessory that was already off.
    setPreviewChoice(accessory); setSelectedAccessory(accessory);
    hapticSuccess(); playCompanionSound(accessory ? "equip" : "unequip", preferences);
    setAnnouncement(accessory ? `${COMPANION_ACCESSORY_NAMES[accessory]} 장착` : "액세서리를 벗었어요.");
  };
  return active ? <div className="rhh-companion-wardrobe" ref={host}>
    <div className="rhh-collection-heading"><Shirt aria-hidden="true" size={23} /><h3>옷장</h3><span>{ownedCount}/{COMPANION_WEARABLE_IDS.length}</span></div>
    {gifts?.pending && <div className="rhh-gift-arrival"><CompanionCollectionArt kind="gift" /><strong>선물이 도착했어요</strong><button className="rhh-link" data-act="companion-gift-open" data-sfx="off" onClick={openGift} type="button">선물 열기</button></div>}
    <div className="rhh-collection-detail rhh-wardrobe-detail">
      <CompanionWardrobePreview accessory={previewAccessory} behaviors={collection?.behaviors ?? []} enabled={preferences.enabled} />
      <div aria-live="polite" className="rhh-wardrobe-detail-copy"><span className="rhh-wardrobe-status">{selectedAccessory === null ? "지금 모습" : owned ? gifts?.equipped === selectedAccessory ? "지금 입고 있어요" : "미리 입어 보기" : "아직 도착하지 않았어요"}</span><strong>{selectedAccessory === null ? "빅타민" : owned ? COMPANION_ACCESSORY_NAMES[selectedAccessory] : "???"}</strong>{owned && selectedAccessory && <button className="rhh-link rhh-companion-primary" data-act="companion-accessory-equip" data-act-opt={gifts?.equipped === selectedAccessory ? "off" : "on"} data-sfx="off" onClick={() => equip(gifts?.equipped === selectedAccessory ? null : selectedAccessory)} type="button">{gifts?.equipped === selectedAccessory && <Check aria-hidden="true" size={17} />}{gifts?.equipped === selectedAccessory ? "벗기기" : "장착하기"}</button>}</div>
    </div>
    <ul className="rhh-collection-grid rhh-accessory-grid">{COMPANION_WEARABLE_IDS.map((accessory, index) => {
      const found = gifts?.unlocked.includes(accessory) ?? false;
      return <li key={accessory}><button aria-label={found ? `${COMPANION_ACCESSORY_NAMES[accessory]} · ${gifts?.equipped === accessory ? "장착 중" : "받은 선물"}` : `??? · ${index + 1}`} aria-pressed={selectedAccessory === accessory} data-accessory={accessory} className="rhh-collection-tile" data-act="companion-accessory-select" data-found={found || undefined} onClick={() => select(accessory)} onKeyDown={event => onCollectionKey(event, index, COMPANION_WEARABLE_IDS.length, next => select(COMPANION_WEARABLE_IDS[next]))} tabIndex={focusAccessory === accessory ? 0 : -1} type="button"><CompanionCollectionArt kind="accessory" id={accessory} /><span>{found ? COMPANION_ACCESSORY_NAMES[accessory] : "???"}</span>{found && <span className="rhh-collection-state">{gifts?.equipped === accessory ? "장착 중" : "받은 선물"}</span>}</button></li>;
    })}</ul>
    {gifts?.equipped && gifts.equipped !== selectedAccessory && <p className="rhh-equipped-current">지금 장착: {COMPANION_ACCESSORY_NAMES[gifts.equipped]} <button className="rhh-link" data-act="companion-accessory-equip" data-act-opt="off" data-sfx="off" onClick={() => equip(null)} type="button">벗기기</button></p>}
    <span aria-live="polite" className="sr-only">{announcement}</span>
  </div> : null;
}
