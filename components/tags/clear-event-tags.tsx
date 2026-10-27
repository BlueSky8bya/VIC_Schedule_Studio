import './clear-event-tags.css';
import { ArrowLeftRight } from 'lucide-react';

export function ClearEventTags({ disabled, onClear }: { disabled: boolean; onClear: () => void }) {
  return <button aria-label="현재 일정의 태그 선택 비우기" className="event-tags-clear" data-act="editor-tags-clear" disabled={disabled} onClick={onClear} type="button">선택 비우기</button>;
}

export function EventTagActions({ disabled, canSwap, onSwap, onClear }: { disabled: boolean; canSwap: boolean; onSwap: () => void; onClear: () => void }) {
  return <span className="event-tags-actions">
    {canSwap ? <button aria-label="앞의 두 콘텐츠 색 순서 교환" className="event-tags-swap" data-act="editor-tags-swap" disabled={disabled} onClick={onSwap} onKeyDown={e => { if (e.key === ' ') e.stopPropagation(); }} title="앞의 두 콘텐츠 색 순서 교환" type="button"><ArrowLeftRight aria-hidden="true" size={14} /></button> : null}
    <ClearEventTags disabled={disabled} onClear={onClear} />
  </span>;
}
