'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FONT_BASE, FONT_OPTIONS } from '@/lib/ui/font-prefs';
import { loadUiFont } from '@/lib/ui/font-loading';

type FontStatus = 'loading' | 'ready' | 'error';
export function useFontLoading(onCommit: (id: string) => void) {
  const [status, setStatus] = useState<Record<string, FontStatus>>({ [FONT_BASE]: 'ready' });
  const [requested, setRequested] = useState<string | null>(null);
  const statuses = useRef(status), pending = useRef(new Map<string, Promise<boolean>>()), alive = useRef(true), selection = useRef(0), commit = useRef(onCommit);
  const invalidateSelection = useCallback(() => { selection.current++; }, []);
  useLayoutEffect(() => { commit.current = onCommit; });
  useEffect(() => { alive.current = true; return () => { alive.current = false; invalidateSelection(); }; }, [invalidateSelection]);
  const mark = useCallback((id: string, value: FontStatus) => {
    if (!alive.current) return;
    statuses.current = { ...statuses.current, [id]: value }; setStatus(statuses.current);
  }, []);
  const ensure = useCallback((id: string, retry = false): Promise<boolean> => {
    if (statuses.current[id] === 'ready') return Promise.resolve(true);
    const running = pending.current.get(id); if (running) return running;
    const option = FONT_OPTIONS.find(f => f.id === id); if (!option) return Promise.resolve(false);
    mark(id, 'loading');
    const work = loadUiFont(option, { retry, isCurrent: () => alive.current }).then(() => { mark(id, 'ready'); return true; }, () => { mark(id, 'error'); return false; }).finally(() => { pending.current.delete(id); });
    pending.current.set(id, work); return work;
  }, [mark]);
  const cancelSelection = useCallback(() => { selection.current++; setRequested(null); }, []);
  const select = useCallback(async (id: string) => {
    const ticket = ++selection.current;
    setRequested(id);
    const ready = await ensure(id, statuses.current[id] === 'error');
    if (alive.current && selection.current === ticket) {
      setRequested(null);
      if (ready) commit.current(id);
    }
  }, [ensure]);
  return { status, ensure, select, cancelSelection, requested };
}
