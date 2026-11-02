const KEY = 'fish-zombie-guild-v1',
  BASE = '/smartCockpit/api/games/zombie';
export function createGuildApi() {
  let identity = null,
    pending = null;
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (/^[a-f0-9-]{36}$/.test(r?.playerId) && /^[A-Za-z0-9_-]{43}$/.test(r?.token)) identity = r;
  } catch {}
  async function request(path, method = 'GET', body, authenticated = true) {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authenticated && identity) {
        headers.Authorization = 'Bearer ' + identity.token;
        headers['X-Zombie-Player'] = identity.playerId;
      }
      const response = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.message || '军团服务暂时未就绪，请稍后重试');
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw Error('军团连接超时，请重试');
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function ensure(name) {
    if (identity) return identity;
    if (!pending)
      pending = request('/players', 'POST', { name }, false)
        .then((r) => {
          identity = r;
          try {
            localStorage.setItem(KEY, JSON.stringify(r));
          } catch {}
          return r;
        })
        .finally(() => {
          pending = null;
        });
    return pending;
  }
  return {
    ensure,
    me: () => request('/me'),
    list: (q) => request('/guilds?q=' + encodeURIComponent(q || ''), 'GET', undefined, false),
    create: (name) => request('/guilds', 'POST', { name }),
    join: (code) => request('/guilds/' + encodeURIComponent(code) + '/join', 'POST'),
    action: (code, action, body = {}) =>
      request('/guilds/' + encodeURIComponent(code) + '/' + action, 'POST', body),
    get playerId() {
      return identity?.playerId || '';
    },
  };
}
