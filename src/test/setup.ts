import "@testing-library/jest-dom";
import { setRpcMode } from "@/lib/api";

// Force mock mode in tests — no live node is available during test runs.
setRpcMode(false);

// ─── matchMedia mock ─────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// ─── crypto.getRandomValues mock (jsdom doesn't have Web Crypto) ──
if (!global.crypto) {
  (global as any).crypto = {};
}
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = (<T extends ArrayBufferView>(arr: T): T => {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }) as any;
}

// ─── ResizeObserver mock (framer-motion needs it) ────────────
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ─── IntersectionObserver mock ───────────────────────────────
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];
    constructor(
      _callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// ─── scrollTo mock ───────────────────────────────────────────
if (!window.scrollTo) {
  window.scrollTo = () => {};
}
