"use client";

import { Heart, Leaf, Moon, PartyPopper, Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CompanionCollectionArt } from "@/components/poster/viewer-companion/companion-collection-art";
import { getCompanionLearnedEffectDirections } from "@/lib/ui/viewer-companion/behavior-profile";
import { loadCompanionCare, resetCompanionHabits, subscribeCompanionHabits, subscribeCompanionLife, type CompanionMemory } from "@/lib/ui/viewer-companion/care";
import { COMPANION_BEHAVIOR_HINTS, COMPANION_BEHAVIOR_IDS, COMPANION_BEHAVIOR_NAMES, equipCompanionAccessory, loadCompanionCollection, openCompanionGift, subscribeCompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_ACCESSORY_HINTS, COMPANION_ACCESSORY_IDS, COMPANION_ACCESSORY_NAMES } from "@/lib/ui/viewer-companion/gifts";
import { DEFAULT_COMPANION_HABITS } from "@/lib/ui/viewer-companion/habits";
import { DEFAULT_COMPANION_LIFE, type CompanionLifeReason } from "@/lib/ui/viewer-companion/life";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { companionFoodChance, COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY, COMPANION_FOOD_RARITY_NAMES } from "@/lib/ui/viewer-companion/snacks";
import { hapticTick } from "@/lib/ui/haptics";
import { playSfx } from "@/lib/ui/sfx";

const pages = [{ key: "together", label: "함께 지내기" }, { key: "discover", label: "발견 도감" }, { key: "dress", label: "꾸미기" }] as const;
type ProfilePage = typeof pages[number]["key"];
type Collection = ReturnType<typeof loadCompanionCollection>;
type FoodId = typeof COMPANION_FOOD_KINDS[number];
type BehaviorId = typeof COMPANION_BEHAVIOR_IDS[number];
type AccessoryId = typeof COMPANION_ACCESSORY_IDS[number];

const recentReasons: Record<CompanionLifeReason, string> = {
  "favorite-food": "좋아하는 맛을 다시 즐겼어요.", "new-flavor": "새로운 맛을 알아가고 있어요.",
  "kind-touch": "쓰다듬으며 더 가까워졌어요.", "play-together": "함께 놀며 장난기가 조금 자랐어요.",
  "food-mishap": "먹거리 앞에서 놀란 뒤 조금 신중해졌어요.", "cozy-rest": "편히 쉬며 느긋해졌어요.",
  "discovered-taste": "여러 번 맛보며 좋아하는 맛을 찾았어요.", "variety": "여러 맛을 골고루 알아가고 있어요.",
  "reassured": "놀란 뒤 쓰다듬으며 다시 편안해졌어요.", "rested": "푹 쉬고 기운을 차렸어요."
};

/** One event-coalesced paint, never a cursor or animation loop. */
function useProfileSpotlight(active: boolean, page: ProfilePage) {
  const host = useRef<HTMLDivElement>(null), pending = useRef<number | null>(null), point = useRef({ x: 0, y: 0 });
  const clear = useCallback(() => {
    if (pending.current !== null) cancelAnimationFrame(pending.current);
    pending.current = null;
    host.current?.removeAttribute("data-spotlight");
  }, []);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const html = document.documentElement;
    if (!active || event.pointerType === "touch" || html.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(html.dataset.gfx ?? "")) { clear(); return; }
    point.current = { x: event.clientX, y: event.clientY };
    if (pending.current !== null) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = null;
      const element = host.current;
      if (!active || !element?.isConnected || html.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(html.dataset.gfx ?? "")) { clear(); return; }
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) { clear(); return; }
      element.style.setProperty("--profile-spot-x", `${Math.max(0, Math.min(rect.width, point.current.x - rect.left))}px`);
      element.style.setProperty("--profile-spot-y", `${Math.max(0, Math.min(rect.height, point.current.y - rect.top))}px`);
      element.dataset.spotlight = "";
    });
  };
  useEffect(() => {
    if (!active) { clear(); return; }
    const hidden = () => { if (document.hidden) clear(); };
    window.addEventListener("blur", clear); document.addEventListener("visibilitychange", hidden);
    return () => { clear(); window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", hidden); };
  }, [active, page, clear]);
  return { ref: host, onPointerMove: move, onPointerEnter: move, onPointerLeave: clear };
}

