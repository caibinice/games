// Personal-install capability. Keep it in a private file, not source or logs.
export function nativeApiGate(secret) {
  if (typeof secret !== 'string' || !/^\/[a-f0-9]{64}$/.test(secret.trim()))
    throw Error('API prefix requires / followed by 64 lowercase hex characters');
  const prefix = secret.trim();
  return (target) => {
    if (typeof target !== 'string' || target.length > 8192 || !target.startsWith(prefix + '/'))
      return null;
    const route = target.slice(prefix.length),
      path = route.split('?')[0];
    if (
      !/^\/[A-Za-z0-9_./-]+$/.test(path) ||
      path.includes('//') ||
      path.split('/').some((p) => p === '.' || p === '..') ||
      path.startsWith('/__')
    )
      return null;
    return route;
  };
}

export function boundedRateLimit({ limit = 120, windowMs = 60000, maxClients = 1024 } = {}) {
  if (![limit, windowMs, maxClients].every((n) => Number.isInteger(n) && n > 0))
    throw Error('Invalid request limit');
  const clients = new Map();
  return (address, now = Date.now()) => {
    let entry = clients.get(address);
    if (!entry || now >= entry.until) {
      if (!entry && clients.size >= maxClients) {
        for (const [key, value] of clients) if (now >= value.until) clients.delete(key);
        if (clients.size >= maxClients) return false;
      }
      entry = { until: now + windowMs, count: 0 };
      clients.set(address, entry);
    }
    return ++entry.count <= limit;
  };
}
