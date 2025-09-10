
import { Logger } from '@/utils/logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface UserRateLimit {
  requests: number;
  resetTime: number;
}

export class RateLimiter {
  private limits: Map<string, UserRateLimit> = new Map();
  private config: RateLimitConfig;
  private logger: Logger;

  constructor(config: RateLimitConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Clean up expired limits every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a user can make a request
   * @param userId - User ID to check
   * @returns true if request is allowed, false if rate limited
   */
  isAllowed(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.limits.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // First request or window has reset
      this.limits.set(userId, {
        requests: 1,
        resetTime: now + this.config.windowMs
      });
      return true;
    }

    if (userLimit.requests >= this.config.maxRequests) {
      this.logger.warn('Rate limit exceeded', {
        userId,
        requests: userLimit.requests,
        resetTime: new Date(userLimit.resetTime).toISOString()
      });
      return false;
    }

    userLimit.requests++;
    return true;
  }

  /**
   * Get remaining time until rate limit resets
   * @param userId - User ID to check
   * @returns remaining time in seconds, or 0 if not rate limited
   */
  getRemainingTime(userId: string): number {
    const userLimit = this.limits.get(userId);
    if (!userLimit) return 0;

    const now = Date.now();
    if (now > userLimit.resetTime) return 0;

    return Math.ceil((userLimit.resetTime - now) / 1000);
  }

  /**
   * Force reset a user's rate limit (for admin use)
   */
  resetUser(userId: string): void {
    this.limits.delete(userId);
    this.logger.info('Rate limit reset for user', { userId });
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, limit] of this.limits.entries()) {
      if (now > limit.resetTime) {
        this.limits.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Cleaned expired rate limits', { cleaned });
    }
  }

  /**
   * Get current stats
   */
  getStats(): { activeUsers: number; totalRequests: number } {
    let totalRequests = 0;
    for (const limit of this.limits.values()) {
      totalRequests += limit.requests;
    }

    return {
      activeUsers: this.limits.size,
      totalRequests
    };
  }
}