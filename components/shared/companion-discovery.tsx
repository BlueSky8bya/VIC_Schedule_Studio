"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CompanionCollectionArt } from "@/components/poster/viewer-companion/companion-collection-art";
import { onCollectionKey } from "./companion-collection-navigation";
import { COMPANION_BEHAVIOR_HINTS, COMPANION_BEHAVIOR_IDS, COMPANION_BEHAVIOR_NAMES, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_HINTS, COMPANION_SITUATION_IDS, COMPANION_SITUATION_NAMES } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_FOOD_FACTS } from "@/lib/ui/viewer-companion/food-facts";
import { companionFoodChance, COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY, COMPANION_FOOD_RARITY_NAMES, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";

const FOOD_PAGE_SIZE = 24;
const memories = [
  ...COMPANION_BEHAVIOR_IDS.map(id => ({ id, kind: "behavior" as const, name: COMPANION_BEHAVIOR_NAMES[id], hint: COMPANION_BEHAVIOR_HINTS[id] })),
  ...COMPANION_SITUATION_IDS.map(id => ({ id, kind: "moment" as const, name: COMPANION_SITUATION_NAMES[id], hint: COMPANION_SITUATION_HINTS[id] })),
];

export function CompanionDiscovery({ collection, active }: { collection: CompanionCollection | null; active: boolean }) {
  const [category, setCategory] = useState<"food" | "behavior">("food");
  const [selectedFood, setSelectedFood] = useState<CompanionFoodKind>(COMPANION_FOOD_KINDS[0]), [selectedMemoryIndex, setSelectedMemoryIndex] = useState(0), [foodPage, setFoodPage] = useState(0);
  const host = useRef<HTMLDivElement>(null), pendingFoodFocus = useRef<number | null>(null);
  useEffect(() => {
    if (!active || category !== "food") { pendingFoodFocus.current = null; return; }
    const index = pendingFoodFocus.current;
    if (index === null) return;
    host.current?.querySelector<HTMLButtonElement>(`[data-food-index="${index}"]`)?.focus();
    pendingFoodFocus.current = null;
  }, [active, category, selectedFood, foodPage]);
  const selectedMemory = memories[selectedMemoryIndex];
  const memoryFound = (memory: typeof memories[number]) => ((memory.kind === "moment" ? collection?.situations : collection?.behaviors) as readonly string[] | undefined)?.includes(memory.id) ?? false;
  const foodPageCount = Math.ceil(COMPANION_FOOD_KINDS.length / FOOD_PAGE_SIZE), foodOffset = foodPage * FOOD_PAGE_SIZE;
  const visibleFoods = COMPANION_FOOD_KINDS.slice(foodOffset, foodOffset + FOOD_PAGE_SIZE);
  const selectFoodIndex = (index: number, focus = false) => { if (focus) pendingFoodFocus.current = index; setSelectedFood(COMPANION_FOOD_KINDS[index]); setFoodPage(Math.floor(index / FOOD_PAGE_SIZE)); };
  return active ? <div className="rhh-companion-discovery" ref={host}>
        <div className="rhh-collection-heading"><h3>도감</h3></div>
        {!collection?.foods.length && !collection?.behaviors.length && !collection?.situations.length && <div className="rhh-collection-empty"><CompanionCollectionArt id="discovery-seal" kind="gift" /><p>첫 발견을 기다려요.</p></div>}
        <div aria-label="도감 종류" className="rhh-collection-switch" role="group"><button aria-pressed={category === "food"} data-act="companion-collection-category" data-act-opt="food" onClick={() => setCategory("food")} type="button">냠냠 도감 <span>{collection?.foods.length ?? 0}/{COMPANION_FOOD_KINDS.length}</span></button><button aria-pressed={category !== "food"} data-act="companion-collection-category" data-act-opt="behavior" onClick={() => setCategory("behavior")} type="button">추억 도감 <span>{(collection?.behaviors.length ?? 0) + (collection?.situations.length ?? 0)}/{COMPANION_BEHAVIOR_IDS.length + COMPANION_SITUATION_IDS.length}</span></button></div>
        {category === "food" ? <>
          <div aria-live="polite" className="rhh-collection-detail">{collection?.foods.includes(selectedFood) ? <><strong>{COMPANION_FOOD_NAMES[selectedFood]}</strong><span className="rhh-collection-rarity">{COMPANION_FOOD_RARITY_NAMES[COMPANION_FOOD_RARITY[selectedFood]]}</span><p className="rhh-collection-chance">기본 등장 {(companionFoodChance(selectedFood) * 100).toFixed(1)}%</p><p className="rhh-collection-fact">{COMPANION_FOOD_FACTS[selectedFood]}</p></> : <><strong>???</strong><p>아직 발견하지 못했어요.</p></>}</div>
          <nav aria-label="냠냠 도감 페이지" className="rhh-collection-pages"><button aria-label="이전 간식" className="rhh-link" data-act="companion-collection-page" data-act-opt="prev" disabled={foodPage === 0} onClick={event => selectFoodIndex((foodPage - 1) * FOOD_PAGE_SIZE, event.detail === 0)} type="button"><ChevronLeft aria-hidden="true" size={17} />이전</button><span aria-live="polite">{foodOffset + 1}–{Math.min(foodOffset + FOOD_PAGE_SIZE, COMPANION_FOOD_KINDS.length)} <span>/ {COMPANION_FOOD_KINDS.length}</span></span><button aria-label="다음 간식" className="rhh-link" data-act="companion-collection-page" data-act-opt="next" disabled={foodPage + 1 >= foodPageCount} onClick={event => selectFoodIndex((foodPage + 1) * FOOD_PAGE_SIZE, event.detail === 0)} type="button">다음<ChevronRight aria-hidden="true" size={17} /></button></nav>
          <ul className="rhh-collection-grid rhh-food-grid">{visibleFoods.map((food, localIndex) => {
            const index = foodOffset + localIndex;
            const found = collection?.foods.includes(food) ?? false;
            return <li key={food}><button aria-label={found ? `${COMPANION_FOOD_NAMES[food]} · 맛봤어요` : `??? · ${index + 1}`} aria-pressed={selectedFood === food} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt="food" data-food-index={index} data-found={found || undefined} onClick={() => setSelectedFood(food)} onKeyDown={event => onCollectionKey(event, index, COMPANION_FOOD_KINDS.length, next => selectFoodIndex(next, true), foodOffset)} tabIndex={selectedFood === food ? 0 : -1} type="button"><CompanionCollectionArt kind="food" id={food} /><span>{found ? COMPANION_FOOD_NAMES[food] : "???"}</span>{found && <><span className="rhh-collection-rarity">{COMPANION_FOOD_RARITY_NAMES[COMPANION_FOOD_RARITY[food]]}</span><CompanionCollectionArt className="rhh-collection-stamp" kind="food-stamp" id={food} /></>}</button></li>;
          })}</ul>
        </> : <>
          <div aria-live="polite" className="rhh-collection-detail"><strong>{memoryFound(selectedMemory) ? selectedMemory.name : "???"}</strong><p>{memoryFound(selectedMemory) ? selectedMemory.hint : "아직 발견하지 못했어요."}</p></div>
          <ul className="rhh-collection-grid rhh-behavior-grid">{memories.map((memory, index) => { const found = memoryFound(memory); return <li key={`${memory.kind}:${memory.id}`}><button aria-label={found ? `${memory.name} · 만났어요` : `??? · ${index + 1}`} aria-pressed={selectedMemoryIndex === index} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt={memory.kind} data-found={found || undefined} onClick={() => setSelectedMemoryIndex(index)} onKeyDown={event => onCollectionKey(event, index, memories.length, setSelectedMemoryIndex, 0, next => memories[next].kind)} tabIndex={selectedMemoryIndex === index ? 0 : -1} type="button"><CompanionCollectionArt kind={memory.kind === "moment" ? "situation-stamp" : "behavior-stamp"} id={memory.id} /><span>{found ? memory.name : "???"}</span></button></li>; })}</ul>
        </>}
  </div> : null;
}
