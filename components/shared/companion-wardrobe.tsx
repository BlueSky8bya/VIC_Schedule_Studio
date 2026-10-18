"use client";

import dynamic from "next/dynamic";
import { Check, ChevronLeft, ChevronRight, Gift, Shirt, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CompanionCollectionArt } from "@/components/poster/viewer-companion/companion-collection-art";
import { companionCollectionPage, onCollectionKey, useCompanionCollectionLayout } from "./companion-collection-navigation";
import { acknowledgeCompanionCollection, getCompanionUnreadCounts, isCompanionCollectionUnread, equipCompanionAccessory, openCompanionGift, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_WEARABLE_IDS, COMPANION_ACCESSORY_NAMES, type CompanionAccessoryId } from "@/lib/ui/viewer-companion/gifts";
import { playCompanionSound } from "@/lib/ui/viewer-companion/companion-sound";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { hapticSuccess } from "@/lib/ui/haptics";
import { companionAccessoryCopy } from "@/lib/ui/viewer-companion/accessory-copy";
import { COMPANION_WARDROBE_PREFERENCE, emitCompanionSceneSignal, validCompanionWardrobePreference } from "@/lib/ui/viewer-companion/scene-signals";

const CompanionWardrobePreview = dynamic(() => import("./companion-wardrobe-preview").then(module => module.CompanionWardrobePreview));

/** Undefined follows what is really worn; null is an explicit bare preview.
 * Selecting a keepsake is a local try-on, never an implicit equipment write. */
