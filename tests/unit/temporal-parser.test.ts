import { describe, expect, it } from 'vitest';
import { extractTemporalReferences, resolveRelativeTime } from '../../packages/temporal-parser/src/index.js';

describe('resolveRelativeTime', () => {
  it('resolves a calendar day using the supplied timezone', () => {
    const resolution = resolveRelativeTime('tomorrow', '2026-07-15T20:00:00+07:00', 'Asia/Bangkok');

    expect(resolution.resolvedStartUtc).toBe('2026-07-15T17:00:00Z');
    expect(resolution.resolvedEndUtc).toBe('2026-07-16T17:00:00Z');
    expect(resolution.resolutionType).toBe('range');
  });

  it('treats hours as elapsed time across local midnight', () => {
    const resolution = resolveRelativeTime('in two hours', '2026-07-15T23:30:00+07:00', 'Asia/Bangkok');

    expect(resolution.resolvedStartUtc).toBe('2026-07-15T18:30:00Z');
    expect(resolution.resolvedEndUtc).toBe('2026-07-15T18:30:00Z');
    expect(resolution.resolutionType).toBe('exact');
  });

  it('observes leap days in calendar arithmetic', () => {
    const resolution = resolveRelativeTime('tomorrow', '2024-02-28T12:00:00Z', 'UTC');

    expect(resolution.resolvedStartUtc).toBe('2024-02-29T00:00:00Z');
    expect(resolution.resolvedEndUtc).toBe('2024-03-01T00:00:00Z');
  });

  it('marks a nonexistent spring-forward wall time as adjusted', () => {
    const resolution = resolveRelativeTime(
      'tomorrow at 2:30 am',
      '2026-03-07T12:00:00-05:00',
      'America/New_York',
    );

    expect(resolution.resolvedStartUtc).toBe('2026-03-08T07:30:00Z');
    expect(resolution.resolvedEndUtc).toBe('2026-03-08T07:30:00Z');
    expect(resolution.resolutionType).toBe('adjusted');
    expect(resolution.ambiguity).toContain('does not exist');
  });

  it('preserves both instants for an ambiguous fall-back wall time', () => {
    const resolution = resolveRelativeTime(
      'tomorrow at 1:30 am',
      '2026-10-31T12:00:00-04:00',
      'America/New_York',
    );

    expect(resolution.resolvedStartUtc).toBe('2026-11-01T05:30:00Z');
    expect(resolution.resolvedEndUtc).toBe('2026-11-01T06:30:00Z');
    expect(resolution.resolutionType).toBe('range');
    expect(resolution.ambiguity).toContain('occurs twice');
  });

  it('uses the next weekday strictly after the anchor date', () => {
    const resolution = resolveRelativeTime('next Friday', '2026-07-15T12:00:00+07:00', 'Asia/Bangkok');

    expect(resolution.resolvedStartUtc).toBe('2026-07-16T17:00:00Z');
    expect(resolution.resolvedEndUtc).toBe('2026-07-17T17:00:00Z');
    expect(resolution.ambiguity).toContain('strictly after');
  });

  it('does not invent bounds for an inherently vague expression', () => {
    const resolution = resolveRelativeTime('later', '2026-07-15T12:00:00Z', 'UTC');

    expect(resolution.resolvedStartUtc).toBeNull();
    expect(resolution.resolvedEndUtc).toBeNull();
    expect(resolution.resolutionType).toBe('fuzzy');
    expect(resolution.confidence).toBeLessThan(0.5);
  });

  it('rejects malformed anchors and unknown timezones', () => {
    expect(() => resolveRelativeTime('tomorrow', 'not-a-time', 'UTC')).toThrow(
      'anchorTime must be an ISO 8601 timestamp',
    );
    expect(() => resolveRelativeTime('tomorrow', '2026-07-15T12:00:00Z', 'Mars/Olympus')).toThrow(
      'Invalid IANA timezone',
    );
  });
});

describe('extractTemporalReferences', () => {
  it('extracts references in source order without overlapping generic matches', () => {
    const resolutions = extractTemporalReferences(
      "Let's continue tomorrow. Maybe later today, or next Friday at 3 pm.",
      '2026-07-15T12:00:00+07:00',
      'Asia/Bangkok',
    );

    expect(resolutions.map((item) => item.normalizedExpression)).toEqual([
      'tomorrow',
      'later today',
      'next friday at 3 pm',
    ]);
  });
});
