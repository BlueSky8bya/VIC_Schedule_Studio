import { describe, expect, it } from "vitest";
import { wrapFadeStyle } from "@/lib/calendar/month";

// 토→일 줄바뀜 = 색으로만(2026-11-19): 카드 자신의 배경 그라데이션이 맞닿은 끝 14px만 옅어진다(마스크·덧층 없음).
// 2026-11-20 밤: 끝까지 0%로 녹이면 잘려 보이고 위아래 선까지 녹이면 가늘어 보였다 → 칠은 끝에서도 55% 남고, 위아래 선은 끝까지 그대로.
const blue = { key: "b", bgColor: "#2f63d6", borderColor: "#1f49a8", textColor: "#fff" } as never;
const pink = { key: "p", bgColor: "#f08cb0", borderColor: "#d8668f", textColor: "#222" } as never;
const lineOf = (img: string) => img.split("linear-gradient").find((g) => g.includes("#1f49a8"))!;

describe("wrapFadeStyle", () => {
  it("does nothing for a card without a Sat→Sun joined end", () => {
    expect(wrapFadeStyle([blue], null, { left: false, right: false })).toBeNull();
  });
  it("Saturday piece: the fill softens (not vanishes) over the last 14px on the right; the border line runs solid to the edge; veil on top", () => {
    const s = wrapFadeStyle([blue], null, { left: false, right: true })!;
    expect(s.backgroundColor).toBe("transparent");
    expect(s.borderColor).toBe("transparent");
    const img = String(s.backgroundImage);
    expect(img.startsWith("var(--card-veil")).toBe(true);
    expect(img).toContain(") calc(100% - 14px)"); // 여기까지 제 색(글자 밑 칠 100%)
    expect(img).toContain(" 55%, transparent) 100%"); // 맞닿은 끝도 몸통은 남는다
    expect(img).not.toContain(" 0%, transparent)"); // 끝이 바탕으로 사라지지 않는다
    expect(img).not.toContain("transparent) 0px"); // 왼쪽은 그대로 진하다
    expect(lineOf(img)).not.toContain("transparent"); // 위아래 선은 녹지 않아 높이가 그대로
    expect(s.backgroundClip).toBe("padding-box, padding-box, border-box");
  });
  it("Sunday piece mirrors it on the left", () => {
    const img = String(wrapFadeStyle([blue], null, { left: true, right: false })!.backgroundImage);
    expect(img).toContain(" 55%, transparent) 0px");
    expect(img).toContain(" 14px");
    expect(img).not.toContain("calc(100% - 14px)");
    expect(lineOf(img)).not.toContain("transparent");
  });
  it("the fade curve rises monotonically from 55% at the joined edge toward the text", () => {
    const img = String(wrapFadeStyle([blue], null, { left: true, right: false })!.backgroundImage);
    const fill = img.split("linear-gradient").find((g) => g.includes("#2f63d6") && g.includes("0px"))!;
    const alphas = [...fill.matchAll(/ (\d+)%, transparent\) (\d+)px/g)].map((m) => [Number(m[2]), Number(m[1])]);
    expect(alphas[0]).toEqual([0, 55]);
    for (let i = 1; i < alphas.length; i++) expect(alphas[i][1]).toBeGreaterThan(alphas[i - 1][1]);
  });
  it("two-tone card: the run gradient is re-cut to this cell (last cell of a 2-day run = second colour at the edge)", () => {
    const s = wrapFadeStyle([blue, pink], { index: 1, length: 2 }, { left: false, right: true })!;
    const img = String(s.backgroundImage);
    expect(s.backgroundSize).toBe("100% 100%");
    expect(img).toContain("in srgb, light-dark(#f08cb0"); // 오른쪽 끝 = 둘째 색이 옅어진다
    // 날아가는 사본용 원래 칠(옅어짐 없음)
    expect(String((s as Record<string, unknown>)["--wrap-base-fill"])).not.toContain("transparent)");
  });
});
