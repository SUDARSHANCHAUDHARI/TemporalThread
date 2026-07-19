import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../packages/core/src/clock.js';
import { calculateElapsedTime, getCurrentTime } from '../../packages/core/src/time.js';

describe('getCurrentTime', () => {
  it('reports UTC and local representations from an injected clock', () => {
    const result = getCurrentTime(new FakeClock('2026-07-15T13:30:00Z'), 'Asia/Bangkok');

    expect(result.utcTime).toBe('2026-07-15T13:30:00Z');
    expect(result.localIsoTime).toContain('2026-07-15T20:30:00+07:00[Asia/Bangkok]');
    expect(result.utcOffset).toBe('+07:00');
    expect(result.utcOffsetMinutes).toBe(420);
    expect(result.dayOfWeek).toBe('Wednesday');
    expect(result.unixTimestamp).toBe(1_784_122_200);
  });
});

describe('calculateElapsedTime', () => {
  const clock = new FakeClock('2026-07-19T00:00:00Z');

  it('separates exact elapsed time from calendar-day boundaries', () => {
    const result = calculateElapsedTime(
      '2026-07-15T23:30:00+07:00',
      '2026-07-16T00:30:00+07:00',
      'Asia/Bangkok',
      clock,
    );

    expect(result.totalMilliseconds).toBe(3_600_000);
    expect(result.hours).toBe(1);
    expect(result.exactDays).toBeCloseTo(1 / 24);
    expect(result.calendarDayDifference).toBe(1);
    expect(result.humanReadable).toBe('1 hour');
  });

  it('measures exact DST elapsed time independently of the local calendar', () => {
    const result = calculateElapsedTime(
      '2026-03-08T00:00:00-05:00',
      '2026-03-09T00:00:00-04:00',
      'America/New_York',
      clock,
    );

    expect(result.hours).toBe(23);
    expect(result.calendarDayDifference).toBe(1);
    expect(result.exactDayBreakdown).toEqual({
      days: 0,
      hours: 23,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
  });

  it('marks reversed intervals while retaining a signed total', () => {
    const result = calculateElapsedTime('2026-07-16T00:00:00Z', '2026-07-15T21:30:00Z', 'UTC', clock);

    expect(result.totalMilliseconds).toBe(-9_000_000);
    expect(result.endBeforeStart).toBe(true);
    expect(result.exactDayBreakdown.hours).toBe(2);
    expect(result.exactDayBreakdown.minutes).toBe(30);
    expect(result.humanReadable).toBe('2 hours, 30 minutes before start');
  });

  it('uses the injected clock when end is omitted', () => {
    const result = calculateElapsedTime('2026-07-18T12:00:00Z', undefined, 'UTC', clock);

    expect(result.endUtc).toBe('2026-07-19T00:00:00Z');
    expect(result.hours).toBe(12);
  });
});
