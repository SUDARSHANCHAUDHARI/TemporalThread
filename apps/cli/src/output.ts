export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printLines(lines: string[]): void {
  process.stdout.write(`${lines.join('\n')}\n`);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'TemporalThread command failed';
}
