import { describe, expect, it } from "vitest";
import { getPublicSchedule } from "@/lib/schedules/public-loader";

const forbiddenPrivateKeys = [
  "privateTitle",
  "privateNotes",
  "codename",
  "embargoUntil",
  "editorNote",
  "workState",
  "privateMeta"
];

describe("public schedule DTO", () => {
  it("does not expose private schedule fields", async () => {
    const schedule = await getPublicSchedule("vic");
    const payload = JSON.stringify(schedule);

    for (const key of forbiddenPrivateKeys) {
      expect(payload).not.toContain(key);
    }
  });
});
