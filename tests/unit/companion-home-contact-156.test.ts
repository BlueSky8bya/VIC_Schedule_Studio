import { describe, expect, it } from "vitest";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { nativeHomeControlContactBefore, type ContactPaint, type ContactRect, type NativeHomeControlFrame } from "../visual/helpers/companion-home-contact-156";

const pose = companionSpriteMetadata.rows[1][2], src = companionSpriteMetadata.atlases[companionSpriteMetadata.frames[pose].atlas].src;
const painted = (rect: ContactRect): ContactPaint => ({ rect, visible: true });
function positive(kind: "light" | "tv" = "light"): NativeHomeControlFrame[] {
  return [0, 40, 300, 350].map(at => {
    const touching = at === 300, height = kind === "light" && touching ? 73 : 70;
    const paint = { x: 100, y: 20, width: 52, height }, handle = { x: 100 + 52 * (.5 + 334 / 1024), y: 20 + height - 52 * (18 + 132) / 1024, width: 52 * 80 / 1024, height: 52 * 132 / 1024 };
    return { at, control: {
      actor: { ...painted({ x: 100, y: 80, width: 92, height: 92 }), decoded: true, pose, src: "https://fixture.invalid" + src, platform: "companion-home-floor", reach: touching ? kind : "" },
      tool: { ...painted({ x: 130 + 60 * .36 - 9, y: 110 + 60 * .5 - 8, width: 18, height: 18 }), visible: touching && kind === "tv" },
      lamp: { button: painted({ x: 100, y: 20, width: 52, height: 72 }), paint: painted(paint), handle: painted(handle), touch: touching && kind === "light", state: "off", requestedPull: touching && kind === "light" ? 3 : 0, cssWidth: 52,
        art: { ...painted(paint), source: "url(\"https://fixture.invalid/companion/home/155/lamp-off.webp\")" },
        feedback: { ...painted(paint), source: "url(\"https://fixture.invalid/companion/home/155/lamp-off.webp\")", visible: touching && kind === "light", opacity: touching && kind === "light" ? 1 : 0, clip: "polygon(84% 11px,94% 11px,94% 100%,81% 100%)" } },
      tv: { ...painted({ x: 130, y: 110, width: 60, height: 60 }), decoded: true, src: "https://fixture.invalid/companion/home/136/tv-body.webp" },
    } };
  });
}
const contact = (frames: NativeHomeControlFrame[]) => frames.find(frame => frame.at === 300)!;
const observe = (frames: NativeHomeControlFrame[], kind: "light" | "tv" = "light", at = 350) => nativeHomeControlContactBefore(frames, at, kind);

