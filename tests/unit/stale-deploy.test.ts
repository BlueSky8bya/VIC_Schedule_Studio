import { afterEach, describe, expect, it, vi } from "vitest";
import { STALE_DEPLOY_EVENT, announceIfStaleDeployment, isStaleDeploymentError } from "@/lib/net/stale-deploy";

describe("stale deployment notice", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognizes only the unrecognized Server Action error", () => {
    const named = Object.assign(new Error("x"), { name: "UnrecognizedActionError" });
    expect(isStaleDeploymentError(named)).toBe(true);
    expect(isStaleDeploymentError(new Error('Server Action "abc" was not found on the server.'))).toBe(true);
    expect(isStaleDeploymentError(new Error("network down"))).toBe(false);
    expect(isStaleDeploymentError(null)).toBe(false);
    expect(isStaleDeploymentError("was not found on the server")).toBe(false);
  });

  it("announces instead of reloading", () => {
    const dispatchEvent = vi.fn();
    const reload = vi.fn();
    vi.stubGlobal("window", { dispatchEvent, location: { reload } });
    expect(announceIfStaleDeployment(new Error("network down"))).toBe(false);
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(announceIfStaleDeployment(Object.assign(new Error("x"), { name: "UnrecognizedActionError" }))).toBe(true);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect((dispatchEvent.mock.calls[0][0] as Event).type).toBe(STALE_DEPLOY_EVENT);
    expect(reload).not.toHaveBeenCalled();
  });
});
