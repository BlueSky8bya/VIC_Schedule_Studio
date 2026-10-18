import type { KeyboardEvent, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsSegment } from "@/components/shared/settings-controls";

const activity = vi.hoisted(() => vi.fn());
vi.mock("@/lib/activity/client", () => ({ logActivity: activity }));
type Element = ReactElement<Record<string, unknown>>;
const options = ["curious", "affectionate", "sleepy", "tidy", "mischievous", "gourmet", "performer", "homebody"].map(value => ({ value, label: value }));
const controls = (element: Element) => (element.props.children as unknown[]).flat().filter(child => child && typeof child === "object" && "props" in child && (child as Element).props.role === "radio") as Element[];
beforeEach(async () => { vi.stubGlobal("React", await import("react")); activity.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe("shared multiline SettingsSegment", () => {
  it("keeps the default single-row control and native keyboard clicks unchanged", () => {
    const change = vi.fn(), element = SettingsSegment({ value: "sleepy", options, onChange: change, ariaLabel: "성격", dataAct: "companion-personality" });
    expect(element.props["data-multiline"]).toBeUndefined();
    expect(element.props.style).toMatchObject({ "--n": 8, "--i": 2, "--rows": 1, "--row": 0 });
    expect(controls(element).every(control => control.props.onKeyDown === undefined && control.props.tabIndex === undefined)).toBe(true);
    (controls(element)[5].props.onClick as () => void)();
    expect(change).toHaveBeenCalledExactlyOnceWith("gourmet");
    expect(activity).not.toHaveBeenCalled(); // Existing document click delegation owns it.
  });

  it("positions the shared thumb by row and column with one selected tab stop", () => {
    const element = SettingsSegment({ value: "homebody", options, columns: 4, onChange: vi.fn(), ariaLabel: "성격", dataAct: "companion-personality" });
    expect(element.props["data-multiline"]).toBe(true);
    expect(element.props.style).toMatchObject({ "--n": 4, "--i": 3, "--rows": 2, "--row": 1 });
    expect(controls(element).map(control => control.props.tabIndex)).toEqual([-1, -1, -1, -1, -1, -1, -1, 0]);
    expect(controls(element).map(control => control.props["aria-checked"])).toEqual([false, false, false, false, false, false, false, true]);
  });

  it("moves through the same row-major choices with arrows and Home/End and emits only a changed fixed value", () => {
    const focus = options.map(() => ({ focus: vi.fn() })), change = vi.fn();
    let value = "curious";
    const press = (index: number, key: string) => {
      const element = SettingsSegment({ value, options, columns: 4, onChange: next => { value = next; change(next); }, ariaLabel: "성격", dataAct: "companion-personality" });
      const event = { key, preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: { parentElement: { querySelectorAll: () => focus } } };
      (controls(element)[index].props.onKeyDown as (event: KeyboardEvent<HTMLButtonElement>) => void)(event as unknown as KeyboardEvent<HTMLButtonElement>);
      return event;
    };
    expect(press(0, "ArrowDown").preventDefault).toHaveBeenCalledOnce(); expect(value).toBe("mischievous");
    press(4, "ArrowRight"); expect(value).toBe("gourmet");
    press(5, "ArrowUp"); expect(value).toBe("affectionate");
    press(1, "End"); expect(value).toBe("homebody");
    press(7, "ArrowRight"); expect(value).toBe("curious");
    press(0, "Home");
    expect(change).toHaveBeenCalledTimes(5); expect(focus[0].focus).toHaveBeenCalledTimes(2);
    expect(activity.mock.calls.map(([, detail]) => detail)).toEqual(["mischievous", "gourmet", "affectionate", "homebody", "curious"].map(option => ({ target: `companion-personality#${option}` })));
    expect(press(0, "Enter").preventDefault).not.toHaveBeenCalled(); // Native click retains its owner.
  });
});
