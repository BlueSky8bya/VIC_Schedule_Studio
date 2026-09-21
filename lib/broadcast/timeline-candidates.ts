import { parseTimeline, decodeHtmlEntities, type TimelineEntry } from "./timeline-parser";
import { createHash } from "node:crypto";

export type SourceComment = {
  p_comment_no?: number | string;
  c_comment_no?: number | string;
  c_comment_cnt?: number | string;
  user_id?: string;
  user_nick?: string;
  comment?: string;
  replies?: SourceComment[];
};
export type TimelineCandidate = {
  key: string;
  rootCommentNo: number;
  sourceCommentNos: string[];
  authorNick: string;
  entries: TimelineEntry[];
  eligible: boolean;
  reason: "overview" | "short" | "focused" | "feedback";
  score: number;
};

/** Identity lives only in this invocation. Never persist IDs, IPs or unrelated comment text. */
export function buildTimelineCandidates(comments: SourceComment[], durationSec: number): TimelineCandidate[] {
  const candidates: TimelineCandidate[] = [];
  for (const root of comments) {
    const rootNo = Number(root.p_comment_no);
    if (!Number.isSafeInteger(rootNo) || rootNo <= 0) continue;
    const groups = new Map<string, SourceComment[]>();
    const identity = (c: SourceComment) => c.user_id ? `user:${c.user_id}` : c === root ? `root:${rootNo}` : `reply:${c.c_comment_no}`;
    groups.set(identity(root), [root]);
    for (const reply of [...(root.replies ?? [])].sort((a, b) => Number(a.c_comment_no) - Number(b.c_comment_no))) {
      if (!Number.isSafeInteger(Number(reply.c_comment_no)) || Number(reply.c_comment_no) <= 0) continue;
      const key = identity(reply);
      groups.set(key, [...(groups.get(key) ?? []), reply]);
    }
    for (const parts of groups.values()) {
      // Concatenation preserves section headers across same-author continuation boundaries.
      const text = parts.map((p) => typeof p.comment === "string" ? p.comment : "").join("\n");
      const seen = new Set<string>();
      const entries = parseTimeline(text).filter((e) => {
        if (!(durationSec > 0) || e.sec > durationSec) return false;
        const key = `${e.sec}:${e.label.normalize("NFKC").replace(/\s+/g, " ").trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!entries.length) continue;
      const span = (entries.at(-1)!.sec - entries[0].sec) / durationSec;
      const bins = new Set(entries.map((e) => Math.min(5, Math.floor(e.sec / durationSec * 6)))).size;
      const preamble = text.split(/\d{1,2}:\d{1,2}/, 1)[0];
      const feedback = /피드백|훈수|개선점|feedback|플레이\s*조언/i.test(preamble);
      const reason = feedback ? "feedback" : entries.length < 3 ? "short" : span < 0.35 || bins < 3 ? "focused" : "overview";
      const first = parts[0];
      candidates.push({
        // Hash differs across root threads; survives first-reply deletion without storing the raw ID.
        key: first === root ? `root:${rootNo}` : `reply:${rootNo}:${first.user_id
          ? createHash("sha256").update(`${rootNo}\0${first.user_id}`).digest("hex").slice(0, 24)
          : first.c_comment_no}`,
        rootCommentNo: rootNo,
        sourceCommentNos: parts.map((p) => p === root ? `root:${rootNo}` : `reply:${p.c_comment_no}`),
        authorNick: decodeHtmlEntities(first.user_nick ?? ""),
        entries,
        eligible: reason === "overview",
        reason,
        score: Math.round(bins * 100 + span * 100 + Math.min(10, new Set(entries.map((e) => e.section).filter(Boolean)).size) * 2 + Math.log2(entries.length + 1))
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}
