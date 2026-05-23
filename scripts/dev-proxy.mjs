import http from "http";
import net from "net";

const TARGET = 5000;
const PROXY = 24534;

const server = http.createServer((req, res) => {
  const opts = {
    hostname: "localhost",
    port: TARGET,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${TARGET}` },
  };
  const pr = http.request(opts, (pres) => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res);
  });
  pr.on("error", () => res.end());
  req.pipe(pr);
});

// Forward WebSocket upgrades (Vite HMR)
server.on("upgrade", (req, socket, head) => {
  const ps = net.connect(TARGET, "localhost", () => {
    ps.write(`${req.method} ${req.url} HTTP/1.1\r\n`);
    for (const [k, v] of Object.entries(req.headers)) ps.write(`${k}: ${v}\r\n`);
    ps.write("\r\n");
    if (head?.length) ps.write(head);
  });
  socket.pipe(ps);
  ps.pipe(socket);
  ps.on("error", () => socket.destroy());
  socket.on("error", () => ps.destroy());
});

server.listen(PROXY, "0.0.0.0", () =>
  console.log(`[dev-proxy] ${PROXY} → ${TARGET}`)
);
