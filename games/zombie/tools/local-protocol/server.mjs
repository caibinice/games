import http from 'node:http';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { readFileSync, appendFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { routeFixture, requestEvidence } from './fixture.mjs';
import {
  keyWords,
  nativeFrameLength,
  decodeNativePacket,
  encodeNativePacket,
  accountLoginReply,
  accountAuxReply,
} from './native-codec.mjs';
import { roleSessionReply, validateLocalRole, validateFixtureProfile } from './role-session.mjs';
import { advertisedWorld, nativeLoginGuard } from './native-access.mjs';
import { nativeApiGate, boundedRateLimit } from './native-http-access.mjs';
import { websocketWorld, attachNativeWebSocket } from './native-websocket.mjs';
import { personalAccounts, accountRoleStore } from './personal-accounts.mjs';

const args = process.argv.slice(2);
const value = (name) => {
  const at = args.indexOf(name);
  return at < 0 ? null : args[at + 1];
};
const port = Number(value('--port') || 53173),
  log = value('--log'),
  versionFile = value('--version');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid fixture port');
const version = versionFile ? readFileSync(versionFile) : null;
if (version) JSON.parse(version.toString('utf8'));
const sdkPaths = args.flatMap((v, i) => (v === '--sdk-path' ? [args[i + 1]] : [])),
  gameAuth = args.includes('--game-auth'),
  directory = args.includes('--directory');
const tcpPort = Number(value('--tcp-port') || 53174),
  captureDir = value('--role-capture-dir');
const tcpBind = value('--tcp-bind') || '127.0.0.1',
  secretFile = value('--session-secret-file');
if (!['127.0.0.1', '0.0.0.0'].includes(tcpBind)) throw Error('Invalid native TCP bind address');
if (tcpBind !== '127.0.0.1' && !secretFile)
  throw Error('External native TCP requires expiring session authentication');
const loginGuard = secretFile ? nativeLoginGuard(readFileSync(secretFile)) : null;
const prefixFile = value('--api-prefix-file'),
  apiGate = prefixFile ? nativeApiGate(readFileSync(prefixFile, 'utf8')) : null;
if (tcpBind !== '127.0.0.1' && !apiGate)
  throw Error('External native service requires a private API prefix');
const httpLimit = boundedRateLimit(),
  connectLimit = boundedRateLimit({ limit: 20 });
const webSocketFile = value('--websocket-url-file');
const world = webSocketFile
  ? websocketWorld(readFileSync(webSocketFile, 'utf8'), value('--world-name') || '个人自建服')
  : advertisedWorld({
      host: value('--advertise-host') || '127.0.0.1',
      port: Number(value('--advertise-port') || tcpPort),
      name: value('--world-name') || '本地协议测试区',
    });
const nativeAccount = args.includes('--native-account'),
  platformFile = value('--platform-info');
const roleFile = value('--role-state'),
  profileFile = value('--profile-file');
let localRole =
  roleFile && existsSync(roleFile)
    ? validateLocalRole(JSON.parse(readFileSync(roleFile, 'utf8').replace(/^\uFEFF/, '')))
    : null;
const accountConfig = value('--accounts-file'),
  accountDir = value('--accounts-dir');
if (!!accountConfig !== !!accountDir || (accountConfig && (!secretFile || !nativeAccount)))
  throw Error('Personal accounts require configuration, storage and session secret');
const accounts = accountConfig
  ? personalAccounts(
      JSON.parse(readFileSync(accountConfig, 'utf8').replace(/^\uFEFF/, '')),
      readFileSync(secretFile),
    )
  : null;
const roles = accounts ? accountRoleStore(accountDir, validateLocalRole) : null;
const currentProfile = () =>
  profileFile && existsSync(profileFile)
    ? validateFixtureProfile(JSON.parse(readFileSync(profileFile, 'utf8').replace(/^\uFEFF/, '')))
    : {};
if (roleFile && !nativeAccount) throw Error('Local roles require --native-account');
if (nativeAccount && (!directory || !platformFile))
  throw Error('Native account fixture requires --directory and --platform-info');
const nativeKey = nativeAccount
  ? keyWords(JSON.parse(readFileSync(platformFile, 'utf8').replace(/^\uFEFF/, '')).EncKey)
  : null;
if (!Number.isInteger(tcpPort) || tcpPort < 1024 || tcpPort > 65535 || tcpPort === port)
  throw Error('Invalid role fixture port');
if (sdkPaths.some((p) => !p?.startsWith('/login/')))
  throw Error('SDK fixture paths must be explicit /login/ paths');
const health = {
  startedAt: new Date().toISOString(),
  connections: 0,
  packets: 0,
  replies: 0,
  lastPacketAt: null,
  lastReplyAt: null,
  lastCommand: null,
  lastUnhandled: null,
};
function record(data) {
  const at = new Date().toISOString();
  if (data.layer === 'native-packet' && data.event === 'decode') {
    health.packets++;
    health.lastPacketAt = at;
    health.lastCommand = data.cmd;
  }
  if (data.event === 'reply') {
    health.replies++;
    health.lastReplyAt = at;
  }
  if (data.event === 'unimplemented-command') health.lastUnhandled = { cmd: data.cmd, at };
  const line = JSON.stringify({ at, ...data });
  if (log) appendFileSync(log, line + '\n');
}
const server = http.createServer((req, res) => {
  const route = apiGate ? apiGate(req.url) : req.url;
  if (!route) {
    res.writeHead(404, { connection: 'close' });
    res.end();
    return;
  }
  if (!['GET', 'POST'].includes(req.method)) {
    res.writeHead(405, { connection: 'close' });
    res.end();
    return;
  }
  if (!httpLimit(req.socket.remoteAddress)) {
    res.writeHead(429, { 'retry-after': '60', connection: 'close' });
    res.end();
    return;
  }
  const chunks = [];
  let count = 0,
    tooLarge = false;
  req.on('data', (part) => {
    count += part.length;
    if (count > 65536) {
      tooLarge = true;
    } else chunks.push(part);
  });
  req.on('end', () => {
    if (tooLarge) {
      res.writeHead(413);
      res.end('Fixture body limit');
      record({ method: req.method, path: '<too-large>', status: 413 });
      return;
    }
    if (req.method === 'GET' && req.url === '/__fixture/status') {
      const body = Buffer.from(JSON.stringify({ localFixture: true, ...health }));
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-length': body.length,
        'cache-control': 'no-store',
        connection: 'close',
      });
      res.end(body);
      return;
    }
    const body = Buffer.concat(chunks).toString('utf8'),
      contentType = req.headers['content-type'] || '';
    const evidence = requestEvidence(req.method, route, body, contentType);
    const out =
      accounts?.route(req.method, route, body, contentType) ??
      routeFixture(req.method, route, {
        version,
        sdkPaths,
        gameAuth,
        directory,
        tcpPort,
        nativeAccount,
        roleFixture: !!roleFile || !!roles,
        world,
        loginKey: loginGuard?.issue(),
      });
    record({ ...evidence, layer: out.layer, status: out.status });
    res.writeHead(out.status, {
      'content-type': out.contentType,
      'content-length': out.body.length,
      'cache-control': 'no-store',
      connection: 'close',
    });
    res.end(out.body);
  });
});
server.on('connect', (req, socket) => {
  record({
    method: 'CONNECT',
    host: req.url,
    path: '<tls-tunnel>',
    status: 502,
    layer: 'blocked-tunnel',
  });
  socket.end('HTTP/1.1 502 Local fixture does not forward TLS\r\nConnection: close\r\n\r\n');
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.maxConnections = 64;
const closeWebSocket = webSocketFile
  ? attachNativeWebSocket(server, { gate: apiGate, tcpPort, record })
  : null;
server.listen(port, '127.0.0.1', () =>
  console.log(
    JSON.stringify({
      localFixture: true,
      address: '127.0.0.1',
      port,
      versionCache: !!version,
      sdkPaths,
      gameAuth,
      directory,
      nativeAccount,
      roleFixture: !!roleFile,
    }),
  ),
);
let sequence = 0;
const captureSession = new Date().toISOString().replace(/[^0-9]/g, '');
const tcp = directory
  ? net
      .createServer((socket) => {
        if (health.connections >= 32 || !connectLimit(socket.remoteAddress)) {
          socket.destroy();
          return;
        }
        const id = ++sequence,
          chunks = [];
        let size = 0,
          captured = 0,
          pending = Buffer.alloc(0),
          sendSequence = 0,
          accountReplied = false,
          accountName = null;
        record({ layer: 'role-session-pending', event: 'connect', id });
        socket.setTimeout(10000, () => {
          record({
            layer: 'native-connection',
            event: 'idle-timeout',
            id,
            authenticated: accountReplied,
          });
          socket.end();
        });
        health.connections++;
        socket.on('close', () => {
          health.connections = Math.max(0, health.connections - 1);
          record({
            layer: 'native-connection',
            event: 'disconnect',
            id,
            authenticated: accountReplied,
          });
        });
        socket.on('data', (part) => {
          size += part.length;
          if (pending.length + part.length > 65536) {
            socket.destroy();
            return;
          }
          if (captured < 65536) {
            const prefix = part.subarray(0, 65536 - captured);
            chunks.push(prefix);
            captured += prefix.length;
          }
          const body = Buffer.concat(chunks);
          if (captureDir) writeFileSync(join(captureDir, `role-${captureSession}-${id}.bin`), body);
          record({
            layer: 'role-session-pending',
            event: 'receive',
            id,
            bytes: body.length,
            sha256: createHash('sha256').update(body).digest('hex'),
          });
          if (!nativeAccount) return;
          pending = Buffer.concat([pending, part]);
          try {
            while (pending.length >= 6) {
              const length = nativeFrameLength(pending);
              if (pending.length < length) break;
              const packet = decodeNativePacket(pending.subarray(0, length), nativeKey);
              pending = pending.subarray(length);
              record({
                layer: 'native-packet',
                event: 'decode',
                id,
                cmd: packet.cmd,
                bodyBytes: packet.body.length,
                echo: packet.echo,
              });
              if (accounts && packet.cmd === 2001) {
                accountName = accounts.packetAccount(packet.body);
                if (!accountName) throw Error('Invalid personal account session');
              }
              if (roles && accountName) localRole = roles.load(accountName);
              // Only public game identifiers/counts are logged here, never
              // SDK/account payloads. These fields help diagnose native UI errors.
              if (
                [29202, 29208, 29210, 7309, 7311, 7313, 4286, 4300].includes(packet.cmd) &&
                packet.body.length <= 20 &&
                packet.body.length % 4 === 0
              )
                record({
                  layer: 'local-growth-service',
                  event: 'request',
                  id,
                  cmd: packet.cmd,
                  values: Array.from({ length: packet.body.length / 4 }, (_, i) =>
                    packet.body.readUInt32BE(i * 4),
                  ),
                });
              if ([4200, 4204, 4206].includes(packet.cmd) && packet.body.length === 16)
                record({
                  layer: 'local-gem-action',
                  event: 'request',
                  id,
                  cmd: packet.cmd,
                  itemId: packet.body.readUInt32BE(0),
                  page: packet.body.readUInt32BE(4),
                  part: packet.body.readUInt32BE(8),
                  order: packet.body.readUInt32BE(12),
                });
              if (packet.cmd === 29002 && packet.body.length === 4)
                record({
                  layer: 'local-core-action',
                  event: 'request',
                  id,
                  cmd: packet.cmd,
                  coreId: packet.body.readUInt32BE(0),
                });
              if (packet.cmd === 4217 && packet.body.length === 5)
                record({
                  layer: 'local-equipment-action',
                  event: 'request',
                  id,
                  cmd: packet.cmd,
                  itemGid: packet.body.readUInt32BE(0),
                  isTen: packet.body[4],
                });
              if (packet.cmd === 10931 && packet.body.length >= 8 && packet.body.length <= 264)
                record({
                  layer: 'local-oper-text',
                  event: 'request',
                  id,
                  textIds: Array.from(
                    { length: Math.max(0, (packet.body.length - 8) / 4) },
                    (_, i) => packet.body.readInt32BE(8 + i * 4),
                  ),
                });
              if (
                [10015, 10213, 11974, 10914, 12049, 12089].includes(packet.cmd) &&
                packet.body.length <= 8
              )
                record({
                  layer: 'local-lottery-action',
                  event: 'request',
                  id,
                  cmd: packet.cmd,
                  values: Array.from({ length: packet.body.length / 4 }, (_, i) =>
                    packet.body.readInt32BE(i * 4),
                  ),
                });
              let notifications = [],
                reply =
                  packet.cmd === 2001 && !accountReplied
                    ? accountLoginReply(
                        packet,
                        Date.now(),
                        localRole,
                        accounts
                          ? (body) => accounts.packetAccount(body) === accountName
                          : loginGuard?.packet,
                      )
                    : accountReplied
                      ? accountAuxReply(packet)
                      : null;
              if (!reply && accountReplied && (roleFile || roles)) {
                const out = roleSessionReply(packet, localRole, Date.now(), currentProfile());
                if (out) {
                  reply = out.reply;
                  if (out.pending)
                    record({
                      layer: 'role-session-pending',
                      event: 'unimplemented-command',
                      id,
                      cmd: packet.cmd,
                      feature: out.pending,
                      typedFailure: true,
                    });
                  if (JSON.stringify(localRole) !== JSON.stringify(out.role)) {
                    // 原生协议共用固定 UIN，持久化必须按已认证的账号名隔离。
                    if (roles) roles.save(accountName, out.role);
                    else {
                      writeFileSync(roleFile + '.tmp', JSON.stringify(out.role, null, 2));
                      renameSync(roleFile + '.tmp', roleFile);
                    }
                  }
                  localRole = out.role;
                  notifications = out.notifications ?? [];
                }
              }
              if (reply) {
                if (packet.cmd === 2001) {
                  accountReplied = true;
                  socket.setTimeout(30 * 60 * 1000);
                }
                for (const message of [reply, ...notifications]) {
                  message.sequence = sendSequence++;
                  const wire = encodeNativePacket(message, nativeKey);
                  socket.write(wire);
                  record({
                    layer:
                      message.cmd === 4252 || message.cmd === 4253
                        ? 'native-battle'
                        : message.cmd === 2004 || message.cmd === 2006
                          ? 'native-role'
                          : 'native-account',
                    event: 'reply',
                    id,
                    cmd: message.cmd,
                    bytes: wire.length,
                    ...(packet.cmd === 2001 ? { hasRole: !!localRole } : {}),
                  });
                }
              } else
                record({
                  layer: 'role-session-pending',
                  event: 'unimplemented-command',
                  id,
                  cmd: packet.cmd,
                });
            }
          } catch (error) {
            record({ layer: 'native-packet', event: 'invalid', id, error: error.message });
            socket.end();
          }
        });
        socket.on('error', () => {});
      })
      .listen(tcpPort, tcpBind)
  : null;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    closeWebSocket?.();
    tcp?.close();
    server.close(() => process.exit(0));
  });
