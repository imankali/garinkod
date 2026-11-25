import { describe, expect, it } from 'vitest';
import { parseApiError } from './errors';

describe('throttle copy', () => {
  it('maps 429 to the throttled code instead of a generic error', () => {
    const parsed = parseApiError({
      response: { status: 429, data: { detail: 'Request was throttled. Expected available in 3600 seconds.' } },
    });
    expect(parsed.code).toBe('throttled');
    expect(parsed.status).toBe(429);
  });
});
