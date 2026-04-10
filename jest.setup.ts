// Polyfill Request for jsdom environment if not available
interface PolyfillHeaders {
  get(key: string): string | null;
}

interface PolyfillRequestInit {
  headers?: Record<string, string>;
}

if (!globalThis.Request) {
  class PolyfillRequest {
    url: string;
    headers: PolyfillHeaders;

    constructor(url: string, init?: PolyfillRequestInit) {
      this.url = url;
      const headerEntries: [string, string][] = [];
      if (init?.headers) {
        Object.entries(init.headers).forEach(([k, v]) => {
          headerEntries.push([k.toLowerCase(), v]);
        });
      }
      this.headers = {
        get: (key: string) => {
          const entry = headerEntries.find(([k]) => k === key.toLowerCase());
          return entry ? entry[1] : null;
        },
      };
    }
  }
  (globalThis as unknown as { Request: typeof PolyfillRequest }).Request =
    PolyfillRequest;
}
