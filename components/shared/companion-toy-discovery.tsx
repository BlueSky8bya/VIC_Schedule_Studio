"use client";

import { HelpCircle } from "lucide-react";
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { CompanionToyArt } from "@/components/poster/viewer-companion/companion-toy-art";
import { COMPANION_TOY_HINTS, COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { acknowledgeCompanionToy, type CompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { companionCollectionPage, onCollectionKey, useCompanionCollectionLayout } from "./companion-collection-navigation";

import { CompanionCollectionPager } from "./companion-collection-pager";

/** An unknown item never mounts its picture, name or description. Inspection
 * alone acknowledges it; opening the book or changing pages does not. */
export function CompanionToyDiscovery({ tastes, active, selectedKind, onSelect }: { tastes: CompanionTastes | null; active: boolean; selectedKind: CompanionToyKind; onSelect: (kind: CompanionToyKind) => void }) {
  const selected = COMPANION_TOY_KINDS.indexOf(selectedKind), host = useRef<HTMLDivElement>(null), grid = useRef<HTMLUListElement>(null), pendingFocus = useRef(false);
  const description = useId(), layout = useCompanionCollectionLayout(grid, active, "toy"), page = companionCollectionPage(selected, COMPANION_TOY_KINDS.length, layout.size);
  const kind = COMPANION_TOY_KINDS[selected], found = tastes?.toys.includes(kind) ?? false;
  const unreadAt = (index: number) => Boolean(tastes?.toys.includes(COMPANION_TOY_KINDS[index]) && !tastes.seen.includes(COMPANION_TOY_KINDS[index]));
  const select = (index: number, focus = false, inspect = false) => { onSelect(COMPANION_TOY_KINDS[index]); pendingFocus.current = focus; return inspect && acknowledgeCompanionToy(COMPANION_TOY_KINDS[index]); };
  useEffect(() => {
    if (!active) { pendingFocus.current = false; return; }
    if (pendingFocus.current) host.current?.querySelector<HTMLButtonElement>(`[data-collection-index="${selected}"]`)?.focus({ preventScroll: true });
    pendingFocus.current = false;
  }, [active, selected, page.offset, layout.size, tastes]);
  if (!active) return null;
  return <div className="rhh-companion-toy-discovery rhh-collection-book" ref={host}>
    <span className="sr-only" id={description}>새로 발견한 장난감</span>
    <div aria-live="polite" className="rhh-collection-detail rhh-collection-gallery-detail rhh-toy-detail" data-found={found || undefined}>
      <div aria-hidden="true" className="rhh-collection-art-stage">{found ? <CompanionToyArt kind={kind} /> : <HelpCircle className="rhh-toy-unknown" />}</div>
      <div className="rhh-collection-detail-copy"><div className="rhh-collection-detail-title"><strong>{found ? COMPANION_TOY_NAMES[kind] : "???"}</strong></div><p className="rhh-collection-fact">{found ? COMPANION_TOY_HINTS[kind] : "아직 만나기 전"}</p></div>
    </div>
    <ul aria-label="장난감 도감" className="rhh-collection-grid rhh-toy-grid" ref={grid} style={{ "--collection-columns": layout.columns, "--collection-rows": layout.rows } as CSSProperties}>
      {COMPANION_TOY_KINDS.slice(page.offset, page.end).map((item, localIndex) => {
        const index = page.offset + localIndex, known = tastes?.toys.includes(item) ?? false, unread = known && !tastes?.seen.includes(item);
        return <li key={item}><button aria-label={known ? `${COMPANION_TOY_NAMES[item]} · 만났어요` : `??? · ${index + 1}`} aria-describedby={unread ? description : undefined} aria-pressed={selected === index} className="rhh-collection-tile" data-act="companion-collection-inspect" data-act-opt="toy" data-collection-index={index} data-found={known || undefined} data-unread={unread || undefined} onClick={() => select(index, false, true)} onKeyDown={event => onCollectionKey(event, index, COMPANION_TOY_KINDS.length, next => select(next, true, true), page.offset)} tabIndex={selected === index ? 0 : -1} type="button">
          {unread && <span aria-hidden="true" className="rhh-collection-unread" data-unread="">!</span>}{known ? <CompanionToyArt kind={item} /> : <HelpCircle aria-hidden="true" className="rhh-toy-unknown" />}<span>{known ? COMPANION_TOY_NAMES[item] : "???"}</span>
        </button></li>;
      })}
    </ul>
    <CompanionCollectionPager label="장난감 도감 페이지" previousLabel="이전 페이지" nextLabel="다음 페이지" page={page} size={layout.size} length={COMPANION_TOY_KINDS.length} selected={selected} unread={unreadAt} select={select} categoryAt={() => "toy"} />
  </div>;
}
