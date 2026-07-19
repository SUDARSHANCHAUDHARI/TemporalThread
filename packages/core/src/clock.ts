import { Temporal } from '@js-temporal/polyfill';

export interface Clock {
  now(): Temporal.Instant;
}

export class SystemClock implements Clock {
  now(): Temporal.Instant {
    return Temporal.Now.instant();
  }
}

export class FakeClock implements Clock {
  private instant: Temporal.Instant;

  constructor(initialInstant: string | Temporal.Instant) {
    this.instant =
      typeof initialInstant === 'string' ? Temporal.Instant.from(initialInstant) : initialInstant;
  }

  now(): Temporal.Instant {
    return this.instant;
  }

  set(instant: string | Temporal.Instant): void {
    this.instant = typeof instant === 'string' ? Temporal.Instant.from(instant) : instant;
  }

  advance(duration: Temporal.DurationLike): void {
    const milliseconds = Temporal.Duration.from(duration).total({ unit: 'milliseconds' });
    this.instant = this.instant.add({ milliseconds });
  }
}
