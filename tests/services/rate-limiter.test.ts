import { expect, test, describe, beforeEach, afterEach, spyOn, jest } from 'bun:test';
import { RateLimiter, type RateLimitConfig } from '@/services/rate-limiter';
import { Logger } from '@/utils/logger';
import type { BotConfig } from '@/types';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockLogger: Logger;

  const config: RateLimitConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 5,
  };

  const mockBotConfig: BotConfig = {
    autoHeresyDetectionChance: 0.2,
    maxDailyEmbeddings: 1000,
    sqlitePath: './database/test-vector-store.sqlite',
    documentsPath: './database/test-wh40k-documents',
    logLevel: 'info',
    steamOffersCheckInterval: 3,
    minDiscountPercent: 10,
  };

  beforeEach(() => {
    mockLogger = new Logger(mockBotConfig);
    spyOn(mockLogger, 'warn').mockImplementation(() => {});
    spyOn(mockLogger, 'info').mockImplementation(() => {});
    spyOn(mockLogger, 'debug').mockImplementation(() => {});

    // Mock the cleanup interval
    const originalSetInterval = globalThis.setInterval;
    spyOn(globalThis, 'setInterval').mockImplementation((fn, ms) => {
      if (ms === 60000) return 999; // Mock cleanup interval
      return originalSetInterval(fn, ms);
    });

    rateLimiter = new RateLimiter(config, mockLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should allow requests within limit', () => {
    const userId = 'user123';

    for (let i = 0; i < config.maxRequests; i++) {
      expect(rateLimiter.isAllowed(userId)).toBe(true);
    }
  });

  test('should deny requests when limit exceeded', () => {
    const userId = 'user123';

    // Use up all allowed requests
    for (let i = 0; i < config.maxRequests; i++) {
      rateLimiter.isAllowed(userId);
    }

    // Next request should be denied
    expect(rateLimiter.isAllowed(userId)).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Rate limit exceeded',
      expect.objectContaining({
        userId,
        requests: config.maxRequests,
      })
    );
  });

  test('should reset after window expires', () => {
    const userId = 'user123';

    // Mock Date.now to control time
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    // Use up all requests
    for (let i = 0; i < config.maxRequests; i++) {
      rateLimiter.isAllowed(userId);
    }

    // Should be rate limited
    expect(rateLimiter.isAllowed(userId)).toBe(false);

    // Move time forward beyond the window
    currentTime += config.windowMs + 1000;

    // Should be allowed again
    expect(rateLimiter.isAllowed(userId)).toBe(true);

    Date.now = originalNow;
  });

  test('should handle multiple users independently', () => {
    const user1 = 'user1';
    const user2 = 'user2';

    // Use up all requests for user1
    for (let i = 0; i < config.maxRequests; i++) {
      rateLimiter.isAllowed(user1);
    }

    // user1 should be rate limited
    expect(rateLimiter.isAllowed(user1)).toBe(false);

    // user2 should still be allowed
    expect(rateLimiter.isAllowed(user2)).toBe(true);
  });

  test('should calculate remaining time correctly', () => {
    const userId = 'user123';
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    // Make a request to start the window
    rateLimiter.isAllowed(userId);

    // Check remaining time immediately (should be close to window duration)
    const remainingTime = rateLimiter.getRemainingTime(userId);
    expect(remainingTime).toBeCloseTo(config.windowMs / 1000, 0);

    // Move time forward halfway
    currentTime += config.windowMs / 2;

    const halfwayTime = rateLimiter.getRemainingTime(userId);
    expect(halfwayTime).toBeCloseTo(config.windowMs / 2 / 1000, 0);

    Date.now = originalNow;
  });

  test('should return 0 remaining time for non-existent user', () => {
    expect(rateLimiter.getRemainingTime('nonexistent')).toBe(0);
  });

  test('should return 0 remaining time when window expired', () => {
    const userId = 'user123';
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    rateLimiter.isAllowed(userId);

    // Move time forward beyond the window
    currentTime += config.windowMs + 1000;

    expect(rateLimiter.getRemainingTime(userId)).toBe(0);

    Date.now = originalNow;
  });

  test('should reset user rate limit', () => {
    const userId = 'user123';

    // Use up all requests
    for (let i = 0; i < config.maxRequests; i++) {
      rateLimiter.isAllowed(userId);
    }

    // Should be rate limited
    expect(rateLimiter.isAllowed(userId)).toBe(false);

    // Reset user
    rateLimiter.resetUser(userId);

    // Should be allowed again
    expect(rateLimiter.isAllowed(userId)).toBe(true);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Rate limit reset for user',
      { userId }
    );
  });

  test('should provide correct stats', () => {
    const user1 = 'user1';
    const user2 = 'user2';

    // Make some requests
    rateLimiter.isAllowed(user1);
    rateLimiter.isAllowed(user1);
    rateLimiter.isAllowed(user2);

    const stats = rateLimiter.getStats();
    expect(stats.activeUsers).toBe(2);
    expect(stats.totalRequests).toBe(3);
  });

  test('should provide correct stats when no users', () => {
    const stats = rateLimiter.getStats();
    expect(stats.activeUsers).toBe(0);
    expect(stats.totalRequests).toBe(0);
  });

  test('should clean up expired limits', () => {
    const userId = 'user123';
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    // Make a request
    rateLimiter.isAllowed(userId);

    expect(rateLimiter.getStats().activeUsers).toBe(1);

    // Move time forward beyond the window
    currentTime += config.windowMs + 1000;

    // Trigger cleanup manually (since we mocked setInterval)
    // Access private cleanup method through type assertion
    (rateLimiter as any).cleanup();

    // User should be cleaned up
    expect(rateLimiter.getStats().activeUsers).toBe(0);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Cleaned expired rate limits',
      { cleaned: 1 }
    );

    Date.now = originalNow;
  });
});