import type { Temporal } from '@js-temporal/polyfill';
import type { ReferenceType, TemporalResolution } from '@sudarshanchaudhari/temporalthread-shared-types';
import {
  calendarDateRange,
  parseAnchor,
  parseClockSuffix,
  type ResolvedRange,
  resolveWallClock,
  startOfDate,
  validateTimezone,
} from './temporal-helpers.js';

export const TEMPORAL_PARSER_VERSION = '0.1.0';

const weekdays = new Map<string, number>([
  ['monday', 1],
  ['tuesday', 2],
  ['wednesday', 3],
  ['thursday', 4],
  ['friday', 5],
  ['saturday', 6],
  ['sunday', 7],
]);

const numberWords = new Map<string, number>([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['an', 1],
  ['a', 1],
]);

const normalize = (expression: string): string => expression.trim().toLowerCase().replace(/\s+/g, ' ');

function result(
  originalExpression: string,
  normalizedExpression: string,
  referenceType: ReferenceType,
  anchor: Temporal.Instant,
  timezone: string,
  range: ResolvedRange,
  explanation: string,
): TemporalResolution {
  return {
    originalExpression,
    normalizedExpression,
    referenceType,
    anchorTimeUtc: anchor.toString(),
    anchorTimezone: timezone,
    resolvedStartUtc: range.start,
    resolvedEndUtc: range.end,
    resolutionType: range.resolutionType,
    confidence: range.confidence,
    explanation,
    ambiguity: range.ambiguity,
    parserVersion: TEMPORAL_PARSER_VERSION,
  };
}

function resolveDateExpression(
  original: string,
  normalized: string,
  base: string,
  anchor: Temporal.Instant,
  timezone: string,
  date: Temporal.PlainDate,
  clock: ReturnType<typeof parseClockSuffix>['clock'],
): TemporalResolution {
  const range = clock ? resolveWallClock(date, clock, timezone) : calendarDateRange(date, timezone);
  const targetDescription = clock ? 'the requested local wall time' : 'the target calendar day';
  return result(
    original,
    normalized,
    base.startsWith('next ') ? 'calendar' : 'relative',
    anchor,
    timezone,
    range,
    `${original} resolves to ${targetDescription} in ${timezone}; the range end is exclusive.`,
  );
}

