import http from "http";

const TARGET_PORT = 5000;
const PROXY_PORT = 24534;

const proxy = http.createServer((req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on("error", () => {
    res.writeHead(502);
    res.end("Proxy error");
  });
  req.pipe(proxyReq, { end: true });
});

proxy.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`[proxy] Listening on ${PROXY_PORT} → ${TARGET_PORT}`);
});
