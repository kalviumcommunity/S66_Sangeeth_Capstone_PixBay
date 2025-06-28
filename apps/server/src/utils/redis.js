import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with maximum delay of 30 seconds
      const delay = Math.min(Math.pow(2, retries) * 1000, 30000);
      // console.log(`Reconnecting to Redis in ${delay}ms...`);
      return delay;
    }
  }
});

// Track Redis connection state
let isRedisConnected = false;

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
  isRedisConnected = false;
});

redisClient.on('connect', () => {
  // console.log('Redis connection established');
  isRedisConnected = true;
});

redisClient.on('reconnecting', () => {
  // console.log('Redis reconnecting...');
});

redisClient.on('end', () => {
  // console.log('Redis connection closed');
  isRedisConnected = false;
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    // console.log('Connected to Redis successfully');
    isRedisConnected = true;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    isRedisConnected = false;
  }
})();

// Cache helpers with connection checks
export const setCache = async (key, data, expireTime = 3600) => {
  if (!isRedisConnected) {
    console.warn('Redis not connected, skipping cache set operation');
    return false;
  }
  
  try {
    await redisClient.set(key, JSON.stringify(data), {
      EX: expireTime // Expire in seconds (default: 1 hour)
    });
    return true;
  } catch (error) {
    console.error('Redis cache set error:', error);
    return false;
  }
};

export const getCache = async (key) => {
  if (!isRedisConnected) {
    console.warn('Redis not connected, skipping cache get operation');
    return null;
  }
  
  try {
    const cachedData = await redisClient.get(key);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    console.error('Redis cache get error:', error);
    return null;
  }
};

export const deleteCache = async (key) => {
  if (!isRedisConnected) {
    console.warn('Redis not connected, skipping cache delete operation');
    return false;
  }
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis cache delete error:', error);
    return false;
  }
};

// Add methods to check and manage Redis connection status
export const isRedisCacheAvailable = () => isRedisConnected;

/**
 * Check Redis health and attempt to reconnect if disconnected
 * @returns {Promise<boolean>} Whether Redis is connected after the check
 */
export const checkRedisHealthAndReconnect = async () => {
  if (isRedisConnected) {
    try {
      // Test connection with a simple ping
      await redisClient.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      isRedisConnected = false;
    }
  }
  
  if (!isRedisConnected) {
    try {
      // console.log('Attempting to reconnect to Redis...');
      await redisClient.connect();
      // console.log('Redis reconnection successful');
      return true;
    } catch (error) {
      console.error('Redis reconnection failed:', error);
      return false;
    }
  }
  
  return isRedisConnected;
};

export default redisClient;
