import './clear-event-tags.css';

export function ClearEventTags({ disabled, onClear }: { disabled: boolean; onClear: () => void }) {
  return <button aria-label="현재 일정의 태그 선택 비우기" className="event-tags-clear" data-act="editor-tags-clear" disabled={disabled} onClick={onClear} type="button">선택 비우기</button>;
}
