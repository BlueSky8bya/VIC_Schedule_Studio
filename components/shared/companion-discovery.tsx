"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CompanionCollectionArt } from "@/components/poster/viewer-companion/companion-collection-art";
import { companionCollectionPage, onCollectionKey, useCompanionCollectionLayout } from "./companion-collection-navigation";
import { COMPANION_BEHAVIOR_HINTS, COMPANION_BEHAVIOR_IDS, COMPANION_BEHAVIOR_NAMES, acknowledgeCompanionCollection, getCompanionUnreadCounts, isCompanionCollectionUnread, getCompanionRecentFood, subscribeCompanionConsumedFood, type CompanionCollection, type CompanionConsumedFood } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_HINTS, COMPANION_SITUATION_IDS, COMPANION_SITUATION_NAMES } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_FOOD_FACTS } from "@/lib/ui/viewer-companion/food-facts";
import { companionFoodChance, COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY, COMPANION_FOOD_RARITY_NAMES, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";

const memories = [
  ...COMPANION_BEHAVIOR_IDS.map(id => ({ id, kind: "behavior" as const, name: COMPANION_BEHAVIOR_NAMES[id], hint: COMPANION_BEHAVIOR_HINTS[id] })),
  ...COMPANION_SITUATION_IDS.map(id => ({ id, kind: "moment" as const, name: COMPANION_SITUATION_NAMES[id], hint: COMPANION_SITUATION_HINTS[id] })),
];

export function CompanionDiscovery({ collection, active }: { collection: CompanionCollection | null; active: boolean }) {
  const [category, setCategory] = useState<"food" | "behavior">("food");
  const [selectedFood, setSelectedFood] = useState<CompanionFoodKind>(COMPANION_FOOD_KINDS[0]), [selectedMemoryIndex, setSelectedMemoryIndex] = useState(0);
  const [recent, setRecent] = useState<CompanionConsumedFood | null>(null), [cue, setCue] = useState(false);
  const host = useRef<HTMLDivElement>(null), grid = useRef<HTMLUListElement>(null), pendingFocus = useRef<number | null>(null), recentSerial = useRef(0);
  const unreadDescription = useId(), unread = getCompanionUnreadCounts(collection);
  const layout = useCompanionCollectionLayout(grid, active);
  const selectedFoodIndex = COMPANION_FOOD_KINDS.indexOf(selectedFood);
  const foodPage = companionCollectionPage(selectedFoodIndex, COMPANION_FOOD_KINDS.length, layout.size);
  const memoryPage = companionCollectionPage(selectedMemoryIndex, memories.length, layout.size);
  const page = category === "food" ? foodPage : memoryPage;
  const selectedMemory = memories[selectedMemoryIndex];
  const memoryFound = (memory: typeof memories[number]) => ((memory.kind === "moment" ? collection?.situations : collection?.behaviors) as readonly string[] | undefined)?.includes(memory.id) ?? false;
  const selectIndex = (index: number, focus = false, inspect = false) => {
    if (focus) pendingFocus.current = index;
    if (category === "food") { setSelectedFood(COMPANION_FOOD_KINDS[index]); return inspect && isCompanionCollectionUnread(collection, "food", COMPANION_FOOD_KINDS[index]) && acknowledgeCompanionCollection("food", COMPANION_FOOD_KINDS[index]); }
    setSelectedMemoryIndex(index); return inspect && isCompanionCollectionUnread(collection, memories[index].kind, memories[index].id) && acknowledgeCompanionCollection(memories[index].kind, memories[index].id);
  };
  useEffect(() => {
    if (!active) return;
    const consumed = (value: CompanionConsumedFood) => {
      if (recentSerial.current === value.serial) return;
      recentSerial.current = value.serial; setRecent(value); setSelectedFood(value.kind); setCategory("food"); setCue(value.newDiscovery);
    };
    const value = getCompanionRecentFood(); if (value) consumed(value);
    return subscribeCompanionConsumedFood(consumed);
  }, [active]);
  useEffect(() => {
    if (!cue || !active) return;
    const timer = window.setTimeout(() => setCue(false), 1500);
    return () => window.clearTimeout(timer);
  }, [cue, recent?.serial, active]);
  useEffect(() => {
    if (!active) { pendingFocus.current = null; return; }
    const index = pendingFocus.current;
    if (index === null) return;
    host.current?.querySelector<HTMLButtonElement>('[data-collection-index="' + index + '"]')?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [active, category, selectedFood, selectedMemoryIndex, page.offset, layout.size]);
  const foundFood = collection?.foods.includes(selectedFood) ?? false;
  return active ? <div className="rhh-companion-discovery rhh-collection-book" ref={host} data-discovery-cue={cue || undefined}>
    <span className="sr-only" id={unreadDescription}>새로 발견한 항목</span>
    <div aria-label="도감 종류" className="rhh-collection-switch" role="group"><button aria-describedby={unread.foods ? unreadDescription : undefined} data-unread={unread.foods > 0 || undefined} aria-pressed={category === "food"} data-act="companion-collection-category" data-act-opt="food" onClick={() => setCategory("food")} type="button">냠냠 도감 {unread.foods > 0 && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}<span>{collection?.foods.length ?? 0}/{COMPANION_FOOD_KINDS.length}</span></button><button aria-describedby={unread.memories ? unreadDescription : undefined} data-unread={unread.memories > 0 || undefined} aria-pressed={category !== "food"} data-act="companion-collection-category" data-act-opt="behavior" onClick={() => setCategory("behavior")} type="button">추억 도감 {unread.memories > 0 && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}<span>{(collection?.behaviors.length ?? 0) + (collection?.situations.length ?? 0)}/{memories.length}</span></button></div>
    {category === "food" ? <div aria-live="polite" className="rhh-collection-detail rhh-food-detail" data-recent={foundFood && selectedFood === recent?.kind || undefined}>
      <div className="rhh-collection-detail-title"><strong>{foundFood ? COMPANION_FOOD_NAMES[selectedFood] : "???"}</strong>{foundFood && <><span className="rhh-collection-rarity">{COMPANION_FOOD_RARITY_NAMES[COMPANION_FOOD_RARITY[selectedFood]]}</span><span className="rhh-collection-chance">기본 등장 {(companionFoodChance(selectedFood) * 100).toFixed(1)}%</span></>}{foundFood && selectedFood === recent?.kind && <span aria-label="방금 맛본 간식" className="rhh-collection-recent" role="img"><CompanionCollectionArt kind="food-stamp" id={selectedFood} /></span>}</div>
      <p className="rhh-collection-fact">{foundFood ? COMPANION_FOOD_FACTS[selectedFood] : "아직 맛보기 전"}</p>
    </div> : <div aria-live="polite" className="rhh-collection-detail"><strong>{memoryFound(selectedMemory) ? selectedMemory.name : "???"}</strong><p>{memoryFound(selectedMemory) ? selectedMemory.hint : "아직 발견하지 못했어요."}</p></div>}
    <ul aria-label={category === "food" ? "냠냠 도감" : "추억 도감"} className={"rhh-collection-grid " + (category === "food" ? "rhh-food-grid" : "rhh-behavior-grid")} ref={grid} style={{ "--collection-columns": layout.columns, "--collection-rows": layout.rows } as CSSProperties}>
      {category === "food" ? COMPANION_FOOD_KINDS.slice(foodPage.offset, foodPage.end).map((food, localIndex) => {
        const index = foodPage.offset + localIndex, found = collection?.foods.includes(food) ?? false, unreadItem = isCompanionCollectionUnread(collection, "food", food);
        return <li key={food}><button aria-label={found ? COMPANION_FOOD_NAMES[food] + " · 맛봤어요" : "??? · " + (index + 1)} aria-describedby={unreadItem ? unreadDescription : undefined} data-unread={unreadItem || undefined} aria-pressed={selectedFood === food} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt="food" data-food-index={index} data-collection-index={index} data-found={found || undefined} data-recent={found && recent?.kind === food || undefined} onClick={() => { setSelectedFood(food); if (unreadItem) acknowledgeCompanionCollection("food", food); }} onKeyDown={event => onCollectionKey(event, index, COMPANION_FOOD_KINDS.length, next => selectIndex(next, true, true), foodPage.offset)} tabIndex={selectedFood === food ? 0 : -1} type="button">{unreadItem && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}<CompanionCollectionArt kind="food" id={food} /><span>{found ? COMPANION_FOOD_NAMES[food] : "???"}</span>{found && <><span className="rhh-collection-rarity">{COMPANION_FOOD_RARITY_NAMES[COMPANION_FOOD_RARITY[food]]}</span><CompanionCollectionArt className="rhh-collection-stamp" kind="food-stamp" id={food} /></>}</button></li>;
      }) : memories.slice(memoryPage.offset, memoryPage.end).map((memory, localIndex) => {
        const index = memoryPage.offset + localIndex, found = memoryFound(memory), unreadItem = isCompanionCollectionUnread(collection, memory.kind, memory.id);
        return <li key={memory.kind + ":" + memory.id}><button aria-label={found ? memory.name + " · 만났어요" : "??? · " + (index + 1)} aria-describedby={unreadItem ? unreadDescription : undefined} data-unread={unreadItem || undefined} aria-pressed={selectedMemoryIndex === index} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt={memory.kind} data-collection-index={index} data-found={found || undefined} onClick={() => { setSelectedMemoryIndex(index); if (unreadItem) acknowledgeCompanionCollection(memory.kind, memory.id); }} onKeyDown={event => onCollectionKey(event, index, memories.length, next => selectIndex(next, true, true), memoryPage.offset, next => memories[next].kind)} tabIndex={selectedMemoryIndex === index ? 0 : -1} type="button">{unreadItem && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}<CompanionCollectionArt kind={memory.kind === "moment" ? "situation-stamp" : "behavior-stamp"} id={memory.id} /><span>{found ? memory.name : "???"}</span></button></li>;
      })}
    </ul>
    <nav aria-label={category === "food" ? "냠냠 도감 페이지" : "추억 도감 페이지"} className="rhh-collection-pages"><button aria-label={category === "food" ? "이전 간식" : "이전 추억"} className="rhh-link" data-act="companion-collection-page" data-act-opt="prev" disabled={page.page === 0} onClick={event => selectIndex((page.page - 1) * layout.size, event.detail === 0)} type="button"><ChevronLeft aria-hidden="true" size={17} />이전</button><span aria-live="polite">{page.offset + 1}–{page.end} <span>/ {category === "food" ? COMPANION_FOOD_KINDS.length : memories.length}</span></span><button aria-label={category === "food" ? "다음 간식" : "다음 추억"} className="rhh-link" data-act="companion-collection-page" data-act-opt="next" disabled={page.page + 1 >= page.count} onClick={event => selectIndex((page.page + 1) * layout.size, event.detail === 0)} type="button">다음<ChevronRight aria-hidden="true" size={17} /></button></nav>
  </div> : null;
}