export function resolveRelativeTime(
  expression: string,
  anchorTime: string,
  timezone: string,
  _locale = 'en-US',
): TemporalResolution {
  validateTimezone(timezone);
  const anchor = parseAnchor(anchorTime);
  const anchorZoned = anchor.toZonedDateTimeISO(timezone);
  const original = expression.trim();
  const normalized = normalize(original);
  const { base, clock } = parseClockSuffix(normalized);
  const anchorDate = anchorZoned.toPlainDate();

  if (base === 'tomorrow' || base === 'yesterday' || base === 'today') {
    const offset = base === 'tomorrow' ? 1 : base === 'yesterday' ? -1 : 0;
    return resolveDateExpression(
      original,
      normalized,
      base,
      anchor,
      timezone,
      anchorDate.add({ days: offset }),
      clock,
    );
  }

  const weekdayMatch = base.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (weekdayMatch) {
    const weekday = weekdays.get(weekdayMatch[1] as string) as number;
    const rawDelta = (weekday - anchorZoned.dayOfWeek + 7) % 7;
    const days = rawDelta === 0 ? 7 : rawDelta;
    const resolved = resolveDateExpression(
      original,
      normalized,
      base,
      anchor,
      timezone,
      anchorDate.add({ days }),
      clock,
    );
    return {
      ...resolved,
      confidence: Math.min(resolved.confidence, 0.9),
      ambiguity:
        resolved.ambiguity ??
        '“Next” can vary by convention; resolved to the next occurrence strictly after the anchor date.',
    };
  }

  if (base === 'later today') {
    return result(
      original,
      normalized,
      'fuzzy',
      anchor,
      timezone,
      {
        start: anchor.toString(),
        end: startOfDate(anchorDate.add({ days: 1 }), timezone)
          .toInstant()
          .toString(),
        resolutionType: 'fuzzy',
        confidence: 0.5,
        ambiguity:
          '“Later” does not identify an exact time; this is the remaining portion of the anchor day.',
      },
      `The phrase is intentionally represented as a broad range in ${timezone}.`,
    );
  }

  if (base === 'later') {
    return result(
      original,
      normalized,
      'fuzzy',
      anchor,
      timezone,
      {
        start: null,
        end: null,
        resolutionType: 'fuzzy',
        confidence: 0.2,
        ambiguity: '“Later” has no bounded date or time.',
      },
      'No timestamp was invented for this inherently vague expression.',
    );
  }

  if (base === 'this evening') {
    const start = resolveWallClock(anchorDate, { hour: 17, minute: 0 }, timezone);
    const end = resolveWallClock(anchorDate, { hour: 21, minute: 0 }, timezone);
    return result(
      original,
      normalized,
      'day-part',
      anchor,
      timezone,
      {
        start: start.start,
        end: end.end,
        resolutionType: 'range',
        confidence: 0.7,
        ambiguity: '“Evening” is modeled as the configurable convention 17:00–21:00 local time.',
      },
      `This evening is represented as a local-time range in ${timezone}.`,
    );
  }

  const durationMatch = base.match(
    /^in\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(minutes?|hours?|days?|weeks?)$/,
  );
  if (durationMatch) {
    const token = durationMatch[1] as string;
    const amount = numberWords.get(token) ?? Number.parseInt(token, 10);
    const unit = durationMatch[2] as string;
    const duration = unit.startsWith('minute')
      ? { minutes: amount }
      : unit.startsWith('hour')
        ? { hours: amount }
        : unit.startsWith('week')
          ? { weeks: amount }
          : { days: amount };
    const target =
      unit.startsWith('minute') || unit.startsWith('hour')
        ? anchor.add(duration).toString()
        : anchorZoned.add(duration).toInstant().toString();
    return result(
      original,
      normalized,
      'duration',
      anchor,
      timezone,
      { start: target, end: target, resolutionType: 'exact', confidence: 1, ambiguity: null },
      `${original} is added to the supplied anchor; hour/minute units are exact elapsed time and day/week units preserve local calendar time.`,
    );
  }

  if (base === 'next week') {
    const daysToNextMonday = 8 - anchorZoned.dayOfWeek;
    const startDate = anchorDate.add({ days: daysToNextMonday });
    return result(
      original,
      normalized,
      'calendar',
      anchor,
      timezone,
      {
        start: startOfDate(startDate, timezone).toInstant().toString(),
        end: startOfDate(startDate.add({ weeks: 1 }), timezone)
          .toInstant()
          .toString(),
        resolutionType: 'range',
        confidence: 0.9,
        ambiguity: 'Week boundaries use the ISO convention: Monday through the following Monday.',
      },
      `Next week is the next ISO calendar week in ${timezone}.`,
    );
  }

  if (base === 'a few days ago') {
    return result(
      original,
      normalized,
      'fuzzy',
      anchor,
      timezone,
      {
        start: startOfDate(anchorDate.subtract({ days: 5 }), timezone)
          .toInstant()
          .toString(),
        end: startOfDate(anchorDate.subtract({ days: 1 }), timezone)
          .toInstant()
          .toString(),
        resolutionType: 'fuzzy',
        confidence: 0.4,
        ambiguity: '“A few” is represented as two to five calendar days before the anchor date.',
      },
      `The vague quantity is preserved as a range in ${timezone}.`,
    );
  }

  return result(
    original,
    normalized,
    'relative',
    anchor,
    timezone,
    {
      start: null,
      end: null,
      resolutionType: 'unresolved',
      confidence: 0,
      ambiguity: 'Unsupported expression.',
    },
    'The expression was preserved without fabricating a timestamp.',
  );
}