export function CompanionWardrobe({ collection, preferences, active }: { collection: CompanionCollection | null; preferences: CompanionPreferences; active: boolean }) {
  const [selectedAccessory, setSelectedAccessory] = useState<CompanionAccessoryId | null>(collection?.gifts.equipped ?? null);
  const [previewChoice, setPreviewChoice] = useState<CompanionAccessoryId | null | undefined>(undefined), [announcement, setAnnouncement] = useState("");
  const [pageAnchor, setPageAnchor] = useState(Math.max(0, COMPANION_WEARABLE_IDS.indexOf(collection?.gifts.equipped ?? COMPANION_WEARABLE_IDS[0])));
  const host = useRef<HTMLDivElement>(null), grid = useRef<HTMLUListElement>(null), touched = useRef(false), pendingFocus = useRef<CompanionAccessoryId | null>(null);
  const unreadDescription = useId(), unread = getCompanionUnreadCounts(collection);
  const layout = useCompanionCollectionLayout(grid, active, "wardrobe"), page = companionCollectionPage(pageAnchor, COMPANION_WEARABLE_IDS.length, layout.size);
  const gifts = collection?.gifts, owned = selectedAccessory !== null && Boolean(gifts?.unlocked.includes(selectedAccessory));
  const previewCandidate = previewChoice === undefined ? gifts?.equipped ?? null : previewChoice;
  const previewAccessory = previewCandidate && gifts?.unlocked.includes(previewCandidate) ? previewCandidate : null;
  const focusAccessory = selectedAccessory ?? COMPANION_WEARABLE_IDS[page.offset];
  const ownedCount = COMPANION_WEARABLE_IDS.filter(accessory => gifts?.unlocked.includes(accessory)).length;
  const copy = selectedAccessory && owned ? companionAccessoryCopy(selectedAccessory) : undefined;
  useEffect(() => {
    if (!active || !preferences.learnFromYou || !gifts) return;
    const receive = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail;
      if (touched.current || !validCompanionWardrobePreference(id) || !gifts.unlocked.includes(id)) return;
      setSelectedAccessory(id); setPreviewChoice(id); setPageAnchor(COMPANION_WEARABLE_IDS.indexOf(id));
    };
    window.addEventListener(COMPANION_WARDROBE_PREFERENCE, receive);
    emitCompanionSceneSignal({ kind: "wardrobe-opened" });
    return () => window.removeEventListener(COMPANION_WARDROBE_PREFERENCE, receive);
  }, [active, preferences.learnFromYou, gifts]);
  useEffect(() => {
    if (!touched.current) {
      setSelectedAccessory(collection?.gifts.equipped ?? null);
      setPageAnchor(Math.max(0, COMPANION_WEARABLE_IDS.indexOf(collection?.gifts.equipped ?? COMPANION_WEARABLE_IDS[0])));
    }
  }, [collection?.gifts.equipped]);
  useEffect(() => {
    if (!active) { pendingFocus.current = null; return; }
    const item = pendingFocus.current;
    if (!item) return;
    host.current?.querySelector<HTMLButtonElement>(`[data-accessory="${item}"]`)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [active, collection, selectedAccessory, page.offset]);
  const select = (accessory: CompanionAccessoryId, inspect = false) => {
    const acknowledged = inspect && isCompanionCollectionUnread(collection, "accessory", accessory) && acknowledgeCompanionCollection("accessory", accessory);
    touched.current = true; setSelectedAccessory(accessory);
    setPageAnchor(COMPANION_WEARABLE_IDS.indexOf(accessory));
    setPreviewChoice(gifts?.unlocked.includes(accessory) ? accessory : null);
    return acknowledged;
  };
  const openGift = () => {
    const received = openCompanionGift();
    if (!received) return;
    touched.current = true; pendingFocus.current = received; setSelectedAccessory(received); setPreviewChoice(received);
    setPageAnchor(COMPANION_WEARABLE_IDS.indexOf(received));
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
  const selectIndex = (index: number, focus = false, inspect = false) => { const accessory = COMPANION_WEARABLE_IDS[index]; if (focus) pendingFocus.current = accessory; return select(accessory, inspect); };
  return active ? <div className="rhh-companion-wardrobe rhh-collection-book" ref={host}>
    <span className="sr-only" id={unreadDescription}>새로 발견한 항목</span>
    <div className="rhh-collection-heading"><Shirt aria-hidden="true" size={23} /><h3>옷장</h3>{unread.accessories > 0 && <span aria-label="새로 발견한 항목" className="rhh-collection-unread" data-unread="" role="img">!</span>}<span>{ownedCount}/{COMPANION_WEARABLE_IDS.length}</span></div>
    {gifts?.pending && <div className="rhh-gift-arrival"><CompanionCollectionArt kind="gift" /><strong>선물이 도착했어요</strong><button className="rhh-link" data-act="companion-gift-open" data-sfx="off" onClick={openGift} type="button">선물 열기</button></div>}
    <div className="rhh-collection-detail rhh-wardrobe-detail">
      <div className="rhh-wardrobe-fitting-stage"><CompanionWardrobePreview accessory={previewAccessory} behaviors={collection?.behaviors ?? []} enabled={preferences.enabled} />
        {gifts?.equipped && gifts.equipped !== selectedAccessory && <p className="rhh-equipped-current"><button aria-label={`${COMPANION_ACCESSORY_NAMES[gifts.equipped]} 벗기기`} className="rhh-link" data-act="companion-accessory-equip" data-act-opt="off" data-sfx="off" onClick={() => equip(null)} title={`${COMPANION_ACCESSORY_NAMES[gifts.equipped]} 벗기기`} type="button"><Shirt aria-hidden="true" size={18} /><X aria-hidden="true" className="rhh-wardrobe-remove-mark" size={10} /></button></p>}
      </div>
      <div aria-live="polite" className="rhh-wardrobe-detail-copy"><span className="rhh-wardrobe-status">{selectedAccessory === null ? "지금 모습" : owned ? gifts?.equipped === selectedAccessory ? "장착 중" : "미리 입어 보기" : "아직 받지 못한 선물"}</span>
        <strong>{selectedAccessory === null ? "빅타민" : owned ? COMPANION_ACCESSORY_NAMES[selectedAccessory] : "???"}</strong>
        <p className="rhh-wardrobe-description">{selectedAccessory === null ? "두 귀와 폭신한 폼폼." : copy?.description ?? "어떤 소품이 들어 있을까?"}</p>
        <span className="rhh-wardrobe-kind">{copy ? <><Shirt aria-hidden="true" size={15} />{copy.location}</> : selectedAccessory ? <><Gift aria-hidden="true" size={15} />미발견</> : <><Shirt aria-hidden="true" size={15} />기본 모습</>}</span>
        {owned && selectedAccessory && <button className="rhh-link rhh-companion-primary" data-act="companion-accessory-equip" data-act-opt={gifts?.equipped === selectedAccessory ? "off" : "on"} data-sfx="off" onClick={() => equip(gifts?.equipped === selectedAccessory ? null : selectedAccessory)} type="button">{gifts?.equipped === selectedAccessory && <Check aria-hidden="true" size={17} />}{gifts?.equipped === selectedAccessory ? "벗기기" : "장착하기"}</button>}
      </div>
    </div>
    <ul aria-label="옷장 소품" className="rhh-collection-grid rhh-accessory-grid" ref={grid} style={{ "--collection-columns": layout.columns, "--collection-rows": layout.rows } as CSSProperties}>{COMPANION_WEARABLE_IDS.slice(page.offset, page.end).map((accessory, localIndex) => {
      const index = page.offset + localIndex;
      const found = gifts?.unlocked.includes(accessory) ?? false, unreadItem = isCompanionCollectionUnread(collection, "accessory", accessory);
      return <li key={accessory}><button aria-label={found ? `${COMPANION_ACCESSORY_NAMES[accessory]} · ${gifts?.equipped === accessory ? "장착 중" : "받은 선물"}` : `??? · ${index + 1}`} aria-describedby={unreadItem ? unreadDescription : undefined} data-unread={unreadItem || undefined} aria-pressed={selectedAccessory === accessory} data-accessory={accessory} className="rhh-collection-tile" data-act="companion-accessory-select" data-found={found || undefined} onClick={() => select(accessory, true)} onKeyDown={event => onCollectionKey(event, index, COMPANION_WEARABLE_IDS.length, next => selectIndex(next, true, true), page.offset)} tabIndex={focusAccessory === accessory ? 0 : -1} type="button">{unreadItem && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}<CompanionCollectionArt kind="accessory" id={accessory} /><span>{found ? COMPANION_ACCESSORY_NAMES[accessory] : "???"}</span>{found && <span className="rhh-collection-state">{gifts?.equipped === accessory ? "장착 중" : "받은 선물"}</span>}</button></li>;
    })}</ul>
    <nav aria-label="옷장 페이지" className="rhh-collection-pages"><button aria-label="이전 소품" className="rhh-link" data-act="companion-collection-page" data-act-opt="prev" disabled={page.page === 0} onClick={event => selectIndex((page.page - 1) * layout.size, event.detail === 0)} type="button"><ChevronLeft aria-hidden="true" size={17} />이전</button><span aria-live="polite">{page.offset + 1}–{page.end} <span>/ {COMPANION_WEARABLE_IDS.length}</span></span><button aria-label="다음 소품" className="rhh-link" data-act="companion-collection-page" data-act-opt="next" disabled={page.page + 1 >= page.count} onClick={event => selectIndex((page.page + 1) * layout.size, event.detail === 0)} type="button">다음<ChevronRight aria-hidden="true" size={17} /></button></nav>
    <span aria-live="polite" className="sr-only">{announcement}</span>
  </div> : null;
}
