import { describe, expect, it } from "vitest";
import { deriveChatFileFromThumb } from "@/lib/broadcast/vod-chat";

describe("subscriber replay chat source (0156)", () => {
  it("maps the thumbnail file rowKey (_r) to the chat rowKey (_c)", () => {
    const thumb = "//videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=20261022_B35CD6BE_298029243_2_r&column=2&t=1";
    expect(deriveChatFileFromThumb(thumb, 43_999_834)).toEqual([
      { chat: "https://videoimg.sooplive.co.kr/php/ChatLoadSplit.php?rowKey=20261022_B35CD6BE_298029243_2_c", durationSec: 43_999.834 }
    ]);
  });
  it("refuses uploads, malformed keys and impossible durations", () => {
    expect(deriveChatFileFromThumb("//iflv14.sooplive.com/save/thumb/1_R_7.jpg", 1000)).toBeNull();
    expect(deriveChatFileFromThumb("rowKey=20261022_B35CD6BE_298029243_2_r", 0)).toBeNull();
    expect(deriveChatFileFromThumb("rowKey=20261022_B35CD6BE_298029243_2_r", 8 * 86400_000)).toBeNull();
    expect(deriveChatFileFromThumb(null, 1000)).toBeNull();
  });
});
