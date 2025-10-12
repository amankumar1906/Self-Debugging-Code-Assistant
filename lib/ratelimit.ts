import { kv } from '@vercel/kv';

/**
 * Rate limit configuration
 */
const MAX_REQUESTS_PER_HOUR = 3;
const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in milliseconds
  resetIn: number; // Seconds until reset
}

/**
 * Rate limit error with details
 */
export class RateLimitError extends Error {
  constructor(
    public result: RateLimitResult,
    message?: string
  ) {
    super(message || 'Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

/**
 * Check rate limit for an IP address
 * @param ip - IP address to check
 * @returns Rate limit status
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  // Sanitize IP for use as key
  const sanitizedIp = ip.replace(/[^a-zA-Z0-9.:]/g, '');
  const key = `ratelimit:${sanitizedIp}`;

  try {
    // Increment the counter
    const count = await kv.incr(key);

    // Set expiry on first request
    if (count === 1) {
      await kv.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    // Get TTL (time to live) for the key
    const ttl = await kv.ttl(key);
    const resetIn = ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS;
    const resetAt = Date.now() + resetIn * 1000;

    const remaining = Math.max(0, MAX_REQUESTS_PER_HOUR - count);
    const allowed = count <= MAX_REQUESTS_PER_HOUR;

    return {
      allowed,
      limit: MAX_REQUESTS_PER_HOUR,
      remaining,
      resetAt,
      resetIn,
    };
  } catch (error) {
    // If KV fails, log error and allow request (fail open)
    console.error('Rate limit check failed:', error);

    // Fallback: allow request but indicate rate limiting is unavailable
    return {
      allowed: true,
      limit: MAX_REQUESTS_PER_HOUR,
      remaining: MAX_REQUESTS_PER_HOUR,
      resetAt: Date.now() + RATE_LIMIT_WINDOW_SECONDS * 1000,
      resetIn: RATE_LIMIT_WINDOW_SECONDS,
    };
  }
}

/**
 * Check rate limit and throw error if exceeded
 * @param ip - IP address to check
 * @returns Rate limit result
 * @throws RateLimitError if rate limit exceeded
 */
export async function checkRateLimitOrThrow(ip: string): Promise<RateLimitResult> {
  const result = await checkRateLimit(ip);

  if (!result.allowed) {
    throw new RateLimitError(
      result,
      `Rate limit exceeded. You can make ${result.limit} requests per hour. Try again in ${Math.ceil(result.resetIn / 60)} minutes.`
    );
  }

  return result;
}

/**
 * Reset rate limit for an IP (admin/testing use)
 * @param ip - IP address to reset
 */
export async function resetRateLimit(ip: string): Promise<void> {
  const sanitizedIp = ip.replace(/[^a-zA-Z0-9.:]/g, '');
  const key = `ratelimit:${sanitizedIp}`;

  try {
    await kv.del(key);
  } catch (error) {
    console.error('Failed to reset rate limit:', error);
  }
}

/**
 * Get current rate limit status without incrementing
 * @param ip - IP address to check
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(ip: string): Promise<RateLimitResult> {
  const sanitizedIp = ip.replace(/[^a-zA-Z0-9.:]/g, '');
  const key = `ratelimit:${sanitizedIp}`;

  try {
    const count = (await kv.get<number>(key)) || 0;
    const ttl = await kv.ttl(key);
    const resetIn = ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS;
    const resetAt = Date.now() + resetIn * 1000;

    const remaining = Math.max(0, MAX_REQUESTS_PER_HOUR - count);
    const allowed = count < MAX_REQUESTS_PER_HOUR;

    return {
      allowed,
      limit: MAX_REQUESTS_PER_HOUR,
      remaining,
      resetAt,
      resetIn,
    };
  } catch (error) {
    console.error('Failed to get rate limit status:', error);

    return {
      allowed: true,
      limit: MAX_REQUESTS_PER_HOUR,
      remaining: MAX_REQUESTS_PER_HOUR,
      resetAt: Date.now() + RATE_LIMIT_WINDOW_SECONDS * 1000,
      resetIn: RATE_LIMIT_WINDOW_SECONDS,
    };
  }
}

/**
 * Format reset time as human-readable string
 * @param resetAt - Unix timestamp in milliseconds
 * @returns Human-readable time string
 */
export function formatResetTime(resetAt: number): string {
  const now = Date.now();
  const diff = resetAt - now;

  if (diff <= 0) {
    return 'now';
  }

  const minutes = Math.ceil(diff / 60000);

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${hours} hour${hours === 1 ? '' : 's'} ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
}
