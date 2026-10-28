"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export type CalendarPreviewMetrics = {
  kind: "web" | "agenda";
  hasCard: boolean;
  hasSub: boolean;
  cellWidth: number;
  cardWidth: number;
  cardLeft: number;
  cardPaddingTop: number;
  cardPaddingBottom: number;
  cardPaddingLeft: number;
  cardPaddingRight: number;
  titleWidth: number;
  subWidth: number;
  subLeft: number;
  subGap: number;
  fontFamily: string;
  titleFontSize: number;
  titleLineHeight: number;
  titleFontWeight: string;
  titleLetterSpacing: number;
  titleStrokeWidth: number;
  titleWhiteSpace: string;
  titleWordBreak: string;
  titleOverflowWrap: string;
  titleOverflowX: string;
  titleTextOverflow: string;
  titleMinHeight: number;
  subFontSize: number;
  subLineHeight: number;
  subFontWeight: string;
  subLetterSpacing: number;
  subStrokeWidth: number;
  subWhiteSpace: string;
  subWordBreak: string;
  subOverflowWrap: string;
  dateFontSize: number;
  dateFontWeight: string;
  dateLineHeight: number;
};

type Source = {
  kind: CalendarPreviewMetrics["kind"];
  cell: HTMLElement;
  card: HTMLElement;
  title: HTMLElement;
  titleRow: HTMLElement;
  sub: HTMLElement;
  subRow: HTMLElement;
  lastSubRow: HTMLElement;
  hasSub: boolean;
  date: HTMLElement;
};

const number = (value: string) => Number.parseFloat(value);
const space = (value: string) => value === "normal" ? 0 : number(value);
const margin = (value: string) => value === "auto" ? 0 : number(value);

/** getComputedStyle can resolve flex auto margins to the unused numeric
 * space. Typed OM retains the computed keyword; a longer specimen may use
 * that space, so it must not be reserved as fixed padding. */
function layoutMargin(element: HTMLElement, style: CSSStyleDeclaration, edge: "left" | "right" | "top" | "bottom"): number {
  const property = `margin-${edge}`;
  let typedAvailable = false;
  try {
    const typed = (element as HTMLElement & { computedStyleMap?: () => { get: (name: string) => unknown } }).computedStyleMap?.().get(property);
    if (typed !== undefined) {
      typedAvailable = true;
      if (String(typed) === "auto") return 0;
    }
  } catch { /* Fall back to the current shared controls' explicit CSS. */ }
  if (!typedAvailable && edge === "left" && element.matches(".pill-dots,.agenda-heart")) return 0;
  return margin(style.getPropertyValue(property));
}

function rendered(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest("[hidden]")) return false;
  const style = getComputedStyle(element), rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0
    && rect.width > 0 && rect.height > 0 && element.getClientRects().length > 0;
}

/** These sources supply only geometry and computed typography. No text,
 * schedule identity, title/body, cloned nodes or persistence is inspected. */
function findSource(root: HTMLElement): Source | null {
  const candidates = root.querySelectorAll<HTMLElement>(
    ".agenda-event:not(.teaser):not(.m-support):not([data-supportid]), .studio-event-pill:not(.teaser), .public-event:not(.teaser)"
  );
  let titleOnly: Source | null = null;
  let spanningWithSub: Source | null = null, spanningTitleOnly: Source | null = null;
  for (const card of candidates) {
    if (!rendered(card) || card.closest("[data-settings-preview],.rhh-text-stage")) continue;
    const agenda = card.matches(".agenda-event");
    const cell = card.closest<HTMLElement>(agenda ? ".agenda-day" : ".studio-day,.public-day");
    const titleRow = card.querySelector<HTMLElement>(agenda ? ".agenda-title" : ".pill-main,.event-main");
    const title = card.querySelector<HTMLElement>(agenda ? ".agenda-title-text" : ".pill-main strong:not(.span-cont),.event-main p:not(.span-cont)");
    const subRows = Array.from(card.querySelectorAll<HTMLElement>(agenda ? ".agenda-subs li" : ".pill-subs:not(.span-cont) li,.event-subs:not(.span-cont) li")).filter(rendered);
    const subRow = subRows[0] ?? title;
    const sub = subRow?.querySelector<HTMLElement>(".pill-sub-text") ?? subRow;
    const date = cell?.querySelector<HTMLElement>(agenda ? ".agenda-when strong" : ".studio-day-head>strong,.day-strip>strong");
    if (cell && title && titleRow && sub && subRow && date && root.contains(cell)
      && [cell, title, titleRow, sub, subRow, date].every(rendered)) {
      const source: Source = { kind: agenda ? "agenda" : "web", cell, card, title, titleRow, sub, subRow, date,
        lastSubRow: subRows.at(-1) ?? titleRow, hasSub: subRows.length > 0 };
      if (card.classList.contains("span")) {
        if (source.hasSub) spanningWithSub ??= source;
        else spanningTitleOnly ??= source;
      } else {
        if (source.hasSub) return source;
        titleOnly ??= source;
      }
    }
  }
  // A start segment still supplies this day's real card/type geometry when
  // every ordinary event spans days. Invisible continuation text is excluded
  // by the title selector above; no joined background or event text is copied.
  return titleOnly ?? spanningWithSub ?? spanningTitleOnly;
}

