import net from "net";

const TARGET_PORT = 5000;
const LISTEN_PORT = 24534;

const server = net.createServer((client) => {
  const target = net.connect(TARGET_PORT, "127.0.0.1", () => {
    client.pipe(target);
    target.pipe(client);
  });
  target.on("error", () => client.destroy());
  client.on("error", () => target.destroy());
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`[proxy] Forwarding port ${LISTEN_PORT} -> ${TARGET_PORT}`);
});
