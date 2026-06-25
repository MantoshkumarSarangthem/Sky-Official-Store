const _apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "").replace(/^\/[^/]+/, "") + "/api";

let _version = "1";
let _started = false;

export function getContentVersion(): string {
  return _version;
}

export function startContentVersionPolling(): void {
  if (_started) return;
  _started = true;

  const poll = () => {
    fetch(`${_apiBase}/content-version`, { cache: "no-store" })
      .then(r => r.json())
      .then((d: { v: string }) => {
        if (d.v && d.v !== _version) {
          _version = d.v;
          window.dispatchEvent(new CustomEvent("skyVersionChange", { detail: { v: d.v } }));
        }
      })
      .catch(() => {});
  };

  poll();
  setInterval(poll, 15000);
}
