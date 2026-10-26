"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { hapticTick } from "@/lib/ui/haptics";

/** One real tag list, folded by default. Measure its unwrapped chip widths,
 * not the current button-reduced width, so the disclosure cannot sustain its
 * own overflow after a resize. No storage, duplicate labels or idle loop. */
export function PublicDetailTags({ children }: { children: ReactNode }) {
  const group = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const container = group.current, tags = list.current;
    if (!container || !tags || expanded) return;
    const measure = () => {
      const chips = [...tags.querySelectorAll<HTMLElement>(".agenda-detail-tag")];
      const gap = Number.parseFloat(getComputedStyle(tags).columnGap) || 0;
      const total = chips.reduce((sum, chip) => {
        const label = chip.querySelector<HTMLElement>(".agenda-detail-tag-label");
        return sum + chip.offsetWidth + (label ? label.scrollWidth - label.clientWidth : 0);
      }, Math.max(0, chips.length - 1) * gap);
      setOverflow(total > container.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);observer.observe(tags);
    const mutations = new MutationObserver(measure);
    mutations.observe(tags, { childList: true, characterData: true, subtree: true });
    document.fonts.addEventListener("loadingdone", measure);
    return () => { observer.disconnect();mutations.disconnect();document.fonts.removeEventListener("loadingdone", measure); };
  }, [expanded]);
  return <div className="agenda-detail-tag-group" data-expanded={expanded} ref={group}>
    <div aria-label="태그" className="agenda-detail-tags" id={id} ref={list}>{children}</div>
    {overflow ? <button aria-controls={id} aria-expanded={expanded} aria-label={expanded ? "태그 접기" : "태그 펼치기"}
      className="agenda-detail-tags-toggle" data-act="detail-tags-toggle" data-tip={expanded ? "태그 접기" : "태그 펼치기"}
      onClick={() => {hapticTick();setExpanded(value => !value);}} type="button">
      <ChevronDown aria-hidden="true" size={14} />
    </button> : null}
  </div>;
}
