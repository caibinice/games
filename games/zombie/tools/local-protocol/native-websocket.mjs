import net from 'node:net';
import { WebSocketServer } from './vendor/ws/wrapper.mjs';

export function websocketWorld(value, name = '个人自建服') {
  const url = new URL(value.trim());
  if (
    url.protocol !== 'wss:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== '443') ||
    !url.pathname.endsWith('/socket')
  )
    throw Error('Native WebSocket requires an HTTPS/WSS endpoint on 443');
  return { host: url.href, port: 443, name };
}

export function attachNativeWebSocket(
  server,
  { gate, tcpPort, record = () => {}, maxClients = 16, heartbeatMs = 30000 },
) {
  if (!gate) throw Error('Native WebSocket requires private API routing');
  if (!Number.isInteger(heartbeatMs) || heartbeatMs < 50)
    throw Error('Invalid native heartbeat interval');
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 65536,
    perMessageDeflate: false,
    clientTracking: true,
  });
  server.on('upgrade', (req, socket, head) => {
    if (gate(req.url) !== '/socket' || wss.clients.size >= maxClients) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      record({ layer: 'native-websocket', event: 'connect' });
      ws.nativeAlive = true;
      ws.on('pong', () => {
        ws.nativeAlive = true;
      });
      const tcp = net.connect(tcpPort, '127.0.0.1');
      let queued = 0,
        connected = false;
      const pending = [];
      const close = () => {
        tcp.destroy();
        if (ws.readyState < 2) ws.close();
      };
      tcp.on('connect', () => {
        connected = true;
        for (const data of pending) tcp.write(data);
        pending.length = 0;
        queued = 0;
      });
      ws.on('message', (data, binary) => {
        if (!binary || queued + data.length > 65536 || tcp.writableLength > 262144) {
          close();
          return;
        }
        if (connected) tcp.write(data);
        else {
          pending.push(data);
          queued += data.length;
        }
      });
      tcp.on('data', (data) => {
        if (ws.readyState !== 1 || ws.bufferedAmount > 262144) {
          close();
          return;
        }
        ws.send(data, { binary: true });
      });
      tcp.on('end', close);
      tcp.on('error', close);
      ws.on('close', (code) => {
        record({ layer: 'native-websocket', event: 'disconnect', code });
        tcp.destroy();
      });
      ws.on('error', () => tcp.destroy());
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.readyState !== 1) continue;
      if (!ws.nativeAlive) {
        record({ layer: 'native-websocket', event: 'heartbeat-timeout' });
        ws.terminate();
        continue;
      }
      ws.nativeAlive = false;
      ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();
  return () => {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
}
