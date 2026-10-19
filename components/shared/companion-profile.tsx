"use client";

import dynamic from "next/dynamic";
import { BookOpen, Heart, HelpCircle, Settings2, Shirt } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { getCompanionLearnedEffectDirections } from "@/lib/ui/viewer-companion/behavior-profile";
import { loadCompanionCare, subscribeCompanionHabits, subscribeCompanionLife, type CompanionMemory } from "@/lib/ui/viewer-companion/care";
import { getCompanionUnreadCounts, loadCompanionCollection, subscribeCompanionCollection, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_ACCESSORY_NAMES } from "@/lib/ui/viewer-companion/gifts";
import { DEFAULT_COMPANION_HABITS } from "@/lib/ui/viewer-companion/habits";
import { getCompanionFoodArtFrame } from "@/lib/ui/viewer-companion/food-art";
import type { CompanionLifeReason } from "@/lib/ui/viewer-companion/life";
import { COMPANION_PERSONALITY_NAMES, type CompanionPersonality, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_NAMES } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_TOY_NAMES, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { companionTasteReason, companionToyUnread, loadCompanionTastes, subscribeCompanionTastes, summarizeCompanionFoodTastes, summarizeCompanionToyTastes, type CompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { CompanionToyArt } from "@/components/poster/viewer-companion/companion-toy-art";
import type { CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { playSfx } from "@/lib/ui/sfx";
import { logActivity } from "@/lib/activity/client";

const loading = () => <span aria-live="polite" className="rhh-companion-loading" role="status">불러오는 중</span>;
const CompanionDiscovery = dynamic(() => import("./companion-discovery").then(module => module.CompanionDiscovery), { loading });
const CompanionWardrobe = dynamic(() => import("./companion-wardrobe").then(module => module.CompanionWardrobe), { loading });
const CompanionWardrobePreview = dynamic(() => import("./companion-wardrobe-preview").then(module => module.CompanionWardrobePreview), { loading });
const pages = [{ key: "together", label: "함께 지내기", icon: Heart }, { key: "discover", label: "도감", icon: BookOpen }, { key: "dress", label: "옷장", icon: Shirt }, { key: "settings", label: "환경설정", icon: Settings2 }] as const;
type ProfilePage = typeof pages[number]["key"];

const recentReasons: Record<CompanionLifeReason, string> = {
  "favorite-food": "좋아하는 간식 먹기", "new-flavor": "새 간식 맛보기",
  "kind-touch": "쓰다듬기", "play-together": "함께 놀기",
  "food-mishap": "간식 앞에서 깜짝", "food-declined": "익숙한 간식 사양", "food-disliked": "직접 맛본 간식", "cozy-rest": "포근한 휴식",
  "discovered-taste": "새 최애 간식", "variety": "다른 간식 맛보기",
  "reassured": "놀란 뒤 쓰다듬기", "rested": "푹 쉬기"
};
const personalityNotes: Readonly<Record<CompanionPersonality, string>> = {
  curious: "새 소품에 다가가 두리번거려요.", affectionate: "마우스를 따라와 쓰다듬어 달래요.",
  sleepy: "천천히 걷고 쿠션에서 쉬어요.", tidy: "흩어진 장난감을 상자에 넣어요.",
  mischievous: "장난감을 꺼내 툭툭 차요.", gourmet: "배고프면 간식을 먼저 찾아요.",
  performer: "안전한 자리에서 폴짝 재롱을 부려요.", homebody: "쿠션 가까이에서 놀고 쉬어요."
};

function foodStyle(kind: CompanionFoodKind) {
  const art = getCompanionFoodArtFrame(kind);
  if (!art) return undefined;
  return { backgroundImage: `url("${art.src}")`, backgroundSize: `${art.atlasWidth / art.width * 100}% ${art.atlasHeight / art.height * 100}%`, backgroundPosition: `${art.atlasWidth === art.width ? 0 : art.x / (art.atlasWidth - art.width) * 100}% ${art.atlasHeight === art.height ? 0 : art.y / (art.atlasHeight - art.height) * 100}%` };
}
function TasteCard({ label, food, toy, dislike = false, reason }: { label: string; food?: CompanionFoodKind | null; toy?: CompanionToyKind | null; dislike?: boolean; reason?: string }) {
  const known = Boolean(food || toy);
  return <div className="rhh-taste-card" data-dislike={dislike || undefined} data-known={known || undefined}>
    <dt><span aria-hidden="true" className="rhh-taste-picture">{food ? <span className="vc-collection-art" style={foodStyle(food)} /> : toy ? <CompanionToyArt kind={toy} /> : <HelpCircle size={30} />}</span><span>{label}</span></dt><dd>{food ? COMPANION_FOOD_NAMES[food] : toy ? COMPANION_TOY_NAMES[toy] : "알아가는 중"}{known && reason && <small className="rhh-taste-reason">{reason}</small>}</dd>
  </div>;
}

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
    if (!active || document.hidden || event.pointerType === "touch" || html.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(html.dataset.gfx ?? "")) { clear(); return; }
    point.current = { x: event.clientX, y: event.clientY };
    if (pending.current !== null) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = null;
      const element = host.current;
      if (!active || document.hidden || !element?.isConnected || html.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(html.dataset.gfx ?? "")) { clear(); return; }
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

function learnedEffects(preferences: CompanionPreferences, memory: CompanionMemory | null) {
  const habits = memory?.habits ?? DEFAULT_COMPANION_HABITS;
  const directions = getCompanionLearnedEffectDirections({ ...preferences, learnFromYou: true }, habits);
  const effects: string[] = [];
  if (directions.pointerGap) effects.push(directions.pointerGap < 0 ? "마우스에 더 바짝 다가와요." : "마우스에서 조금 떨어져 걸어요.");
  if (directions.playWeight) effects.push(directions.playWeight > 0 ? "재롱을 더 자주 부려요." : "재롱을 덜 부려요.");
  if (directions.lookScale) effects.push(directions.lookScale < 0 ? "잠깐 두리번거려요." : "조금 더 오래 두리번거려요.");
  return effects;
}

export function CompanionProfile({ preferences, active, environment }: { preferences: CompanionPreferences; active: boolean; environment?: (active: boolean) => ReactNode }) {
  const [page, setPage] = useState<ProfilePage>("together"), [care, setCare] = useState<CompanionMemory | null>(null), [collection, setCollection] = useState<CompanionCollection | null>(null);
  const [visited, setVisited] = useState({ discover: false, dress: false, settings: false });
  const [tastes, setTastes] = useState<CompanionTastes | null>(null);
  const id = useId(), nav = useRef<HTMLDivElement>(null), spotlight = useProfileSpotlight(active && preferences.enabled, page);
  useEffect(() => {
    if (!active) return;
    const readCare = () => setCare(loadCompanionCare());
    readCare(); setCollection(loadCompanionCollection()); setTastes(loadCompanionTastes());
    const offHabits = subscribeCompanionHabits(readCare), offLife = subscribeCompanionLife(readCare), offCollection = subscribeCompanionCollection(setCollection);
    const offTastes = subscribeCompanionTastes(value => { setTastes(value); readCare(); });
    return () => { offHabits(); offLife(); offCollection(); offTastes(); };
  }, [active]);
  const changePage = (next: ProfilePage) => {
    if (next !== page) playSfx("tab");
    if (next !== "together") setVisited(value => value[next] ? value : { ...value, [next]: true });
    setPage(next);
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = pages.findIndex(item => item.key === page);
    const next = event.key === "Home" ? 0 : event.key === "End" ? pages.length - 1 : event.key === "ArrowRight" ? (index + 1) % pages.length : event.key === "ArrowLeft" ? (index - 1 + pages.length) % pages.length : -1;
    if (next < 0) return;
    event.preventDefault(); event.stopPropagation(); changePage(pages[next].key);
    if (pages[next].key !== page) logActivity("ui.click", { target: `companion-profile-page#${pages[next].key}` });
    nav.current?.querySelector<HTMLButtonElement>(`[data-profile-page="${pages[next].key}"]`)?.focus();
  };
  const foodTastes = summarizeCompanionFoodTastes(tastes, care?.life, collection?.foods), toyTastes = summarizeCompanionToyTastes(tastes);
  const favoriteFoodLabel = foodTastes.favorite ? `좋아하는 간식 · ${COMPANION_FOOD_NAMES[foodTastes.favorite]}` : undefined;
  const effects = learnedEffects(preferences, care), unread = getCompanionUnreadCounts(collection);
  const pageUnread = (key: ProfilePage) => key === "discover" ? unread.foods + unread.memories + companionToyUnread(tastes) > 0 : key === "dress" && unread.accessories > 0;
  const mode = { default: "빅타민", cat: "고양이", dog: "강아지" }[preferences.animalMode];
  const personality = COMPANION_PERSONALITY_NAMES[preferences.personality];
  return <div className="rhh-companion-settings rhh-companion-profile rhh-profile-playful rhh-companion-experience" data-paged={active && (page === "discover" || page === "dress") || undefined} {...spotlight}>
    <span className="sr-only" id={`${id}-unread`}>새로 발견한 항목</span>
    <div aria-label="빅타민 프로필" className="rhh-seg rhh-profile-nav" ref={nav} role="tablist" style={{ "--n": pages.length, "--i": pages.findIndex(item => item.key === page) } as CSSProperties}>
      <span aria-hidden="true" className="rhh-seg-thumb" />
      {pages.map(item => <button aria-describedby={pageUnread(item.key) ? `${id}-unread` : undefined} data-unread={pageUnread(item.key) || undefined} aria-controls={`${id}-${item.key}-panel`} aria-selected={page === item.key} className={page === item.key ? "on" : ""} data-act="companion-profile-page" data-act-opt={item.key} data-profile-page={item.key} id={`${id}-${item.key}-tab`} key={item.key} onClick={() => changePage(item.key)} onKeyDown={onTabKey} role="tab" tabIndex={page === item.key ? 0 : -1} type="button"><item.icon aria-hidden="true" size={17} />{item.label}{pageUnread(item.key) && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}</button>)}
    </div>
    <div aria-labelledby={`${id}-together-tab`} hidden={page !== "together"} id={`${id}-together-panel`} role="tabpanel" tabIndex={0}>
      <section aria-labelledby={`${id}-traits-title`} className="rhh-trait-card rhh-companion-summary">
        <button aria-label="옷장 열기" className="rhh-companion-portrait" data-act="companion-profile-page" data-act-opt="dress" data-sfx="off" onClick={() => changePage("dress")} type="button">
          {active && page === "together" && <CompanionWardrobePreview accessory={collection?.gifts.equipped ?? null} behaviors={collection?.behaviors ?? []} enabled={preferences.enabled} interactive={false} />}
          {foodTastes.favorite && <span aria-label={favoriteFoodLabel} className="rhh-companion-interest" role="img" title={favoriteFoodLabel}><span aria-hidden="true" className="vc-collection-art" style={foodStyle(foodTastes.favorite)} /></span>}
          <span className="rhh-companion-portrait-link"><Shirt aria-hidden="true" size={16} />옷장</span>
        </button>
        <div className="rhh-companion-summary-copy"><span className="rhh-companion-presence" data-awake={preferences.enabled || undefined}>빅타민{!preferences.enabled && " · 쉬는 중"}</span><h3 className="rhh-profile-personality" id={`${id}-traits-title`}>{personality}</h3><p className="rhh-profile-meta"><span>{personalityNotes[preferences.personality]}</span></p>
          <p className="rhh-profile-appearance">{mode} 모드 · {collection?.gifts.equipped ? COMPANION_ACCESSORY_NAMES[collection.gifts.equipped] : "기본 모습"}</p>
        </div>
        <dl className="rhh-companion-facts"><TasteCard label="좋아하는 간식" food={foodTastes.favorite} reason={companionTasteReason(tastes, "food", foodTastes.favorite, "positive")} /><TasteCard label="싫어하는 간식" food={foodTastes.disliked} reason={companionTasteReason(tastes, "food", foodTastes.disliked, "negative")} dislike /><TasteCard label="좋아하는 장난감" toy={toyTastes.favorite} reason={companionTasteReason(tastes, "toy", toyTastes.favorite, "positive")} /><TasteCard label="싫어하는 장난감" toy={toyTastes.disliked} reason={companionTasteReason(tastes, "toy", toyTastes.disliked, "negative")} dislike /></dl>
      </section>
      <section aria-labelledby={`${id}-habits-title`} className="rhh-profile-habits"><div className="rhh-habits-heading"><h3 id={`${id}-habits-title`}>배운 습관</h3>{!preferences.learnFromYou && <span className="rhh-habit-paused">적용 중지</span>}</div>{effects.length ? <ul className="rhh-profile-learned">{effects.map(effect => <li key={effect}>{effect}</li>)}</ul> : <p className="rhh-habit-empty">아직 배운 습관이 없어요.</p>}</section>
      {care?.life.recent.at(-1) && <p className="rhh-trait-reason"><span>최근 경험</span><span>{recentReasons[care.life.recent.at(-1)!]}</span></p>}
    </div>
    <div aria-labelledby={`${id}-discover-tab`} hidden={page !== "discover"} id={`${id}-discover-panel`} role="tabpanel" tabIndex={0}>{visited.discover && <CompanionDiscovery active={active && page === "discover"} collection={collection} tastes={tastes} />}</div>
    <div aria-labelledby={`${id}-dress-tab`} hidden={page !== "dress"} id={`${id}-dress-panel`} role="tabpanel" tabIndex={0}>{visited.dress && <CompanionWardrobe active={active && page === "dress"} collection={collection} preferences={preferences} />}</div>
    <div aria-labelledby={`${id}-settings-tab`} hidden={page !== "settings"} id={`${id}-settings-panel`} role="tabpanel" tabIndex={0}>{visited.settings && environment?.(active && page === "settings")}</div>
  </div>;
}
