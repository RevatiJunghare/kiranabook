import { Redis } from 'ioredis';
import { config } from './index.js';

// Redis is used for caching and rate limiting only, so the app keeps
// serving requests (uncached) if Redis is temporarily unavailable.
export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

redis.on('ready', () => console.log('[redis] connected'));
redis.on('error', (err) => console.error('[redis] error:', err.message));

export const isRedisUp = () => redis.status === 'ready';

export function connectRedis() {
  redis.connect().catch((err) => console.error('[redis] initial connect failed:', err.message));
}
