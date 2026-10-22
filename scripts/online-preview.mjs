// Local-only dist preview, including the existing cockpit backend's API/WS.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root = resolve('dist'), port = Number(process.env.PREVIEW_PORT || 18749), backend = Number(process.env.GAMES_BACKEND_PORT || 18084);
const api = path => path.replace(/^\/smartCockpit/, '');
const headers = original => { const h = { ...original, host: '127.0.0.1:' + backend }; delete h.origin; return h; };
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/smartCockpit/api/games/')) {
    const proxy = http.request({ hostname: '127.0.0.1', port: backend, path: api(req.url), method: req.method, headers: headers(req.headers) }, upstream => { res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res); });
    proxy.on('error', () => { res.writeHead(502); res.end('Backend not ready'); }); req.pipe(proxy); return;
  }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname), file = resolve(root, '.' + path);
    if (!file.startsWith(root + sep)) throw Error();
    const info = await stat(file);
    if (info.isDirectory() && !path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }); res.end(); return; }
    const target = info.isDirectory() ? resolve(file, 'index.html') : file;
    res.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(await readFile(target));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/smartCockpit/api/games/ws')) { socket.destroy(); return; }
  const upstream = http.request({ hostname: '127.0.0.1', port: backend, path: api(req.url), headers: headers(req.headers) });
  upstream.on('upgrade', (response, peer, peerHead) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' + Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    if (peerHead.length) socket.write(peerHead); if (head.length) peer.write(head);
    peer.pipe(socket); socket.pipe(peer); peer.on('error', () => socket.destroy()); socket.on('error', () => peer.destroy());
  });
  upstream.on('response', response => { socket.end('HTTP/1.1 ' + response.statusCode + ' Rejected\r\n\r\n'); });
  upstream.on('error', () => socket.destroy()); upstream.end();
});
server.listen(port, '127.0.0.1', () => console.log(`Online preview http://127.0.0.1:${port}/games/tank/online.html -> backend ${backend}`));
