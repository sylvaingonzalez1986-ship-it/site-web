import { afterEach, describe, expect, it, vi } from "vitest";
import { createKqTutorialApi } from "./KqTutorialApiContext";

afterEach(() => vi.unstubAllGlobals());

describe("tutorial events stay inside their own screen tree", () => {
  it("never notifies the live page or a different lesson", () => {
    const globalDispatch = vi.fn();
    vi.stubGlobal("window", { dispatchEvent: globalDispatch });
    const request: typeof fetch = async () => Response.json({});
    const first = createKqTutorialApi(request);
    const other = createKqTutorialApi(request);
    const localListener = vi.fn(); const otherListener = vi.fn();
    const stop = first.subscribe(["kq:treasury-updated"], localListener);
    other.subscribe(["kq:treasury-updated"], otherListener);
    first.notify("kq:treasury-updated");
    expect(localListener).toHaveBeenCalledOnce();
    expect(otherListener).not.toHaveBeenCalled();
    expect(globalDispatch).not.toHaveBeenCalled();
    stop(); first.notify("kq:treasury-updated");
    expect(localListener).toHaveBeenCalledOnce();
  });

  it("uses only the supplied tutorial transport", async () => {
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    const request = vi.fn(async () => Response.json({ demo: true }));
    const api = createKqTutorialApi(request);
    expect(await (await api.request("/api/arena/placard/bank")).json()).toEqual({ demo: true });
    expect(request).toHaveBeenCalledWith("/api/arena/placard/bank");
    expect(network).not.toHaveBeenCalled();
  });
});