function onCollectionKey(event: KeyboardEvent<HTMLButtonElement>, index: number, length: number, select: (index: number) => void) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const list = event.currentTarget.closest("ul");
  if (!list) return;
  const columns = Math.max(1, getComputedStyle(list).gridTemplateColumns.split(/\s+/).length);
  const next = event.key === "Home" ? 0 : event.key === "End" ? length - 1 : event.key === "ArrowLeft" ? Math.max(0, index - 1) : event.key === "ArrowRight" ? Math.min(length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - columns) : Math.min(length - 1, index + columns);
  event.preventDefault(); event.stopPropagation(); select(next);
  list.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
}

function learnedEffects(preferences: CompanionPreferences, memory: CompanionMemory | null) {
  const habits = memory?.habits ?? DEFAULT_COMPANION_HABITS;
  const directions = getCompanionLearnedEffectDirections({ ...preferences, learnFromYou: true }, habits);
  const effects: string[] = [];
  if (directions.pointerGap) effects.push(directions.pointerGap < 0 ? "마우스와 조금 더 가까이 지내려 해요." : "마우스와 거리를 조금 더 두려 해요.");
  if (directions.playWeight) effects.push(directions.playWeight > 0 ? "놀이를 고르는 쪽으로 기울었어요." : "놀이보다 쉬어 가는 쪽으로 기울었어요.");
  if (directions.lookScale) effects.push(directions.lookScale < 0 ? "새로운 자리를 살피는 시간이 조금 짧아졌어요." : "새로운 자리를 조금 더 오래 살펴요.");
  return effects;
}

