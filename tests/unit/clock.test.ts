import { FakeClock } from '@sudarshanchaudhari/temporalthread-core';
import { describe, expect, it } from 'vitest';

describe('FakeClock', () => {
  it('advances deterministically without consulting the system clock', () => {
    const clock = new FakeClock('2026-07-15T13:00:00Z');
    clock.advance({ days: 4, hours: 2 });

    expect(clock.now().toString()).toBe('2026-07-19T15:00:00Z');
  });
});