function findFrame(root: HTMLElement): { cell: HTMLElement; date: HTMLElement; kind: CalendarPreviewMetrics["kind"] } | null {
  for (const cell of root.querySelectorAll<HTMLElement>(".agenda-day,.agenda-gap,.public-day,.studio-day")) {
    if (!rendered(cell) || cell.closest("[data-settings-preview],.rhh-text-stage")) continue;
    const kind = cell.matches(".agenda-day,.agenda-gap") ? "agenda" : "web";
    const date = cell.querySelector<HTMLElement>(".agenda-when strong,.studio-day-head>strong,.day-strip>strong");
    return { cell, date: date && rendered(date) ? date : cell, kind };
  }
  return null;
}

/** Computed widths retain their fractional CSS pixels. offsetWidth/Height
 * round to integers and made the old preview's scale change with wrapping.
 * Calendar transforms are axis-aligned, uniform scales (poster fit / studio
 * zoom); border-box normalization also includes any native CSS zoom. */
function paintedScale(element: HTMLElement): number | null {
  const style = getComputedStyle(element);
  const width = number(style.width);
  const layoutWidth = style.boxSizing === "border-box" ? width : width
    + number(style.paddingLeft) + number(style.paddingRight)
    + number(style.borderLeftWidth) + number(style.borderRightWidth);
  const scale = element.getBoundingClientRect().width / layoutWidth;
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}

/** A short flex child can be narrower than the space available to a longer
 * specimen. Reserve native siblings (e.g. the viewer heart), their margins
 * and actual gaps, rather than borrowing the short label's intrinsic width. */
function availableWidth(element: HTMLElement, row: HTMLElement, scale: number): number {
  if (element === row) {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().width - scale * (number(style.paddingLeft) + number(style.paddingRight)
      + number(style.borderLeftWidth) + number(style.borderRightWidth));
  }
  const style = getComputedStyle(row);
  if (!style.display.includes("flex") || !["row", "row-reverse"].includes(style.flexDirection)) return element.getBoundingClientRect().width;
  const children = Array.from(row.children).filter((child): child is HTMLElement => child instanceof HTMLElement
    && rendered(child) && !["absolute", "fixed"].includes(getComputedStyle(child).position));
  if (!children.includes(element)) return element.getBoundingClientRect().width;
  const content = row.getBoundingClientRect().width - scale * (number(style.paddingLeft) + number(style.paddingRight)
    + number(style.borderLeftWidth) + number(style.borderRightWidth));
  const siblings = children.filter(child => child !== element).reduce((sum, child) => {
    const childStyle = getComputedStyle(child);
    // The native format dots use margin-left:auto to consume remaining
    // space. That free alignment space belongs to a longer specimen; only
    // the actual dots, fixed right margin and row gap must be reserved.
    const left = layoutMargin(child, childStyle, "left");
    return sum + child.getBoundingClientRect().width + scale * (left + layoutMargin(child, childStyle, "right"));
  }, 0);
  const ownStyle = getComputedStyle(element), gap = space(style.columnGap);
  return content - siblings - scale * (gap * Math.max(0, children.length - 1)
    + layoutMargin(element, ownStyle, "left") + layoutMargin(element, ownStyle, "right"));
}

/** Chromium retains the keyword `normal` for agenda detail lines. Their
 * native rendered line advance, not a guessed font multiplier, supplies the
 * preview's numeric line height. Range reads boxes only, never text values. */
function lineHeight(element: HTMLElement, style: CSSStyleDeclaration, scale: number): number {
  const explicit = number(style.lineHeight);
  if (Number.isFinite(explicit)) return explicit * scale;
  const font = number(style.fontSize) * scale, range = document.createRange();
  range.selectNodeContents(element);
  const centres: number[] = [];
  for (const box of range.getClientRects()) {
    if (box.width <= 0 || box.height < font * .6) continue;
    const centre = box.top + box.height / 2;
    if (!centres.some(value => Math.abs(value - centre) < font * .5)) centres.push(centre);
  }
  centres.sort((a, b) => a - b);
  if (centres.length > 1) return (centres.at(-1)! - centres[0]) / (centres.length - 1);
  const box = element.getBoundingClientRect();
  return box.height - scale * (number(style.paddingTop) + number(style.paddingBottom)
    + number(style.borderTopWidth) + number(style.borderBottomWidth));
}

