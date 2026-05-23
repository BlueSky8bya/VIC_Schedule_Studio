"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MemoResult } from "@/lib/schedules/memo-actions";

type MemoEditorProps = {
  initialMemo: string;
  updateMemoAction: (memo: string) => Promise<MemoResult>;
};

function toLines(memo: string): string[] {
  const lines = memo.split("\n");
  return lines.length > 0 ? lines : [""];
}

export function MemoEditor({ initialMemo, updateMemoAction }: MemoEditorProps) {
  const router = useRouter();
  const [lines, setLines] = useState<string[]>(() => toLines(initialMemo));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const joined = lines.join("\n");

  function update(index: number, value: string) {
    setLines((cur) => cur.map((l, i) => (i === index ? value : l)));
    setSaved(false);
  }
  function addLine() {
    setLines((cur) => [...cur, ""]);
    setSaved(false);
  }
  function removeLine(index: number) {
    setLines((cur) => (cur.length <= 1 ? [""] : cur.filter((_, i) => i !== index)));
    setSaved(false);
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      // 빈 줄은 정리해서 저장
      const cleaned = lines.map((l) => l.trim()).filter((l) => l.length > 0).join("\n");
      const result = await updateMemoAction(cleaned);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="memo-editor">
      <div className="memo-lines">
        {lines.map((line, index) => (
          <div className="memo-line" key={index}>
            <textarea
              onChange={(e) => update(index, e.target.value.replace(/\n/g, " "))}
              placeholder={`${index + 1}번째 메모`}
              rows={2}
              value={line}
            />
            <button
              aria-label="줄 삭제"
              className="line-remove"
              onClick={() => removeLine(index)}
              type="button"
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
        ))}
      </div>
      {error ? <div className="auth-warning">{error}</div> : null}
      <div className="memo-actions">
        <button className="button" onClick={addLine} type="button">
          <Plus aria-hidden="true" size={15} />추가
        </button>
        <button
          className="button primary"
          disabled={pending || joined === initialMemo}
          onClick={save}
          type="button"
        >
          {pending ? "저장 중…" : saved ? "저장됨" : "저장"}
        </button>
      </div>
    </div>
  );
}
