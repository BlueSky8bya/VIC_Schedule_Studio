"use client";

import { forwardRef, useCallback, useId, useImperativeHandle, useLayoutEffect, useRef, useSyncExternalStore, type HTMLAttributes, type ReactNode } from "react";
import { flipSpring } from "@/lib/ui/flip-motion";
import { hapticTick } from "@/lib/ui/haptics";
import { applyPanelSectionPreferences, getPanelSectionPreferences, setPanelSectionExpanded, subscribePanelSectionPreferences, type PanelSectionKey } from "@/lib/ui/panel-section-preferences";
import "./panel-section.css";

const serverExpanded = () => true;
const headingActions: Record<PanelSectionKey, string> = {
  "tag-filter": "tag-filter-fold",
  season: "season-panel-fold",
  "companion-home": "companion-home-fold"
};

type Props = Omit<HTMLAttributes<HTMLElement>, "title" | "children"> & {
  title: string;
  sectionKey: PanelSectionKey;
  as?: "div" | "section" | "aside";
  collapsible?: boolean;
  headingClassName?: string;
  headingData?: Record<`data-${string}`, string>;
  headingAction?: string;
  actions?: ReactNode;
  children: ReactNode;
};

/** One disclosure across viewer, studio and previews. Device storage contains
 * only three booleans.
 * Mounted hidden bodies retain filters, ambient state and real home anchors. */
export const PanelSection = forwardRef<HTMLElement, Props>(function PanelSection({ title, sectionKey, as: Tag = "section", collapsible = false, headingClassName = "", headingData, headingAction, actions, className = "", children, ...attributes }, forwardedRef) {
  const root = useRef<HTMLElement | null>(null);
  const before = useRef<Map<Element, DOMRect> | null>(null);
  const bodyId = useId();
  const snapshot = useCallback(() => getPanelSectionPreferences()[sectionKey], [sectionKey]);
  const savedExpanded = useSyncExternalStore(subscribePanelSectionPreferences, snapshot, serverExpanded);
  const expanded = !collapsible || savedExpanded;
  const action = headingAction ?? headingActions[sectionKey];
  useImperativeHandle(forwardedRef, () => root.current!, []);
  useLayoutEffect(() => {
    applyPanelSectionPreferences();
    const captured = before.current; before.current = null;
    if (captured) for (const [element, previous] of captured) {
      if (!(element instanceof HTMLElement) || !element.isConnected) continue;
      const next = element.getBoundingClientRect(), dx = previous.left - next.left, dy = previous.top - next.top;
      if (next.width > 0 && next.height > 0 && (Math.abs(dx) > .1 || Math.abs(dy) > .1)) flipSpring(element, `translate(${dx}px,${dy}px)`);
    }
    window.dispatchEvent(new CustomEvent("vic:panel-section", { detail: { id: sectionKey, expanded } }));
  }, [expanded, sectionKey]);
  const toggle = () => {
    let group = root.current?.parentElement;
    // A tag/home has a thin host wrapper. Capture the actual neighbouring
    // cards rather than creating another layout/animation mechanism.
    for (let depth = 0; group && group.children.length === 1 && depth < 2; depth++) group = group.parentElement;
    before.current = new Map([...(group?.children ?? [])].map(element => [element, element.getBoundingClientRect()]));
    setPanelSectionExpanded(sectionKey, !expanded); hapticTick();
  };
  return <Tag {...attributes} ref={element => { root.current = element; }} className={`panel-section ${className}`.trim()} aria-label={attributes["aria-label"] ?? title} data-panel-section={sectionKey} data-panel-collapsible={collapsible ? "" : undefined} data-panel-collapsed={expanded ? undefined : ""}>
    <header className="panel-section-heading">
      <h2 className={`panel-section-title ${headingClassName}`.trim()}>{collapsible ? <button {...headingData} data-act={action} data-act-opt={expanded ? "close" : "open"} type="button" className="panel-section-toggle" aria-label={title} aria-expanded={expanded} aria-controls={bodyId} data-panel-section-toggle={sectionKey} onClick={toggle}><span className="panel-section-disclosure" aria-hidden="true" /><span className="panel-section-label">{title}</span></button> : <span>{title}</span>}</h2>
      {actions ? <div className="panel-section-actions">{actions}</div> : null}
    </header>
    <div id={bodyId} className="panel-section-body" hidden={!expanded} inert={expanded ? undefined : true} aria-hidden={expanded ? undefined : true}>{children}</div>
  </Tag>;
});