describe("156 actual155 lamp cord and matching native TV contact witness", () => {
  it("requires the actual registered visible cord tug and decoded nearby physical light reach", () => {
    expect(observe(positive())).toMatchObject({ at: 300, kind: "light", pose, measuredPull: 3, neutralAt: 40 });
  });
  it("keeps the TV painted sparkle at the actual registered CRT point", () => {
    expect(observe(positive("tv"), "tv")).toMatchObject({ at: 300, kind: "tv", pose });
  });
  it("accepts the same physical evidence on the on artwork and a numbered genuine floor", () => {
    const frames = positive(); for (const frame of frames) { frame.control.actor.platform = "companion-home-floor-12"; frame.control.lamp.state = "on"; frame.control.lamp.art.source = frame.control.lamp.feedback.source = "/companion/home/155/lamp-on.webp"; }
    expect(observe(frames)).toBeDefined();
  });
  it("normalizes measured painted tug through shell zoom and ignores whole-room translation", () => {
    const frames = positive();
    for (const frame of frames) for (const paint of [frame.control.actor, frame.control.tool, frame.control.lamp.button, frame.control.lamp.paint, frame.control.lamp.handle, frame.control.lamp.art, frame.control.lamp.feedback, frame.control.tv]) if (paint.rect) paint.rect = { x: paint.rect.x * .75 + frame.at, y: paint.rect.y * .75 - frame.at, width: paint.rect.width * .75, height: paint.rect.height * .75 };
    expect(observe(frames)).toMatchObject({ measuredPull: 3 });
  });
  it("preserves the exact650ms inclusive prior-contact window", () => {
    expect(observe(positive(), "light", 950)).toBeDefined(); expect(observe(positive(), "light", 950.001)).toBeUndefined();
    expect(observe(positive(), "light", 299.999)).toBeUndefined();
  });
  it.each(["missing-control", "undecoded", "hidden-actor", "unknown-pose", "wrong-pose-source", "no-source", "remote-actor", "invalid-actor-rect", "sofa", "body-only-pad400", "outside-floor", "wrong-reach", "missing-reach", "no-runtime-touch", "hover-only", "no-requested-pull", "no-physical-tug", "overextended-tug", "hidden-handle", "wrong-handle", "hidden-art", "wrong-art-source", "wrong-active-art", "wrong-feedback-source", "no-feedback", "faint-feedback", "no-cord-clip", "wrong-feedback-geometry", "sparkle-instead-of-cord", "missing-neutral", "one-neutral-frame", "unstable-neutral", "resized-house", "invalid-time", "duplicate-time", "reverse-time"] as const)("rejects lamp %s", defect => {
    let frames = positive(); const frame = contact(frames), facts = frame.control, lamp = facts.lamp;
    if (defect === "missing-control") delete (frame as Partial<NativeHomeControlFrame>).control;
    if (defect === "undecoded") facts.actor.decoded = false;
    if (defect === "hidden-actor") facts.actor.visible = false;
    if (defect === "unknown-pose") facts.actor.pose = -1;
    if (defect === "wrong-pose-source") facts.actor.src = "/companion/home/155/lamp-off.webp";
    if (defect === "no-source") facts.actor.src = "";
    if (defect === "remote-actor") facts.actor.rect!.x += 1000;
    if (defect === "invalid-actor-rect") facts.actor.rect!.width = Number.NaN;
    if (defect === "sofa") facts.actor.platform = "companion-home";
    if (defect === "body-only-pad400") facts.actor.platform = "companion-home-floor-400";
    if (defect === "outside-floor") facts.actor.platform = "date-20";
    if (defect === "wrong-reach") facts.actor.reach = "tv";
    if (defect === "missing-reach") facts.actor.reach = "";
    if (defect === "no-runtime-touch") lamp.touch = false;
    if (defect === "hover-only") { lamp.touch = false; lamp.requestedPull = 1.5; }
    if (defect === "no-requested-pull") lamp.requestedPull = 0;
    if (defect === "no-physical-tug") { lamp.paint.rect!.height = 70; lamp.art.rect!.height = 70; lamp.feedback.rect!.height = 70; lamp.handle.rect!.y -= 3; }
    if (defect === "overextended-tug") { lamp.paint.rect!.height = 78; lamp.art.rect!.height = 78; lamp.feedback.rect!.height = 78; lamp.handle.rect!.y += 5; }
    if (defect === "hidden-handle") lamp.handle.visible = false;
    if (defect === "wrong-handle") lamp.handle.rect!.x += 8;
    if (defect === "hidden-art") lamp.art.visible = false;
    if (defect === "wrong-art-source") lamp.art.source = "/wrong.webp";
    if (defect === "wrong-active-art") lamp.state = "on";
    if (defect === "wrong-feedback-source") lamp.feedback.source = "/wrong.webp";
    if (defect === "no-feedback") lamp.feedback.visible = false;
    if (defect === "faint-feedback") lamp.feedback.opacity = .05;
    if (defect === "no-cord-clip") lamp.feedback.clip = "none";
    if (defect === "wrong-feedback-geometry") lamp.feedback.rect = { ...lamp.feedback.rect!, x: 500 };
    if (defect === "sparkle-instead-of-cord") facts.tool.visible = true;
    if (defect === "missing-neutral") for (const candidate of frames) candidate.control.lamp.requestedPull = 3;
    if (defect === "one-neutral-frame") frames = frames.filter(candidate => candidate.at !== 0);
    if (defect === "unstable-neutral") frames[0].control.lamp.paint.rect = { ...frames[0].control.lamp.paint.rect!, height: 69 };
    if (defect === "resized-house") for (const candidate of frames.slice(0, 2)) candidate.control.lamp.button.rect!.height += 8;
    if (defect === "invalid-time") frame.at = Number.NaN;
    if (defect === "duplicate-time") frame.at = 40;
    if (defect === "reverse-time") frames.reverse();
    expect(observe(frames)).toBeUndefined();
  });
  it.each(["no-sparkle", "remote-sparkle", "wrong-kind", "cord-only", "hidden-tv", "undecoded-tv", "wrong-tv-source", "remote-actor"] as const)("rejects TV %s", defect => {
    const frames = positive("tv"), facts = contact(frames).control;
    if (defect === "no-sparkle") facts.tool.visible = false;
    if (defect === "remote-sparkle") facts.tool.rect!.x += 15;
    if (defect === "wrong-kind") facts.actor.reach = "light";
    if (defect === "cord-only") { facts.tool.visible = false; facts.lamp.touch = true; }
    if (defect === "hidden-tv") facts.tv.visible = false;
    if (defect === "undecoded-tv") facts.tv.decoded = false;
    if (defect === "wrong-tv-source") facts.tv.src = "/companion/home/155/lamp-off.webp";
    if (defect === "remote-actor") facts.actor.rect!.x += 1000;
    expect(observe(frames, "tv")).toBeUndefined();
  });
  it("does not reuse the other control's contact or a future contact", () => {
    expect(observe(positive("tv"), "light")).toBeUndefined(); expect(observe(positive(), "tv")).toBeUndefined(); expect(observe(positive(), "light", 299)).toBeUndefined();
  });
});
