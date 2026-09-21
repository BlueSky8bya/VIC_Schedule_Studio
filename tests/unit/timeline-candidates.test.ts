import { describe, expect, it } from "vitest";
import { buildTimelineCandidates, type SourceComment } from "@/lib/broadcast/timeline-candidates";
import { publicTimelineProjection } from "@/lib/broadcast/timeline-public";

const overview = "타임라인\n[게임]\n00:01 시작\n05:00 중간\n09:50 끝";
const root = (id: number, text = overview): SourceComment => ({ p_comment_no: id, user_id: `user-${id}`, user_nick: "같은닉", comment: text });
describe("independent fan timelines", () => {
  it("preserves competing full timelines instead of blending labels", () => {
    const list = buildTimelineCandidates([root(1), root(2, overview.replace("중간", "전투"))], 600);
    expect(list).toHaveLength(2);
    expect(list.every((c) => c.eligible)).toBe(true);
    expect(list[0].entries[1].label).toBe("중간");
    expect(list[1].entries[1].label).toBe("전투");
  });
  it("joins same-author replies, inherits section, accepts a one-entry continuation", () => {
    const r = root(1, "[게임]\n00:01 시작\n05:00 중간");
    r.replies = [
      { p_comment_no: 1, c_comment_no: 100, user_id: "user-1", user_nick: "새닉", comment: "09:50 끝" },
      { p_comment_no: 1, c_comment_no: 101, user_id: "someone-else", user_nick: "같은닉", comment: "02:00 개인 메모" }
    ];
    const list = buildTimelineCandidates([r], 600);
    expect(list[0].entries).toHaveLength(3);
    expect(list[0].entries[2].section).toBe("게임");
    expect(list[0].sourceCommentNos).toEqual(["root:1", "reply:100"]);
    expect(list[1].entries).toHaveLength(1);
    expect(list[1].eligible).toBe(false);
    expect(JSON.stringify(list)).not.toContain("user-1");
    expect(JSON.stringify(list)).not.toContain("someone-else");
  });
  it("does not infer identical authors from identical nicknames or missing IDs", () => {
    const r = root(1); delete r.user_id;
    r.replies = [{ p_comment_no: 1, c_comment_no: 1, user_nick: "같은닉", comment: "09:59 추가" }];
    expect(buildTimelineCandidates([r], 600)).toHaveLength(2);
  });
  it("removes exact duplicates only, preserves different descriptions at the same time", () => {
    const r = root(1, "00:01 A\n00:01 A\n00:01 B\n99:59 잘못된시각");
    const [c] = buildTimelineCandidates([r], 600);
    expect(c.entries.map((e) => e.label)).toEqual(["A", "B"]);
    expect(c.reason).toBe("short");
  });
  it("keeps feedback and densely timestamped short sections out of automatic overview selection", () => {
    expect(buildTimelineCandidates([root(1, "플레이 피드백\n" + overview)], 600)[0].reason).toBe("feedback");
    const many = Array.from({ length: 30 }, (_, i) => `00:${String(i).padStart(2, "0")} 메모`).join("\n");
    const list = buildTimelineCandidates([root(1, many), root(2)], 600);
    expect(list[0].key).toBe("root:2");
    expect(list.find((c) => c.key === "root:1")?.eligible).toBe(false);
  });
  it("retains separate roots from one author as independent templates", () => {
    const r = root(2); r.user_id = "user-1";
    expect(buildTimelineCandidates([root(1), r], 600)).toHaveLength(2);
  });
  it("keeps a reply author's key stable after deleting their first reply", () => {
    const r = root(1);
    r.replies = [
      { p_comment_no: 1, c_comment_no: 101, user_id: "contributor", comment: "00:10 A" },
      { p_comment_no: 1, c_comment_no: 102, user_id: "contributor", comment: "00:20 B" }
    ];
    const before = buildTimelineCandidates([r], 600).find((c) => c.key.startsWith("reply:"))!.key;
    r.replies.shift();
    expect(buildTimelineCandidates([r], 600).find((c) => c.key.startsWith("reply:"))!.key).toBe(before);
  });
  it("accepts numeric-string source IDs without losing continuations", () => {
    const r = root(1, "00:01 A\n05:00 B"); r.p_comment_no = "1";
    r.replies = [{ p_comment_no: "1", c_comment_no: "100", user_id: "user-1", comment: "09:59 C" }];
    expect(buildTimelineCandidates([r], 600)[0].entries).toHaveLength(3);
  });
  it("public DTO cannot expose identities, source lists, quality or moderation", () => {
    const sensitive = { user_id: "secret-user", visibility: "hide", source_comment_nos: [1], score: 700 };
    const entry = { sec: 10, label: "Scene", section: null, ...sensitive };
    const dto = publicTimelineProjection({ author_nick: "Fan", entries: [entry], ...sensitive,
      variants: [{ id: "root:1", authorNick: "Fan", entries: [entry], ...sensitive }] });
    expect(dto?.variants).toHaveLength(1);
    for (const key of Object.keys(sensitive)) expect(JSON.stringify(dto)).not.toContain(key);
  });
});
