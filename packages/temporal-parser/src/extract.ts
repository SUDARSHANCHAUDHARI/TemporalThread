import type { TemporalResolution } from '@sudarshanchaudhari/temporalthread-shared-types';
import { resolveRelativeTime } from './parser.js';

const clock = String.raw`(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?`;
const patterns = [
  new RegExp(
    String.raw`\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)${clock}\b`,
    'gi',
  ),
  new RegExp(String.raw`\b(?:tomorrow|yesterday|today)${clock}\b`, 'gi'),
  /\ba few days ago\b/gi,
  /\blater today\b/gi,
  /\bthis evening\b/gi,
  /\bin\s+(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:minutes?|hours?|days?|weeks?)\b/gi,
  /\bnext week\b/gi,
  /\blater\b/gi,
];

interface Match {
  expression: string;
  start: number;
  end: number;
}

export function extractTemporalReferences(
  text: string,
  anchorTime: string,
  timezone: string,
  locale = 'en-US',
): TemporalResolution[] {
  const matches: Match[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const expression = match[0];
      const start = match.index;
      matches.push({ expression, start, end: start + expression.length });
    }
  }

  matches.sort((left, right) => left.start - right.start || right.expression.length - left.expression.length);
  const accepted: Match[] = [];
  for (const match of matches) {
    if (accepted.some((item) => match.start < item.end && match.end > item.start)) continue;
    accepted.push(match);
  }
  return accepted
    .sort((left, right) => left.start - right.start)
    .map((match) => resolveRelativeTime(match.expression, anchorTime, timezone, locale));
}
