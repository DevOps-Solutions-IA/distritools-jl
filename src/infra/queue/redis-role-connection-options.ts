import type { RedisOptions } from 'ioredis';

function baseOptions(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('Redis URL must use redis:// or rediss://');
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  if (!Number.isInteger(database) || database < 0) throw new Error('Redis URL database must be a non-negative integer');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: database,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    connectTimeout: 5_000,
    enableReadyCheck: true,
  };
}

export function createProducerRedisOptions(redisUrl: string): RedisOptions {
  return {
    ...baseOptions(redisUrl),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  };
}

export function createWorkerRedisOptions(redisUrl: string, random: () => number = Math.random): RedisOptions {
  return {
    ...baseOptions(redisUrl),
    enableOfflineQueue: true,
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => {
      const sample = random();
      if (!Number.isFinite(sample) || sample < 0 || sample > 1) return 30_000;
      const base = Math.min(30_000, Math.max(1_000, attempt * 1_000));
      return Math.min(30_000, Math.round(base * (0.5 + sample)));
    },
  };
}
