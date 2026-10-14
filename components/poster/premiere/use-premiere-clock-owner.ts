"use client";

import { useEffect, useState, type RefObject } from "react";

export function usePremiereCardVisible(root: RefObject<HTMLDivElement | null>, ids: string, active: boolean) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const page = root.current;
    if (!page || !active) return;
    const wanted = new Set(ids.split("|"));
    const cards = new Map<Element, boolean>();
    const update = () => setVisible([...cards.values()].some(Boolean));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) cards.set(entry.target, entry.isIntersecting && entry.intersectionRatio >= .35);
      update();
    }, { threshold: [0, .35] });
    const bind = () => {
      const next = [...page.querySelectorAll<HTMLElement>("[data-eventid]")].filter(el => wanted.has(el.dataset.eventid ?? ""));
      for (const el of cards.keys()) if (!next.includes(el as HTMLElement)) { observer.unobserve(el); cards.delete(el); }
      for (const el of next) if (!cards.has(el)) { cards.set(el, true); observer.observe(el); }
      update();
    };
    bind();
    const topology = new MutationObserver(changes => {
      if (changes.some(change => [...change.addedNodes, ...change.removedNodes].some(node => node instanceof Element && (node.matches("[data-eventid]") || node.querySelector("[data-eventid]"))))) bind();
    });
    topology.observe(page, { childList: true, subtree: true });
    return () => { observer.disconnect(); topology.disconnect(); };
  }, [root, ids, active]);
  return visible;
}
