import http from "http";
import net from "net";

const TARGET = 24534;
const LISTEN = 5000;

const server = http.createServer((req, res) => {
  const opts = {
    hostname: "127.0.0.1",
    port: TARGET,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${TARGET}` },
  };
  const proxy = http.request(opts, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res, { end: true });
  });
  proxy.on("error", () => { try { res.writeHead(502); res.end(); } catch {} });
  req.pipe(proxy, { end: true });
});

server.on("upgrade", (req, clientSocket, head) => {
  const targetSocket = net.connect(TARGET, "127.0.0.1", () => {
    const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
    const headers = Object.entries({ ...req.headers, host: `localhost:${TARGET}` })
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    targetSocket.write(`${reqLine}${headers}\r\n\r\n`);
    if (head && head.length) targetSocket.write(head);
    targetSocket.pipe(clientSocket);
    clientSocket.pipe(targetSocket);
  });
  targetSocket.on("error", () => { try { clientSocket.destroy(); } catch {} });
  clientSocket.on("error", () => { try { targetSocket.destroy(); } catch {} });
});

server.listen(LISTEN, "0.0.0.0", () => {
  console.log(`[proxy] :${LISTEN} → :${TARGET} (HTTP + WS)`);
});
