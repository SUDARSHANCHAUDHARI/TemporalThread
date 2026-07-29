import { Temporal } from '@js-temporal/polyfill';
import type { CurrentTimeResult, ElapsedTimeResult } from '@sudarshanchaudhari/temporalthread-shared-types';
import type { Clock } from './clock.js';

const MILLISECONDS_PER_SECOND = 1_000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

function validateTimezone(timezone: string): void {
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(timezone);
  } catch (error) {
    throw new Error(`Invalid IANA timezone: ${timezone}`, { cause: error });
  }
}

function parseInstant(value: string, field: string): Temporal.Instant {
  try {
    return Temporal.Instant.from(value);
  } catch (error) {
    throw new Error(`${field} must be an ISO 8601 timestamp with a UTC offset`, { cause: error });
  }
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

function humanize(milliseconds: number): string {
  const absolute = Math.abs(milliseconds);
  if (absolute === 0) return 'no elapsed time';

  const days = Math.floor(absolute / MILLISECONDS_PER_DAY);
  const hours = Math.floor((absolute % MILLISECONDS_PER_DAY) / MILLISECONDS_PER_HOUR);
  const minutes = Math.floor((absolute % MILLISECONDS_PER_HOUR) / MILLISECONDS_PER_MINUTE);
  const seconds = Math.floor((absolute % MILLISECONDS_PER_MINUTE) / MILLISECONDS_PER_SECOND);
  const millisecondsPart = absolute % MILLISECONDS_PER_SECOND;
  const parts: string[] = [];
  if (days > 0) parts.push(plural(days, 'day'));
  if (hours > 0) parts.push(plural(hours, 'hour'));
  if (minutes > 0) parts.push(plural(minutes, 'minute'));
  if (seconds > 0) parts.push(plural(seconds, 'second'));
  if (millisecondsPart > 0 && parts.length === 0) parts.push(plural(millisecondsPart, 'millisecond'));
  const rendered = parts.slice(0, 2).join(', ');
  return milliseconds < 0 ? `${rendered} before start` : rendered;
}

export function getCurrentTime(clock: Clock, timezone: string): CurrentTimeResult {
  validateTimezone(timezone);
  const instant = clock.now();
  const zoned = instant.toZonedDateTimeISO(timezone);
  return {
    utcTime: instant.toString(),
    localIsoTime: zoned.toString(),
    timezone,
    utcOffset: zoned.offset,
    utcOffsetMinutes: zoned.offsetNanoseconds / (60 * 1_000_000_000),
    date: zoned.toPlainDate().toString(),
    dayOfWeek: zoned.toLocaleString('en-US', { weekday: 'long' }),
    unixTimestamp: Math.floor(instant.epochMilliseconds / MILLISECONDS_PER_SECOND),
  };
}

export function calculateElapsedTime(
  startValue: string,
  endValue: string | undefined,
  timezone: string,
  clock: Clock,
): ElapsedTimeResult {
  validateTimezone(timezone);
  const start = parseInstant(startValue, 'start');
  const end = endValue ? parseInstant(endValue, 'end') : clock.now();
  const totalMilliseconds = end.epochMilliseconds - start.epochMilliseconds;
  const absolute = Math.abs(totalMilliseconds);
  const startDate = start.toZonedDateTimeISO(timezone).toPlainDate();
  const endDate = end.toZonedDateTimeISO(timezone).toPlainDate();

  return {
    startUtc: start.toString(),
    endUtc: end.toString(),
    timezone,
    totalMilliseconds,
    seconds: totalMilliseconds / MILLISECONDS_PER_SECOND,
    minutes: totalMilliseconds / MILLISECONDS_PER_MINUTE,
    hours: totalMilliseconds / MILLISECONDS_PER_HOUR,
    exactDays: totalMilliseconds / MILLISECONDS_PER_DAY,
    exactDayBreakdown: {
      days: Math.floor(absolute / MILLISECONDS_PER_DAY),
      hours: Math.floor((absolute % MILLISECONDS_PER_DAY) / MILLISECONDS_PER_HOUR),
      minutes: Math.floor((absolute % MILLISECONDS_PER_HOUR) / MILLISECONDS_PER_MINUTE),
      seconds: Math.floor((absolute % MILLISECONDS_PER_MINUTE) / MILLISECONDS_PER_SECOND),
      milliseconds: absolute % MILLISECONDS_PER_SECOND,
    },
    calendarDayDifference: startDate.until(endDate, { largestUnit: 'day' }).days,
    humanReadable: humanize(totalMilliseconds),
    endBeforeStart: totalMilliseconds < 0,
  };
}
