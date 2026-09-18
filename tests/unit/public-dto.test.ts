import { describe, expect, it } from "vitest";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { deriveDarkTagColors, readDarkTagColors } from "@/lib/tags/dark-palette";

const forbiddenPrivateKeys = [
  "privateTitle",
  "privateMemo",
  "codename",
  "embargoUntil",
  "editorNote",
  "workState",
  "privateMeta",
  "owner_private",
  "embargo",
  "work"
];

describe("public schedule DTO", () => {
  it("only exposes validated visual metadata from saved dark palette JSON", () => {
    const colors = deriveDarkTagColors("#fa8072");
    const output = readDarkTagColors({ ...colors, privateMemo: "secret", owner_private: true }, colors.source);
    expect(Object.keys(output).sort()).toEqual(["version", "source", "bgColor", "borderColor", "textColor", "accentColor"].sort());
    expect(output).toEqual(colors);
    expect(readDarkTagColors({ ...colors, textColor: "url(secret)" }, colors.source)).toEqual(colors);
  });
  it("does not expose private schedule fields", async () => {
    const schedule = await getPublicSchedule("vic");
    const payload = JSON.stringify(schedule);

    for (const key of forbiddenPrivateKeys) {
      expect(payload).not.toContain(key);
    }
  });
});
