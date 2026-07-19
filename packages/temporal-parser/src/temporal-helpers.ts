import { Temporal } from '@js-temporal/polyfill';
import type { ResolutionType } from '@temporalthread/shared-types';

export interface ResolvedRange {
  start: string | null;
  end: string | null;
  resolutionType: ResolutionType;
  confidence: number;
  ambiguity: string | null;
}

export interface ClockTime {
  hour: number;
  minute: number;
}

export function parseAnchor(anchorTime: string): Temporal.Instant {
  try {
    return Temporal.Instant.from(anchorTime);
  } catch (error) {
    throw new Error('anchorTime must be an ISO 8601 timestamp with a UTC offset', { cause: error });
  }
}

export function validateTimezone(timezone: string): void {
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(timezone);
  } catch (error) {
    throw new Error(`Invalid IANA timezone: ${timezone}`, { cause: error });
  }
}

export function startOfDate(date: Temporal.PlainDate, timezone: string): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from({
    timeZone: timezone,
    year: date.year,
    month: date.month,
    day: date.day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
}

export function calendarDateRange(date: Temporal.PlainDate, timezone: string): ResolvedRange {
  return {
    start: startOfDate(date, timezone).toInstant().toString(),
    end: startOfDate(date.add({ days: 1 }), timezone)
      .toInstant()
      .toString(),
    resolutionType: 'range',
    confidence: 1,
    ambiguity: null,
  };
}

const matchesClock = (value: Temporal.ZonedDateTime, date: Temporal.PlainDate, clock: ClockTime): boolean =>
  value.year === date.year &&
  value.month === date.month &&
  value.day === date.day &&
  value.hour === clock.hour &&
  value.minute === clock.minute;

export function resolveWallClock(
  date: Temporal.PlainDate,
  clock: ClockTime,
  timezone: string,
): ResolvedRange {
  const fields = {
    timeZone: timezone,
    year: date.year,
    month: date.month,
    day: date.day,
    hour: clock.hour,
    minute: clock.minute,
    second: 0,
    millisecond: 0,
  };
  const earlier = Temporal.ZonedDateTime.from(fields, { disambiguation: 'earlier' });
  const later = Temporal.ZonedDateTime.from(fields, { disambiguation: 'later' });

  if (Temporal.ZonedDateTime.compare(earlier, later) === 0) {
    const instant = earlier.toInstant().toString();
    return { start: instant, end: instant, resolutionType: 'exact', confidence: 1, ambiguity: null };
  }

  if (matchesClock(earlier, date, clock) && matchesClock(later, date, clock)) {
    return {
      start: earlier.toInstant().toString(),
      end: later.toInstant().toString(),
      resolutionType: 'range',
      confidence: 0.75,
      ambiguity: 'The local wall time occurs twice during the daylight-saving fall-back transition.',
    };
  }

  const compatible = Temporal.ZonedDateTime.from(fields, { disambiguation: 'compatible' });
  const instant = compatible.toInstant().toString();
  return {
    start: instant,
    end: instant,
    resolutionType: 'adjusted',
    confidence: 0.8,
    ambiguity:
      'The local wall time does not exist during the daylight-saving spring-forward transition; shifted forward.',
  };
}

export function parseClockSuffix(expression: string): { base: string; clock: ClockTime | null } {
  const match = expression.match(/\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return { base: expression, clock: null };

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || hour < (meridiem ? 1 : 0)) {
    throw new Error('Invalid local time in relative expression');
  }
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  return { base: expression.slice(0, match.index).trim(), clock: { hour, minute } };
}
