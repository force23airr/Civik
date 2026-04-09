import Redis from 'ioredis';

let redisClient = null;

export function createRedisClient() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(url, {
    maxRetriesPerRequest: null, // Required by Bull
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 10) return null; // Stop retrying after 10 attempts
      return Math.min(times * 200, 5000);
    }
  });
}

export function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
    redisClient.on('connect', () => {
      console.log('[Redis] Connected');
    });
  }
  return redisClient;
}