function measure(source: Source): CalendarPreviewMetrics | null {
  const { cell, card, title, titleRow, sub, subRow, date } = source;
  const scale = paintedScale(card);
  if (scale === null) return null;
  const titleStyle = getComputedStyle(title), titleRowStyle = getComputedStyle(titleRow), subStyle = getComputedStyle(sub), dateStyle = getComputedStyle(date);
  const cellRect = cell.getBoundingClientRect(), cardRect = card.getBoundingClientRect();
  const titleRowRect = titleRow.getBoundingClientRect(), subRect = sub.getBoundingClientRect();
  const rowEdges = scale * (number(titleRowStyle.paddingTop) + number(titleRowStyle.paddingBottom)
    + number(titleRowStyle.borderTopWidth) + number(titleRowStyle.borderBottomWidth));
  const rowMinimum = number(titleRowStyle.minHeight);
  const siblingHeights = Array.from(titleRow.children).filter((child): child is HTMLElement => child instanceof HTMLElement
    && child !== title && rendered(child) && !["absolute", "fixed"].includes(getComputedStyle(child).position))
    .map(child => {
      const style = getComputedStyle(child);
      // The agenda heart's negative block margins enlarge its hit surface
      // without making the native title row taller. Match that layout box.
      return Math.max(0, child.getBoundingClientRect().height + scale
        * (layoutMargin(child, style, "top") + layoutMargin(child, style, "bottom")));
    });
  const value: CalendarPreviewMetrics = {
    kind: source.kind,
    hasCard: true,
    hasSub: source.hasSub,
    cellWidth: cellRect.width,
    cardWidth: cardRect.width,
    cardLeft: cardRect.left - cellRect.left,
    cardPaddingTop: titleRowRect.top - cardRect.top,
    cardPaddingBottom: cardRect.bottom - source.lastSubRow.getBoundingClientRect().bottom,
    // Agenda rows have no card padding, but their real color bar and gap
    // precede the content column. Preserve that text-column origin too.
    cardPaddingLeft: titleRowRect.left - cardRect.left + scale * (number(titleRowStyle.paddingLeft) + number(titleRowStyle.borderLeftWidth)),
    cardPaddingRight: cardRect.right - titleRowRect.right + scale * (number(titleRowStyle.paddingRight) + number(titleRowStyle.borderRightWidth)),
    titleWidth: availableWidth(title, titleRow, scale),
    subWidth: availableWidth(sub, subRow, scale),
    subLeft: subRect.left - cardRect.left + scale * (number(subStyle.paddingLeft) + number(subStyle.borderLeftWidth)),
    subGap: source.hasSub ? subRow.getBoundingClientRect().top - titleRowRect.bottom : 0,
    fontFamily: titleStyle.fontFamily,
    titleFontSize: number(titleStyle.fontSize) * scale,
    titleLineHeight: lineHeight(title, titleStyle, scale),
    titleFontWeight: titleStyle.fontWeight,
    titleLetterSpacing: space(titleStyle.letterSpacing) * scale,
    titleStrokeWidth: number(titleStyle.webkitTextStrokeWidth) * scale,
    titleWhiteSpace: titleStyle.whiteSpace,
    titleWordBreak: titleStyle.wordBreak,
    titleOverflowWrap: titleStyle.overflowWrap,
    titleOverflowX: titleStyle.overflowX,
    titleTextOverflow: titleStyle.textOverflow,
    titleMinHeight: Math.max(Number.isFinite(rowMinimum) ? rowMinimum * scale : 0, 0, ...siblingHeights) + rowEdges,
    subFontSize: number(subStyle.fontSize) * scale,
    subLineHeight: lineHeight(sub, subStyle, scale),
    subFontWeight: subStyle.fontWeight,
    subLetterSpacing: space(subStyle.letterSpacing) * scale,
    subStrokeWidth: number(subStyle.webkitTextStrokeWidth) * scale,
    subWhiteSpace: subStyle.whiteSpace,
    subWordBreak: subStyle.wordBreak,
    subOverflowWrap: subStyle.overflowWrap,
    dateFontSize: number(dateStyle.fontSize) * scale,
    dateFontWeight: dateStyle.fontWeight,
    dateLineHeight: lineHeight(date, dateStyle, scale)
  };
  if (Object.values(value).some(item => typeof item === "number" && !Number.isFinite(item))
    || value.titleWidth <= 0 || value.subWidth <= 0 || value.titleLineHeight <= 0 || value.subLineHeight <= 0 || value.dateLineHeight <= 0) return null;
  return value;
}

