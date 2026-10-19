"use client";

import { Check, HelpCircle, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { logActivity } from "@/lib/activity/client";
import { companionToyUnread, type CompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { COMPANION_TOY_KINDS, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { CompanionCollectionPager } from "./companion-collection-pager";
import { CompanionToyDiscovery } from "./companion-toy-discovery";
import { CompanionCollectionArt } from "@/components/poster/viewer-companion/companion-collection-art";
import { companionCollectionPage, onCollectionKey, useCompanionCollectionLayout } from "./companion-collection-navigation";
import { COMPANION_BEHAVIOR_HINTS, COMPANION_BEHAVIOR_IDS, COMPANION_BEHAVIOR_NAMES, acknowledgeCompanionCollection, getCompanionUnreadCounts, isCompanionCollectionUnread, getCompanionRecentFood, subscribeCompanionConsumedFood, type CompanionCollection, type CompanionConsumedFood } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_HINTS, COMPANION_SITUATION_IDS, COMPANION_SITUATION_NAMES } from "@/lib/ui/viewer-companion/moments";
import { emitCompanionSceneSignal } from "@/lib/ui/viewer-companion/scene-signals";
import { COMPANION_FOOD_FACTS } from "@/lib/ui/viewer-companion/food-facts";
import { companionFoodChance, COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY, COMPANION_FOOD_RARITY_NAMES, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";

const memories = [
  ...COMPANION_BEHAVIOR_IDS.map(id => ({ id, kind: "behavior" as const, name: COMPANION_BEHAVIOR_NAMES[id], hint: COMPANION_BEHAVIOR_HINTS[id] })),
  ...COMPANION_SITUATION_IDS.map(id => ({ id, kind: "moment" as const, name: COMPANION_SITUATION_NAMES[id], hint: COMPANION_SITUATION_HINTS[id] })),
];

export function CompanionDiscovery({ collection, active, tastes = null }: { collection: CompanionCollection | null; active: boolean; tastes?: CompanionTastes | null }) {
  const [category, setCategory] = useState<"food" | "toy" | "behavior">("food");
  const [selectedFood, setSelectedFood] = useState<CompanionFoodKind>(COMPANION_FOOD_KINDS[0]), [selectedMemoryIndex, setSelectedMemoryIndex] = useState(0);
  const [recent, setRecent] = useState<CompanionConsumedFood | null>(null), [cue, setCue] = useState(false);
  const [selectedToy, setSelectedToy] = useState<CompanionToyKind>(() => tastes?.toys.find(kind => !tastes.seen.includes(kind)) ?? COMPANION_TOY_KINDS[0]);
  const knownToys = useRef(tastes?.toys ?? []);
  const host = useRef<HTMLDivElement>(null), grid = useRef<HTMLUListElement>(null), pendingFocus = useRef<number | null>(null), recentSerial = useRef(0);
  const unreadDescription = useId(), unread = getCompanionUnreadCounts(collection);
  const layout = useCompanionCollectionLayout(grid, active && category !== "toy", category === "food" ? "default" : "memory");
  const selectedFoodIndex = COMPANION_FOOD_KINDS.indexOf(selectedFood);
  const foodPage = companionCollectionPage(selectedFoodIndex, COMPANION_FOOD_KINDS.length, layout.size);
  const memoryPage = companionCollectionPage(selectedMemoryIndex, memories.length, layout.size);
  const page = category === "food" ? foodPage : memoryPage;
  const selectedMemory = memories[selectedMemoryIndex];
  const memoryFound = (memory: typeof memories[number]) => ((memory.kind === "moment" ? collection?.situations : collection?.behaviors) as readonly string[] | undefined)?.includes(memory.id) ?? false;
  const unreadAt = (index: number) => category === "food"
    ? isCompanionCollectionUnread(collection, "food", COMPANION_FOOD_KINDS[index])
    : isCompanionCollectionUnread(collection, memories[index].kind, memories[index].id);
  const selectIndex = (index: number, focus = false, inspect = false) => {
    if (focus) pendingFocus.current = index;
    if (category === "food") { setSelectedFood(COMPANION_FOOD_KINDS[index]); return inspect && isCompanionCollectionUnread(collection, "food", COMPANION_FOOD_KINDS[index]) && acknowledgeCompanionCollection("food", COMPANION_FOOD_KINDS[index]); }
    setSelectedMemoryIndex(index);
    if (inspect && memoryFound(memories[index])) {
      const memory = memories[index];
      emitCompanionSceneSignal(memory.kind === "moment" ? { kind: "memory-inspected", situation: memory.id } : { kind: "memory-inspected", behavior: memory.id });
    }
    return inspect && isCompanionCollectionUnread(collection, memories[index].kind, memories[index].id) && acknowledgeCompanionCollection(memories[index].kind, memories[index].id);
  };
  useEffect(() => {
    const current = tastes?.toys ?? [], added = current.find(kind => !knownToys.current.includes(kind));
    knownToys.current = current;
    if (added) setSelectedToy(added);
  }, [tastes?.toys]);
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
  }, [active, category, selectedFood, selectedMemoryIndex, page.offset, layout.size, collection]);
  const foundFood = collection?.foods.includes(selectedFood) ?? false;
  const categories = [{ key: "food", name: "냠냠 도감", count: collection?.foods.length ?? 0, total: COMPANION_FOOD_KINDS.length, unread: unread.foods }, { key: "toy", name: "장난감 도감", count: tastes?.toys.length ?? 0, total: COMPANION_TOY_KINDS.length, unread: companionToyUnread(tastes) }, { key: "behavior", name: "추억 도감", count: (collection?.behaviors.length ?? 0) + (collection?.situations.length ?? 0), total: memories.length, unread: unread.memories }] as const;
  const categoryKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = categories.findIndex(item => item.key === category), next = event.key === "Home" ? 0 : event.key === "End" ? 2 : event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : -1;
    if (next < 0) return; event.preventDefault(); event.stopPropagation();
    if (next !== index) { setCategory(categories[next].key); logActivity("ui.click", { target: `companion-collection-category#${categories[next].key}` }); }
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };
  const categorySwitch = <div aria-label="도감 종류" className="rhh-collection-switch" role="group">{categories.map(item => <button aria-describedby={item.unread ? unreadDescription : undefined} data-unread={item.unread > 0 || undefined} aria-pressed={category === item.key} data-act="companion-collection-category" data-act-opt={item.key} key={item.key} onClick={() => setCategory(item.key)} onKeyDown={categoryKey} type="button">{item.name}{item.unread > 0 && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}<span>{item.count}/{item.total}</span></button>)}</div>;
  if (active && category === "toy") return <div className="rhh-companion-discovery rhh-collection-book"><span className="sr-only" id={unreadDescription}>새로 발견한 항목</span>{categorySwitch}<CompanionToyDiscovery active tastes={tastes} selectedKind={selectedToy} onSelect={setSelectedToy} /></div>;
  return active ? <div className="rhh-companion-discovery rhh-collection-book" ref={host} data-discovery-cue={cue || undefined}>
    <span className="sr-only" id={unreadDescription}>새로 발견한 항목</span>
    {categorySwitch}
    {category === "food" ? <div aria-live="polite" className="rhh-collection-detail rhh-food-detail rhh-collection-gallery-detail" data-found={foundFood || undefined} data-recent={foundFood && selectedFood === recent?.kind || undefined}>
      <div aria-hidden="true" className="rhh-collection-art-stage" key={selectedFood}>{foundFood ? <CompanionCollectionArt kind="food" id={selectedFood} /> : <HelpCircle className="rhh-collection-unknown" />}</div>
      <div className="rhh-collection-detail-copy"><div className="rhh-collection-detail-title"><strong>{foundFood ? COMPANION_FOOD_NAMES[selectedFood] : "???"}</strong>{foundFood && <span className="rhh-collection-rarity">{COMPANION_FOOD_RARITY_NAMES[COMPANION_FOOD_RARITY[selectedFood]]}</span>}</div>
        <p className="rhh-collection-fact">{foundFood ? COMPANION_FOOD_FACTS[selectedFood] : "아직 맛보기 전"}</p>
        <div className="rhh-collection-detail-meta">{foundFood && <><span className="rhh-collection-chance">기본 등장 {(companionFoodChance(selectedFood) * 100).toFixed(1)}%</span>{selectedFood === recent?.kind && <span className="rhh-collection-recent"><Check aria-hidden="true" size={14} />방금 맛봤어요</span>}</>}</div>
      </div>
    </div> : <div aria-live="polite" className="rhh-collection-detail rhh-memory-detail rhh-collection-gallery-detail" data-found={memoryFound(selectedMemory) || undefined}>
      <div aria-hidden="true" className="rhh-collection-art-stage" key={selectedMemory.kind + selectedMemory.id}>{memoryFound(selectedMemory) ? <CompanionCollectionArt kind={selectedMemory.kind === "moment" ? "situation-stamp" : "behavior-stamp"} id={selectedMemory.id} /> : <HelpCircle className="rhh-collection-unknown" />}</div>
      <div className="rhh-collection-detail-copy"><div className="rhh-collection-detail-title"><strong>{memoryFound(selectedMemory) ? selectedMemory.name : "???"}</strong></div><p>{memoryFound(selectedMemory) ? selectedMemory.hint : "아직 발견하지 못했어요."}</p>{memoryFound(selectedMemory) && <span className="rhh-collection-keepsake"><Sparkles aria-hidden="true" size={14} />{selectedMemory.kind === "moment" ? "특별한 순간" : "재롱"}</span>}</div>
    </div>}
    <ul aria-label={category === "food" ? "냠냠 도감" : "추억 도감"} className={"rhh-collection-grid " + (category === "food" ? "rhh-food-grid" : "rhh-behavior-grid")} ref={grid} style={{ "--collection-columns": layout.columns, "--collection-rows": layout.rows } as CSSProperties}>
      {category === "food" ? COMPANION_FOOD_KINDS.slice(foodPage.offset, foodPage.end).map((food, localIndex) => {
        const index = foodPage.offset + localIndex, found = collection?.foods.includes(food) ?? false, unreadItem = isCompanionCollectionUnread(collection, "food", food);
        return <li key={food}><button aria-label={found ? COMPANION_FOOD_NAMES[food] + " · 맛봤어요" : "??? · " + (index + 1)} aria-describedby={unreadItem ? unreadDescription : undefined} data-unread={unreadItem || undefined} aria-pressed={selectedFood === food} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt="food" data-food-index={index} data-collection-index={index} data-found={found || undefined} data-recent={found && recent?.kind === food || undefined} onClick={() => { setSelectedFood(food); if (unreadItem) acknowledgeCompanionCollection("food", food); }} onKeyDown={event => onCollectionKey(event, index, COMPANION_FOOD_KINDS.length, next => selectIndex(next, true, true), foodPage.offset)} tabIndex={selectedFood === food ? 0 : -1} type="button">{unreadItem && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}{found ? <CompanionCollectionArt kind="food" id={food} /> : <HelpCircle aria-hidden="true" className="rhh-collection-unknown" />}<span>{found ? COMPANION_FOOD_NAMES[food] : "???"}</span><span aria-hidden={!found || undefined} className="rhh-collection-rarity" data-empty={!found || undefined}>{found ? COMPANION_FOOD_RARITY_NAMES[COMPANION_FOOD_RARITY[food]] : "빈칸"}</span></button></li>;
      }) : memories.slice(memoryPage.offset, memoryPage.end).map((memory, localIndex) => {
        const index = memoryPage.offset + localIndex, found = memoryFound(memory), unreadItem = isCompanionCollectionUnread(collection, memory.kind, memory.id);
        return <li key={memory.kind + ":" + memory.id}><button aria-label={found ? memory.name + " · 만났어요" : "??? · " + (index + 1)} aria-describedby={unreadItem ? unreadDescription : undefined} data-unread={unreadItem || undefined} aria-pressed={selectedMemoryIndex === index} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt={memory.kind} data-collection-index={index} data-found={found || undefined} onClick={() => selectIndex(index, false, true)} onKeyDown={event => onCollectionKey(event, index, memories.length, next => selectIndex(next, true, true), memoryPage.offset, next => memories[next].kind)} tabIndex={selectedMemoryIndex === index ? 0 : -1} type="button">{unreadItem && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}{found ? <CompanionCollectionArt kind={memory.kind === "moment" ? "situation-stamp" : "behavior-stamp"} id={memory.id} /> : <HelpCircle aria-hidden="true" className="rhh-collection-unknown" />}<span>{found ? memory.name : "???"}</span></button></li>;
      })}
    </ul>
    <CompanionCollectionPager label={category === "food" ? "냠냠 도감 페이지" : "추억 도감 페이지"} previousLabel="이전 페이지" nextLabel="다음 페이지" page={page} size={layout.size} length={category === "food" ? COMPANION_FOOD_KINDS.length : memories.length} selected={category === "food" ? selectedFoodIndex : selectedMemoryIndex} unread={unreadAt} select={selectIndex} categoryAt={index => category === "food" ? "food" : memories[index].kind} />
  </div> : null;
}
