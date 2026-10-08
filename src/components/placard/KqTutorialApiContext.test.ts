import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createKqTutorialApi, useKqTutorialApi, type KqTutorialApi } from "./KqTutorialApiContext";

afterEach(() => vi.unstubAllGlobals());

describe("tutorial events stay inside their own screen tree", () => {
  it("keeps the real equipment request and page notification outside a tutorial", async () => {
    const network = vi.fn(async () => Response.json({ equipped: true }));
    vi.stubGlobal("fetch", network);
    vi.stubGlobal("window", new EventTarget());
    const capture = vi.fn<(api: KqTutorialApi) => void>();
    function ReadDefaultApi() { capture(useKqTutorialApi()); return null; }
    renderToStaticMarkup(createElement(ReadDefaultApi));
    const api = capture.mock.calls[0][0];
    expect(api.isTutorial).toBe(false);
    const options = { method: "PATCH", body: JSON.stringify({ equipmentCode: "TENT-001", tentNumber: 1, expectedUnits: 1 }) };
    expect(await (await api.request("/api/arena/placard/equipment", options)).json()).toEqual({ equipped: true });
    expect(network).toHaveBeenCalledExactlyOnceWith("/api/arena/placard/equipment", options);
    const updated = vi.fn();
    const stop = api.subscribe(["kq:equipment-updated"], updated);
    api.notify("kq:equipment-updated");
    expect(updated).toHaveBeenCalledOnce();
    stop(); api.notify("kq:equipment-updated");
    expect(updated).toHaveBeenCalledOnce();
  });

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
    const options = { method: "PATCH", body: JSON.stringify({ equipmentCode: "TENT-001", tentNumber: 1, expectedUnits: 1 }) };
    expect(await (await api.request("/api/arena/placard/equipment", options)).json()).toEqual({ demo: true });
    expect(request).toHaveBeenCalledWith("/api/arena/placard/equipment", options);
    expect(network).not.toHaveBeenCalled();
  });
});
