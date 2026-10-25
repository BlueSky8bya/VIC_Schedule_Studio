"use client";

import { useCallback, useEffect, useRef } from 'react';
import type { PublicScheduleEvent } from '@/lib/domain/schedule-types';
import { readPublicMonth, type PublicMonth } from './public-month-link';
import { publicEventForMonth, readPublicEventId } from './public-event-link';

/** Resolve an address only against the already sanitized public schedule. */
export function usePublicEventLink(enabled: boolean, view: PublicMonth, events: PublicScheduleEvent[], detailId: string | null,
  open: (event: PublicScheduleEvent, dateKey: string) => void, close: () => void) {
  const callbacks = useRef({ open, close });
  callbacks.current = { open, close };
  const processed = useRef<string | null>(null), incoming = useRef<string | null>(null), previous = useRef<string | null>(null), dismissed = useRef<string | null>(null);
  const read = useCallback(() => {
    if (!enabled) return;
      const url = new URL(window.location.href), month = readPublicMonth(url), id = readPublicEventId(url);
      if (!id || !month) return;
      if (month.year !== view.year || month.month !== view.month || processed.current === url.href) return;
      const found = publicEventForMonth(events, id, month);
      if (found) { processed.current = url.href; incoming.current = id; dismissed.current = null; callbacks.current.open(found.event, found.dateKey); }
  }, [enabled, view.year, view.month, events]);
  useEffect(() => { read(); }, [read]);
  useEffect(() => {
    if (enabled && incoming.current && previous.current === incoming.current && detailId !== previous.current) {
      const url = new URL(window.location.href);
      if (readPublicEventId(url) === incoming.current) {
        url.searchParams.delete('event');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        processed.current = window.location.href;
      }
      dismissed.current = incoming.current;
      incoming.current = null;
    }
    previous.current = detailId;
  }, [enabled, detailId]);
  // The poster's existing single pop owner knows whether this is an overlay
  // close/echo. Never revive a dismissed incoming detail from its older entry.
  return useCallback((preserveOverlay: boolean) => {
    if (!enabled) return;
    if (preserveOverlay) {
      const url = new URL(window.location.href);
      if (!incoming.current && dismissed.current && readPublicEventId(url) === dismissed.current) {
        url.searchParams.delete('event');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        processed.current = window.location.href;
      }
      return;
    }
    processed.current = null;
    if (incoming.current) { incoming.current = null; callbacks.current.close(); }
    read();
  }, [enabled, read]);
}
