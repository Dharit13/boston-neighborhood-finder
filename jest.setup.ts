// Polyfill Request for jsdom environment if not available
if (!globalThis.Request) {
  globalThis.Request = class Request {
    url: string;
    headers: any;

    constructor(url: string, init?: any) {
      this.url = url;
      const headerEntries: [string, string][] = [];
      if (init?.headers) {
        Object.entries(init.headers as Record<string, string>).forEach(([k, v]) => {
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
  } as any;
}
