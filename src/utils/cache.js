import { redis, isRedisUp } from '../config/redis.js';

const PREFIX = 'kb';

// Each (owner, namespace) pair has a version number baked into its cache keys.
// Bumping the version invalidates every cached entry in that namespace at once,
// without needing to SCAN/DEL individual keys.
const versionKey = (owner, ns) => `${PREFIX}:${owner}:${ns}:v`;

async function namespacedKey(owner, ns, key) {
  const version = (await redis.get(versionKey(owner, ns))) || '0';
  return `${PREFIX}:${owner}:${ns}:${version}:${key}`;
}

export async function cached(owner, ns, key, ttlSeconds, compute) {
  if (!isRedisUp()) return compute();

  let fullKey;
  try {
    fullKey = await namespacedKey(owner, ns, key);
    const hit = await redis.get(fullKey);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    console.error('[cache] read failed:', err.message);
    return compute();
  }

  const value = await compute();
  redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds).catch(() => {});
  return value;
}

export async function invalidate(owner, ...namespaces) {
  if (!isRedisUp()) return;
  try {
    await Promise.all(namespaces.map((ns) => redis.incr(versionKey(owner, ns))));
  } catch (err) {
    console.error('[cache] invalidate failed:', err.message);
  }
}

// Fixed-window rate limiter. Returns true when the caller is over the limit.
export async function isRateLimited(key, limit, windowSeconds) {
  if (!isRedisUp()) return false;
  try {
    const fullKey = `${PREFIX}:rl:${key}`;
    const count = await redis.incr(fullKey);
    if (count === 1) await redis.expire(fullKey, windowSeconds);
    return count > limit;
  } catch {
    return false;
  }
}