/** No ordinary card is present (empty or spanning-only month). Publish the
 * real frame width, explicitly without any calibrated sample card/subtitle.
 * Hidden typography fields carry the real frame/date style only; consumers
 * must use hasCard/hasSub to avoid fabricating an observed schedule sample. */
function measureFrame(frame: NonNullable<ReturnType<typeof findFrame>>): CalendarPreviewMetrics | null {
  const scale = paintedScale(frame.cell);
  if (scale === null) return null;
  const style = getComputedStyle(frame.date), fontSize = number(style.fontSize) * scale;
  const height = lineHeight(frame.date, style, scale), width = frame.cell.getBoundingClientRect().width;
  if (![fontSize, height, width].every(Number.isFinite) || width <= 0) return null;
  return {
    kind: frame.kind, hasCard: false, hasSub: false,
    cellWidth: width, cardWidth: 0, cardLeft: 0,
    cardPaddingTop: 0, cardPaddingBottom: 0, cardPaddingLeft: 0, cardPaddingRight: 0,
    titleWidth: 0, subWidth: 0, subLeft: 0, subGap: 0,
    fontFamily: style.fontFamily,
    titleFontSize: fontSize, titleLineHeight: height, titleFontWeight: style.fontWeight,
    titleLetterSpacing: space(style.letterSpacing) * scale, titleStrokeWidth: number(style.webkitTextStrokeWidth) * scale,
    titleWhiteSpace: style.whiteSpace, titleWordBreak: style.wordBreak, titleOverflowWrap: style.overflowWrap,
    titleOverflowX: style.overflowX, titleTextOverflow: style.textOverflow, titleMinHeight: 0,
    subFontSize: fontSize, subLineHeight: height, subFontWeight: style.fontWeight,
    subLetterSpacing: space(style.letterSpacing) * scale, subStrokeWidth: number(style.webkitTextStrokeWidth) * scale,
    subWhiteSpace: style.whiteSpace, subWordBreak: style.wordBreak, subOverflowWrap: style.overflowWrap,
    dateFontSize: fontSize, dateFontWeight: style.fontWeight, dateLineHeight: height
  };
}

export function useCalendarPreviewMetrics(
  root: RefObject<HTMLElement | null> | undefined,
  enabled: boolean,
  textPx: number,
  fontId: string,
  weight: number
): CalendarPreviewMetrics | null {
  const [metrics, setMetrics] = useState<CalendarPreviewMetrics | null>(null);
  useLayoutEffect(() => {
    let frame = 0, stopped = false;
    const observed = new Set<HTMLElement>();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());
    const apply = () => {
      frame = 0;
      if (stopped) return;
      const host = enabled ? root?.current : null, source = host ? findSource(host) : null;
      const emptyFrame = !source && host ? findFrame(host) : null;
      const next = source ? measure(source) : emptyFrame ? measureFrame(emptyFrame) : null;
      setMetrics(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      const targets = new Set<HTMLElement>();
      if (host) targets.add(host);
      if (emptyFrame) { targets.add(emptyFrame.cell); targets.add(emptyFrame.date); }
      if (source) {
        for (const element of [source.cell, source.card, source.title, source.titleRow, source.sub, source.subRow, source.date]) targets.add(element);
        // The poster's fixed logical canvas can change painted scale while
        // its own layout width stays1840px. Observe the real fit ancestors.
        for (let ancestor: HTMLElement | null = source.card.parentElement; ancestor && host?.contains(ancestor); ancestor = ancestor.parentElement) targets.add(ancestor);
      }
      for (const element of observed) if (!targets.has(element)) { resize?.unobserve(element); observed.delete(element); }
      for (const element of targets) if (!observed.has(element)) { resize?.observe(element); observed.add(element); }
    };
    function schedule() {
      if (!stopped && !frame) frame = requestAnimationFrame(apply);
    }
    const host = root?.current;
    const mutation = enabled && host && typeof MutationObserver !== "undefined" ? new MutationObserver(schedule) : null;
    // Root topology changes (calendar / agenda / preview) are layout data.
    // Never observe preview descendants or inspect changed text records.
    mutation?.observe(host!, { attributes: true, attributeFilter: ["class", "style", "hidden"] });
    window.addEventListener("resize", schedule);
    host?.addEventListener("transitionend", schedule, true);
    document.fonts?.addEventListener("loadingdone", schedule);
    schedule();
    return () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation?.disconnect();
      window.removeEventListener("resize", schedule);
      host?.removeEventListener("transitionend", schedule, true);
      document.fonts?.removeEventListener("loadingdone", schedule);
    };
  }, [root, enabled, textPx, fontId, weight]);
  return metrics;
}
