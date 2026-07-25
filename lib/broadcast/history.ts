export const BROADCAST_HISTORY_LIMIT = 200;

export type BroadcastHistory<T> = {
  push: (action: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  sizes: () => { undo: number; redo: number };
};

/**
 * 판서의 획·카드·날짜·레이어를 한 순서로 관리하는 단일 히스토리.
 * 오래된 액션은 장면을 지우지 않고 undo 대상에서만 빠진다.
 */
export function createBroadcastHistory<T>(
  limit: number = BROADCAST_HISTORY_LIMIT
): BroadcastHistory<T> {
  const cap = Math.max(1, Math.floor(limit));
  let undoStack: T[] = [];
  let redoStack: T[] = [];

  return {
    push(action) {
      undoStack.push(action);
      if (undoStack.length > cap) undoStack.splice(0, undoStack.length - cap);
      redoStack = [];
    },
    undo() {
      const action = undoStack.pop();
      if (action === undefined) return null;
      redoStack.push(action);
      return action;
    },
    redo() {
      const action = redoStack.pop();
      if (action === undefined) return null;
      undoStack.push(action);
      return action;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clear() {
      undoStack = [];
      redoStack = [];
    },
    sizes: () => ({ undo: undoStack.length, redo: redoStack.length })
  };
}
