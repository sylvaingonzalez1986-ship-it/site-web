import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const react = vi.hoisted(() => ({ useLayoutEffect: vi.fn() }));
vi.mock("react", () => ({ useLayoutEffect: react.useLayoutEffect }));

const LOCK_ATTRIBUTE = "data-site-scroll-locked";
const PADDING_PROPERTY = "--site-scroll-lock-padding-right";
type Cleanup = () => void;

class InlineStyle {
  overflow = "";
  paddingRight = "";
  private properties = new Map<string, string>();
  setProperty(name: string, value: string) { this.properties.set(name, value); }
  getPropertyValue(name: string) { return this.properties.get(name) ?? ""; }
  removeProperty(name: string) {
    const previous = this.getPropertyValue(name);
    this.properties.delete(name);
    return previous;
  }
}

function createDom() {
  const attributes = new Map<string, string>();
  const body = { style: new InlineStyle() };
  const viewport = { innerWidth: 1000, scrollbarWidth: 20, stylesheetPaddingRight: "0px" };
  const html = {
    style: new InlineStyle(),
    setAttribute(name: string, value: string) { attributes.set(name, value); },
    removeAttribute(name: string) { attributes.delete(name); },
    hasAttribute(name: string) { return attributes.has(name); },
    get clientWidth() {
      const hidden = attributes.has(LOCK_ATTRIBUTE) || html.style.overflow === "hidden"
        || body.style.overflow === "hidden";
      return viewport.innerWidth - (hidden ? 0 : viewport.scrollbarWidth);
    },
  };
  const getComputedStyle = () => ({
    paddingRight: attributes.has(LOCK_ATTRIBUTE)
      ? html.style.getPropertyValue(PADDING_PROPERTY)
      : body.style.paddingRight || viewport.stylesheetPaddingRight,
  });
  vi.stubGlobal("document", { documentElement: html, body });
  vi.stubGlobal("window", {
    get innerWidth() { return viewport.innerWidth; },
    getComputedStyle,
  });
  vi.stubGlobal("getComputedStyle", getComputedStyle);
  return { html, body, viewport };
}

let dom: ReturnType<typeof createDom>;
let runHook: (locked: boolean) => void;
const activeCleanups = new Set<Cleanup>();

function mountLock(locked = true) {
  runHook(locked);
  const cleanup = react.useLayoutEffect.mock.results.at(-1)?.value as Cleanup | undefined;
  return () => {
    if (cleanup && activeCleanups.delete(cleanup)) cleanup();
  };
}

// Next's development error overlay owns a separate, deferred body lock. Its
// snapshot must never capture an inline "hidden" value installed by this hook.
function openDevelopmentOverlay() {
  let previousOverflow: string;
  let previousPadding: string | undefined;
  setTimeout(() => {
    const scrollbarWidth = dom.viewport.innerWidth - dom.html.clientWidth;
    if (scrollbarWidth > 0) {
      previousPadding = dom.body.style.paddingRight;
      dom.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    previousOverflow = dom.body.style.overflow;
    dom.body.style.overflow = "hidden";
  });
  vi.runAllTimers();
  return () => {
    setTimeout(() => {
      if (previousPadding !== undefined) dom.body.style.paddingRight = previousPadding;
      dom.body.style.overflow = previousOverflow;
    });
    vi.runAllTimers();
  };
}

function expectReleased() {
  expect(dom.html.hasAttribute(LOCK_ATTRIBUTE)).toBe(false);
  expect(dom.html.style.getPropertyValue(PADDING_PROPERTY)).toBe("");
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  dom = createDom();
  react.useLayoutEffect.mockImplementation((effect: () => void | Cleanup) => {
    const cleanup = effect();
    if (cleanup) {
      activeCleanups.add(cleanup);
    }
    return cleanup;
  });
  runHook = (await import("./useBodyScrollLock")).useBodyScrollLock;
});

afterEach(() => {
  for (const cleanup of activeCleanups) cleanup();
  activeCleanups.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useBodyScrollLock", () => {
  it("does not acquire a lock for a closed overlay", () => {
    mountLock(false)();
    expectReleased();
    expect(dom.body.style.overflow).toBe("");
  });

  it("keeps nested overlays locked until their last owner releases", () => {
    const closeOuter = mountLock();
    const closeInner = mountLock();
    expect(dom.html.hasAttribute(LOCK_ATTRIBUTE)).toBe(true);
    expect(dom.html.style.getPropertyValue(PADDING_PROPERTY)).toBe("20px");
    closeOuter();
    expect(dom.html.hasAttribute(LOCK_ATTRIBUTE)).toBe(true);
    expect(dom.html.style.getPropertyValue(PADDING_PROPERTY)).toBe("20px");
    closeInner();
    expectReleased();
  });

  it("preserves existing inline overflow and padding throughout the lock", () => {
    dom.html.style.overflow = "scroll";
    dom.body.style.overflow = "hidden";
    dom.body.style.paddingRight = "7px";
    const close = mountLock();
    expect(dom.html.style.overflow).toBe("scroll");
    expect(dom.body.style.overflow).toBe("hidden");
    expect(dom.body.style.paddingRight).toBe("7px");
    close();
    expectReleased();
    expect(dom.html.style.overflow).toBe("scroll");
    expect(dom.body.style.overflow).toBe("hidden");
    expect(dom.body.style.paddingRight).toBe("7px");
  });

  it.each([
    { scrollbarWidth: 20, expected: "27.5px" },
    { scrollbarWidth: 0, expected: "7.5px" },
    { scrollbarWidth: -2, expected: "7.5px" },
  ])("compensates a $scrollbarWidth px scrollbar without replacing body padding", ({ scrollbarWidth, expected }) => {
    dom.viewport.scrollbarWidth = scrollbarWidth;
    dom.viewport.stylesheetPaddingRight = "7.5px";
    const close = mountLock();
    expect(dom.html.style.getPropertyValue(PADDING_PROPERTY)).toBe(expected);
    expect(dom.body.style.paddingRight).toBe("");
    close();
    expectReleased();
  });

  it("can clean up and remount its effect as Strict Mode does", () => {
    mountLock()();
    expectReleased();
    const close = mountLock();
    expect(dom.html.hasAttribute(LOCK_ATTRIBUTE)).toBe(true);
    expect(dom.html.style.getPropertyValue(PADDING_PROPERTY)).toBe("20px");
    close();
    expectReleased();
    expect(dom.body.style.overflow).toBe("");
  });

  it("does not leave stale overflow when the app opens and closes before the development overlay", () => {
    dom.body.style.paddingRight = "6px";
    const closeApp = mountLock();
    const closeDevelopmentOverlay = openDevelopmentOverlay();
    closeApp();
    expectReleased();
    expect(dom.body.style.overflow).toBe("hidden");
    closeDevelopmentOverlay();
    expect(dom.html.style.overflow).toBe("");
    expect(dom.body.style.overflow).toBe("");
    expect(dom.body.style.paddingRight).toBe("6px");
  });

  it("does not restore the development overlay's stale overflow or padding after it closes", () => {
    dom.body.style.paddingRight = "6px";
    const closeDevelopmentOverlay = openDevelopmentOverlay();
    const closeApp = mountLock();
    closeDevelopmentOverlay();
    expect(dom.html.hasAttribute(LOCK_ATTRIBUTE)).toBe(true);
    closeApp();
    expectReleased();
    expect(dom.html.style.overflow).toBe("");
    expect(dom.body.style.overflow).toBe("");
    expect(dom.body.style.paddingRight).toBe("6px");
  });
});
