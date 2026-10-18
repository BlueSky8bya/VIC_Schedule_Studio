import { describe, expect, it, vi } from "vitest";
import { restoreDialogOpener } from "@/lib/ui/use-focus-trap";

const node = (act: string, visible = true, connected = true) => ({
  isConnected: connected,
  getClientRects: () => visible ? [{}] : [],
  closest: () => null,
  getAttribute: (name: string) => name === "data-act" ? act : null,
  focus: vi.fn(),
}) as unknown as HTMLElement;
const rootWith = (book: HTMLElement[], settings: HTMLElement[]) => ({
  querySelectorAll: (selector: string) => selector === '[data-act="companion-book-open"]' ? book : selector.includes("open-settings") ? settings : [],
}) as unknown as ParentNode;

describe("dialog opener restoration", () => {
  it("returns to the connected original opener", () => {
    const original = node("companion-book-open"), replacement = node("companion-book-open"), settings = node("open-settings");
    restoreDialogOpener(original, rootWith([replacement], [settings]));
    expect(original.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(replacement.focus).not.toHaveBeenCalled();
  });
  it("returns to the replacement book after world preferences regenerate it", () => {
    const original = node("companion-book-open", false, false), replacement = node("companion-book-open"), settings = node("open-settings");
    restoreDialogOpener(original, rootWith([replacement], [settings]));
    expect(replacement.focus).toHaveBeenCalledOnce();
    expect(settings.focus).not.toHaveBeenCalled();
  });
  it("falls back to settings after disabling the pet and skips hidden books", () => {
    const original = node("companion-book-open", false, false), hidden = node("companion-book-open", false), settings = node("open-settings");
    restoreDialogOpener(original, rootWith([hidden], [settings]));
    expect(settings.focus).toHaveBeenCalledOnce();
    expect(hidden.focus).not.toHaveBeenCalled();
  });
  it("does not redirect another removed opener to the book", () => {
    const original = node("open-settings", false, false), book = node("companion-book-open"), settings = node("open-settings");
    restoreDialogOpener(original, rootWith([book], [settings]));
    expect(settings.focus).toHaveBeenCalledOnce();
    expect(book.focus).not.toHaveBeenCalled();
  });
});
