"use client";

import { useState } from 'react';
import { publicEventHref } from '@/lib/ui/public-event-link';
import { hapticTick } from '@/lib/ui/haptics';

export function PublicEventShare({ id, dateKey }: { id: string; dateKey: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [manual, setManual] = useState('');
  async function copy() {
    const href = publicEventHref(window.location.origin, { year: Number(dateKey.slice(0, 4)), month: Number(dateKey.slice(5, 7)) }, id);
    if (!href) return;
    try { await navigator.clipboard.writeText(href); setState('copied'); hapticTick(); }
    catch { setManual(href); setState('manual'); }
  }
  return <div className="public-event-share">
    <button className="button" data-act="share-public-event" onClick={copy} type="button">{state === 'copied' ? '복사됨' : '일정 링크 복사'}</button>
    {state === 'copied' ? <span role="status">이 일정을 바로 여는 링크를 복사했어요.</span> : null}
    {state === 'manual' ? <label><span role="status">자동 복사가 차단됐어요. 주소를 선택해 복사해주세요.</span><input aria-label="수동 복사용 일정 주소" onFocus={event => event.currentTarget.select()} readOnly value={manual} /></label> : null}
  </div>;
}