export function CompanionProfile({ preferences, active }: { preferences: CompanionPreferences; active: boolean }) {
  const [page, setPage] = useState<ProfilePage>("together"), [care, setCare] = useState<CompanionMemory | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null), [category, setCategory] = useState<"food" | "behavior">("food");
  const [selectedFood, setSelectedFood] = useState<FoodId>(COMPANION_FOOD_KINDS[0]), [selectedBehavior, setSelectedBehavior] = useState<BehaviorId>(COMPANION_BEHAVIOR_IDS[0]);
  const [selectedAccessory, setSelectedAccessory] = useState<AccessoryId>(COMPANION_ACCESSORY_IDS[0]), [announcement, setAnnouncement] = useState("");
  const id = useId(), nav = useRef<HTMLDivElement>(null), spotlight = useProfileSpotlight(active, page);
  const pendingFocus = useRef<AccessoryId | null>(null);
  useEffect(() => {
    if (!active) return;
    const readCare = () => setCare(loadCompanionCare());
    readCare(); setCollection(loadCompanionCollection());
    const offHabits = subscribeCompanionHabits(readCare), offLife = subscribeCompanionLife(readCare), offCollection = subscribeCompanionCollection(setCollection);
    return () => { offHabits(); offLife(); offCollection(); };
  }, [active]);
  useEffect(() => {
    const accessory = pendingFocus.current;
    if (!active || page !== "dress") { pendingFocus.current = null; return; }
    if (!accessory || selectedAccessory !== accessory) return;
    spotlight.ref.current?.querySelector<HTMLButtonElement>(`[data-accessory="${accessory}"]`)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [active, page, selectedAccessory, collection, spotlight.ref]);
  const changePage = (next: ProfilePage) => { if (next !== page) playSfx("tab"); setPage(next); };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = pages.findIndex(item => item.key === page);
    const next = event.key === "Home" ? 0 : event.key === "End" ? pages.length - 1 : event.key === "ArrowRight" ? (index + 1) % pages.length : event.key === "ArrowLeft" ? (index - 1 + pages.length) % pages.length : -1;
    if (next < 0) return;
    event.preventDefault(); event.stopPropagation(); changePage(pages[next].key);
    nav.current?.querySelector<HTMLButtonElement>(`[data-profile-page="${pages[next].key}"]`)?.focus();
  };
  const life = care?.life ?? DEFAULT_COMPANION_LIFE, effectiveLife = preferences.learnFromYou ? life : DEFAULT_COMPANION_LIFE;
  const effects = learnedEffects(preferences, care), gifts = collection?.gifts;
  const mode = { default: "빅타민", cat: "고양이", dog: "강아지" }[preferences.animalMode];
  const personality = { curious: "호기심", affectionate: "애교쟁이", sleepy: "잠꾸러기" }[preferences.personality];
  const actions = [
    { name: "마우스 곁에서 교감", icon: <Heart size={19} />, effect: !preferences.roam || !preferences.petting ? "돌아다니기와 쓰다듬기를 켜면 먼저 다가오는 교감을 볼 수 있어요." : effectiveLife.social >= .4 ? "가까이 다가와 쓰다듬기를 부탁하거나 몸을 기대는 장면을 보여줄 수 있어요." : "먼저 다가오는 교감은 아직 뜸해요. 직접 쓰다듬으며 천천히 친해져요.", try: "가까운 빈 곳에 마우스를 잠깐 멈춰 보세요." },
    { name: "좋아하는 맛 고르기", icon: <Leaf size={19} />, effect: !preferences.feeding ? "밥주기를 켜면 건넨 먹거리를 맛볼 수 있어요." : preferences.learnFromYou ? "새 먹거리를 고를 때 거리와 좋아하는 맛을 함께 봐요." : "배우기가 꺼져 있어 새 먹거리는 가까운 쪽을 먼저 살펴요.", try: "집 자판기에서 여러 먹거리를 번갈아 건네 보세요." },
    { name: "집에서 포근하게", icon: <Moon size={19} />, effect: !preferences.sleep ? "낮잠을 켜면 집에서 자리를 고르고 몸을 모아 쉬어요." : effectiveLife.comfort >= .6 ? "집에 머물 때 피곤하지 않아도 자리를 고르며 쉬는 몸짓을 할 수 있어요." : "피곤할 때 집에서 몸을 모아 쉬어요. 직접 불러서 쉬게 할 수도 있어요.", try: "집 쿠션으로 불러 편히 쉬는 모습을 지켜보세요." },
    { name: "응원과 작은 장난", icon: <PartyPopper size={19} />, effect: !preferences.roam ? "돌아다니기를 켜면 넓은 곳에서 응원 연습을 볼 수 있어요." : effectiveLife.play >= .45 && effectiveLife.curiosity >= .4 ? "기운이 있고 넓은 곳에 머물 때 응원 동작을 연습할 수 있어요." : "함께 놀고 새로운 맛을 알아가며 응원 연습을 고를 바탕이 자라요.", try: "돌아다니다 넓고 안전한 곳에 머물면 잠깐 기다려 보세요." }
  ];
  const openGift = () => {
    const received = openCompanionGift();
    if (!received) return;
    pendingFocus.current = received;
    hapticTick(); playSfx("tab"); setSelectedAccessory(received); setAnnouncement(`${COMPANION_ACCESSORY_NAMES[received]} 선물을 받았어요.`);
  };
  const equip = (accessory: AccessoryId | null) => {
    if (!equipCompanionAccessory(accessory)) return;
    if (accessory === null && gifts?.equipped !== selectedAccessory) pendingFocus.current = selectedAccessory;
    hapticTick(); playSfx("tab"); setAnnouncement(accessory ? `${COMPANION_ACCESSORY_NAMES[accessory]} 장착` : "액세서리를 벗었어요.");
  };
  return <div className="rhh-companion-profile rhh-profile-playful" {...spotlight}>
    <div aria-label="빅타민 프로필" className="rhh-seg rhh-profile-nav" ref={nav} role="tablist" style={{ "--n": pages.length, "--i": pages.findIndex(item => item.key === page) } as CSSProperties}>
      <span aria-hidden="true" className="rhh-seg-thumb" />
      {pages.map(item => <button aria-controls={`${id}-${item.key}-panel`} aria-selected={page === item.key} className={page === item.key ? "on" : ""} data-act="companion-profile-page" data-act-opt={item.key} data-profile-page={item.key} id={`${id}-${item.key}-tab`} key={item.key} onClick={() => changePage(item.key)} onKeyDown={onTabKey} role="tab" tabIndex={page === item.key ? 0 : -1} type="button">{active && item.key === "discover" && <CompanionCollectionArt className="rhh-profile-nav-art" id={page === "discover" ? "book-open" : "book-closed"} kind="book" />}{item.label}</button>)}
    </div>
    <div aria-labelledby={`${id}-together-tab`} hidden={page !== "together"} id={`${id}-together-panel`} role="tabpanel" tabIndex={0}>
      <section aria-labelledby={`${id}-traits-title`} className="rhh-trait-card">
        <div className="rhh-profile-top">
          <div className="rhh-profile-identity"><span aria-hidden="true" className="rhh-profile-mark"><Sparkles size={26} /></span><div className="rhh-profile-name"><h3 id={`${id}-traits-title`}>빅타민 특성</h3><p className="rhh-profile-meta">{mode} 모드 · 기본 성격 {personality}</p></div></div>
          <div className="rhh-trait-favorite"><span aria-hidden="true" className="rhh-profile-food-art">{active && page === "together" && care && <CompanionCollectionArt kind="food" id={life.favoriteFood} />}</span><div className="rhh-trait-favorite-copy"><span>좋아하는 먹거리</span><strong>{care ? COMPANION_FOOD_NAMES[life.favoriteFood] : "알아가는 중"}</strong></div></div>
        </div>
        {!preferences.enabled && <p className="rhh-profile-notice">빅타민이 쉬고 있어요. 위에서 켜면 달력에서 함께 놀 수 있어요.</p>}
        <p className="rhh-profile-motion-note">움직임을 줄인 상태에서는 다가오기·응원 같은 일부 장면을 쉬어요.</p>
        {!preferences.learnFromYou && <p className="rhh-habit-paused">배우기 끔 · 기억은 보관하고, 지금은 기본 성격으로 지내요.</p>}
        <div className="rhh-profile-action-grid">{actions.map(action => <article className="rhh-profile-action" key={action.name}><h4><span aria-hidden="true">{action.icon}</span>{action.name}</h4><p>{action.effect}</p><p className="rhh-profile-try"><span>해보기</span>{action.try}</p></article>)}</div>
      </section>
      <section aria-labelledby={`${id}-habits-title`} className="rhh-profile-habits"><h3 id={`${id}-habits-title`}>배운 습관</h3><p className="rhh-profile-caption">함께한 경험이 실제 행동에 이렇게 반영돼요.</p>{!preferences.learnFromYou ? <p>아래 기억은 배우기를 다시 켜면 행동에 반영돼요.</p> : null}{effects.length ? <ul className="rhh-profile-learned">{effects.map(effect => <li key={effect}>{effect}</li>)}</ul> : <p className="rhh-habit-empty">아직 뚜렷한 변화는 없어요. 쓰다듬고 먹거리를 건네며 함께 지내 보세요.</p>}</section>
      <p className="rhh-trait-reason"><span>최근 남은 경험</span><span>{care?.life.recent.at(-1) ? recentReasons[care.life.recent.at(-1)!] : "여러 맛과 놀이를 알아가고 있어요."}</span></p>
      <div className="rhh-habit-actions"><p className="rhh-trait-reset-note" id={`${id}-reset-note`}>배운 습관과 취향·특성만 되돌려요. 도감과 받은 선물은 간직해요.</p><button aria-describedby={`${id}-reset-note`} aria-label="배운 습관 초기화" className="rhh-link" data-act="companion-learning-reset" onClick={() => { resetCompanionHabits(); hapticTick(); playSfx("tab"); }} type="button">초기화</button></div>
    </div>
    <div aria-labelledby={`${id}-discover-tab`} hidden={page !== "discover"} id={`${id}-discover-panel`} role="tabpanel" tabIndex={0}>
      {active && page === "discover" && <>
        <div className="rhh-collection-heading"><div><h3>발견 도감</h3><p>실제로 맛본 먹거리와 만난 몸짓을 간직해요.</p></div></div>
        {!collection?.foods.length && !collection?.behaviors.length && <div className="rhh-collection-empty"><CompanionCollectionArt id="discovery-seal" kind="gift" /><p>첫 발견을 기다리고 있어요. 먹거리를 맛보고 새로운 몸짓을 만나 보세요.</p></div>}
        <div aria-label="도감 종류" className="rhh-collection-switch" role="group"><button aria-pressed={category === "food"} data-act="companion-collection-category" data-act-opt="food" onClick={() => setCategory("food")} type="button">먹거리 <span>{collection?.foods.length ?? 0}/{COMPANION_FOOD_KINDS.length}</span></button><button aria-pressed={category === "behavior"} data-act="companion-collection-category" data-act-opt="behavior" onClick={() => setCategory("behavior")} type="button">만난 몸짓 <span>{collection?.behaviors.length ?? 0}/{COMPANION_BEHAVIOR_IDS.length}</span></button></div>
        {category === "food" ? <>
          <ul className="rhh-collection-grid">{COMPANION_FOOD_KINDS.map((food, index) => {
            const found = collection?.foods.includes(food) ?? false;
            return <li key={food}><button aria-label={`${COMPANION_FOOD_NAMES[food]} · ${found ? "맛봤어요" : "아직 맛보지 않았어요"}`} aria-pressed={selectedFood === food} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt="food" data-found={found || undefined} onClick={() => setSelectedFood(food)} onKeyDown={event => onCollectionKey(event, index, COMPANION_FOOD_KINDS.length, next => setSelectedFood(COMPANION_FOOD_KINDS[next]))} tabIndex={selectedFood === food ? 0 : -1} type="button"><CompanionCollectionArt kind="food" id={food} /><span>{COMPANION_FOOD_NAMES[food]}</span><span className="rhh-collection-rarity">{COMPANION_FOOD_RARITY_NAMES[COMPANION_FOOD_RARITY[food]]}</span>{found && <CompanionCollectionArt className="rhh-collection-stamp" kind="food-stamp" id={food} />}</button></li>;
          })}</ul>
          <div className="rhh-collection-detail"><strong>{COMPANION_FOOD_NAMES[selectedFood]}</strong><span className="rhh-collection-rarity">{COMPANION_FOOD_RARITY_NAMES[COMPANION_FOOD_RARITY[selectedFood]]}</span><p aria-live="polite">{collection?.foods.includes(selectedFood) ? "빅타민이 실제로 맛본 먹거리예요." : "아직 맛보지 않았어요. 자판기에서 나오면 건네 보세요."}</p><p className="rhh-collection-chance">기본 등장 확률 {(companionFoodChance(selectedFood) * 100).toFixed(1)}% · 직전 먹거리는 제외되어 실제 확률은 달라져요.</p></div>
        </> : <>
          <ul className="rhh-collection-grid rhh-behavior-grid">{COMPANION_BEHAVIOR_IDS.map((behavior, index) => { const found = collection?.behaviors.includes(behavior) ?? false; return <li key={behavior}><button aria-label={`${COMPANION_BEHAVIOR_NAMES[behavior]} · ${found ? "만났어요" : "아직 만나지 않았어요"}`} aria-pressed={selectedBehavior === behavior} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt="behavior" data-found={found || undefined} onClick={() => setSelectedBehavior(behavior)} onKeyDown={event => onCollectionKey(event, index, COMPANION_BEHAVIOR_IDS.length, next => setSelectedBehavior(COMPANION_BEHAVIOR_IDS[next]))} tabIndex={selectedBehavior === behavior ? 0 : -1} type="button"><CompanionCollectionArt kind="behavior-stamp" id={behavior} /><span>{COMPANION_BEHAVIOR_NAMES[behavior]}</span></button></li>; })}</ul>
          <div className="rhh-collection-detail"><strong>{COMPANION_BEHAVIOR_NAMES[selectedBehavior]}</strong><p aria-live="polite">{COMPANION_BEHAVIOR_HINTS[selectedBehavior]}</p><span>{collection?.behaviors.includes(selectedBehavior) ? "실제로 만난 몸짓이에요." : "이런 상황에서 만날 수 있어요. 서두르지 않아도 괜찮아요."}</span></div>
        </>}
      </>}
    </div>
    <div aria-labelledby={`${id}-dress-tab`} hidden={page !== "dress"} id={`${id}-dress-panel`} role="tabpanel" tabIndex={0}>
      {active && page === "dress" && <>
        <div className="rhh-collection-heading"><CompanionCollectionArt kind="gift" /><div><h3>받은 선물로 꾸미기</h3><p>함께 지내며 도착한 선물을 열어 보세요.</p></div></div>
        {gifts?.pending ? <div className="rhh-gift-arrival"><CompanionCollectionArt kind="gift" /><div><strong>선물이 도착했어요</strong><p>열어 본 뒤 원하는 때에 직접 장착해요.</p></div><button className="rhh-link" data-act="companion-gift-open" onClick={openGift} type="button">선물 열기</button></div> : <p className="rhh-profile-caption">{gifts?.unlocked.length === COMPANION_ACCESSORY_IDS.length ? "선물을 모두 열었어요. 원하는 액세서리를 골라 장착해 보세요." : "아직 열지 않은 선물은 없어요. 함께 놀고 다정하게 지내다 보면 선물이 도착해요."}</p>}
        <ul className="rhh-collection-grid rhh-accessory-grid">{COMPANION_ACCESSORY_IDS.map((accessory, index) => { const owned = gifts?.unlocked.includes(accessory) ?? false; return <li key={accessory}><button aria-label={`${COMPANION_ACCESSORY_NAMES[accessory]} · ${gifts?.equipped === accessory ? "장착 중" : owned ? "받은 선물" : "아직 받지 않았어요"}`} aria-pressed={selectedAccessory === accessory} data-accessory={accessory} className="rhh-collection-tile" data-act="companion-accessory-select" data-found={owned || undefined} onClick={() => setSelectedAccessory(accessory)} onKeyDown={event => onCollectionKey(event, index, COMPANION_ACCESSORY_IDS.length, next => setSelectedAccessory(COMPANION_ACCESSORY_IDS[next]))} tabIndex={selectedAccessory === accessory ? 0 : -1} type="button"><CompanionCollectionArt kind="accessory" id={accessory} /><span>{COMPANION_ACCESSORY_NAMES[accessory]}</span><span className="rhh-collection-state">{gifts?.equipped === accessory ? "장착 중" : owned ? "받은 선물" : "아직 받지 않음"}</span></button></li>; })}</ul>
        <div className="rhh-collection-detail"><strong>{COMPANION_ACCESSORY_NAMES[selectedAccessory]}</strong><p aria-live="polite">{COMPANION_ACCESSORY_HINTS[selectedAccessory]}</p>{gifts?.unlocked.includes(selectedAccessory) && <button className="rhh-link" data-act="companion-accessory-equip" data-act-opt={gifts.equipped === selectedAccessory ? "off" : "on"} onClick={() => equip(gifts.equipped === selectedAccessory ? null : selectedAccessory)} type="button">{gifts.equipped === selectedAccessory ? "벗기기" : "장착하기"}</button>}</div>
        {gifts?.equipped && gifts.equipped !== selectedAccessory && <p className="rhh-equipped-current">지금 장착: {COMPANION_ACCESSORY_NAMES[gifts.equipped]} <button className="rhh-link" data-act="companion-accessory-equip" data-act-opt="off" onClick={() => equip(null)} type="button">벗기기</button></p>}
      </>}
    </div>
    <p className="rhh-trait-note">도감과 선물은 이 브라우저에만 기억해요.</p>
    <span aria-live="polite" className="sr-only">{announcement}</span>
  </div>;
}
