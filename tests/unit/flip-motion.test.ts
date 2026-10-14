import { expect, it } from "vitest";
import { flipSpring } from "@/lib/ui/flip-motion";

it("finishes FLIP only on its own transform, not a child's live ring or its own opacity", () => {
  const node = new EventTarget();
  const style = { transition: "", transform: "", transformOrigin: "" };
  Object.assign(node, { style, offsetWidth: 200 });
  const el = node as unknown as HTMLElement;
  flipSpring(el, "scale(.2)", { ms: 1000, origin: "top left" });
  const end = (target: EventTarget, propertyName: string) => {
    const event = new Event("transitionend");
    Object.defineProperties(event, { target: { value: target }, propertyName: { value: propertyName } });
    node.dispatchEvent(event);
  };
  end(new EventTarget(), "stroke-dashoffset");
  expect(style.transition).toContain("1000ms");
  end(node, "opacity");
  expect(style.transition).toContain("1000ms");
  end(node, "transform");
  expect(style.transition).toBe("");
  expect(style.transformOrigin).toBe("");
});
