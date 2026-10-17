import { describe, expect, it, vi } from "vitest";
import { latinToHangul, romajiToHangul } from "@/lib/search/xlit";

const first = (s: string) => latinToHangul(s)[0];

describe("영문 → 한글 읽기(자동 동의어)", () => {
  it("소유자 예시: Okey Dokey = 오키도키, Artist = 아티스트, WINNER = 위너, MINHO = 민호", () => {
    expect(first("Okey Dokey")).toBe("오키도키");
    expect(first("Artist")).toBe("아티스트");
    expect(first("WINNER")).toBe("위너");
    expect(first("MINHO")).toBe("민호");
  });

  it("영어 철자 규칙 — magic e·이중모음·r 탈락·자음군·어말 -en", () => {
    expect(first("Smiley")).toBe("스마일리");
    expect(first("Golden")).toBe("골든");
    expect(first("Blueming")).toBe("블루밍");
    expect(first("Whiplash")).toBe("위플래시");
    expect(first("Night Dancer")).toBe("나이트댄서");
    expect(first("Fantastic Baby")).toBe("팬태스틱베이비");
    expect(first("Love Dive")).toBe("러브다이브");
    expect(first("Feel Special")).toBe("필스페셜");
    expect(first("Tomboy")).toBe("톰보이");
    expect(first("Merry Christmas")).toBe("메리크리스트매스");
    expect(latinToHangul("Rose")).toContain("로즈");
    expect(latinToHangul("Magnetic")).toContain("마그네틱");
  });

  it("일본어 로마자는 음절표로 — YOASOBI·Yonezu Kenshi·Fujii Kaze", () => {
    expect(romajiToHangul("yoasobi")).toBe("요아소비");
    expect(first("Yonezu Kenshi")).toBe("요네즈켄시");
    expect(first("Fujii Kaze")).toBe("후지이카제");
    expect(romajiToHangul("kick")).toBeNull(); // 영어(자음 끝)는 로마자로 안 끊긴다
  });

  it("후보는 몇 개만, 한글 두 글자 미만·라틴 없는 구절은 버린다", () => {
    expect(latinToHangul("Okey Dokey").length).toBeLessThanOrEqual(4);
    expect(latinToHangul("아이유")).toEqual([]);
    expect(latinToHangul("x")).toEqual([]);
  });
});

describe("자동 동의어 행(xlitRows)", () => {
  it("한글 읽기 → 영문 정규화 한쪽만, 3글자 이하 영문은 건너뛴다", async () => {
    const { xlitRows } = await import("@/lib/search/xlit-sync");
    const rows = xlitRows([
      { latin: "Okey Dokey", norm: "okeydokey" },
      { latin: "Ado", norm: "ado" }
    ]);
    expect(rows[0]).toEqual({ term: "오키도키", alt: "okeydokey", source: "auto-xlit", kind: "syn" });
    expect(rows.some((r) => r.alt === "ado")).toBe(false);
  });
});

describe("checked xlit retry contract", () => {
  it.each(["pending", "upsert"])("distinguishes %s database failure from a successful empty dictionary", async (failure) => {
    const { syncXlitSynonymsChecked, syncXlitSynonyms } = await import("@/lib/search/xlit-sync");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const database = (empty = false) => ({
      rpc: () => ({ abortSignal: async () => ({ data: empty ? [] : [{ latin: "Golden", norm: "golden" }],
        error: !empty && failure === "pending" ? { message: "synthetic failure" } : null }) }),
      from: () => ({ upsert: () => ({ abortSignal: async () => ({ error: { message: "synthetic failure" } }) }) })
    }) as unknown as Parameters<typeof syncXlitSynonymsChecked>[0];
    expect(await syncXlitSynonymsChecked(database())).toEqual({ ok: false, count: 0 });
    expect(await syncXlitSynonyms(database())).toBe(0); // numeric legacy contract preserved
    expect(await syncXlitSynonymsChecked(database(true))).toEqual({ ok: true, count: 0 });
    warning.mockRestore();
  });
});
