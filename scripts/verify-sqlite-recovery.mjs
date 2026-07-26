import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const cliEntry = join(repositoryRoot, 'apps', 'cli', 'dist', 'bin.js');
const verificationRoot = mkdtempSync(join(tmpdir(), 'temporalthread-recovery-'));
const projectRoot = join(verificationRoot, 'Recovery Ω project');
const sourceHome = join(verificationRoot, 'source-home');
const processTemp = join(verificationRoot, 'process-temp');
const backupPath = join(verificationRoot, 'backups', 'temporalthread.sqlite');

mkdirSync(projectRoot, { recursive: true, mode: 0o700 });
mkdirSync(sourceHome, { recursive: true, mode: 0o700 });
mkdirSync(processTemp, { recursive: true, mode: 0o700 });

const baseEnvironment = {
  ...process.env,
  HOME: sourceHome,
  USERPROFILE: sourceHome,
  TEMPORALTHREAD_HOME: join(sourceHome, '.temporalthread'),
  TEMPORALTHREAD_TIMEZONE: 'UTC',
  TEMPORALTHREAD_LOG_LEVEL: 'silent',
  TMPDIR: processTemp,
  TEMP: processTemp,
  TMP: processTemp,
  NO_COLOR: '1',
};
delete baseEnvironment.OPENAI_API_KEY;
delete baseEnvironment.ANTHROPIC_API_KEY;
delete baseEnvironment.NODE_AUTH_TOKEN;

function sanitized(value) {
  return String(value)
    .replaceAll(repositoryRoot, '<repository>')
    .replaceAll(verificationRoot, '<temporary>')
    .slice(0, 4_000);
}

function runCli(arguments_, options = {}) {
  const result = spawnSync(process.execPath, [cliEntry, ...arguments_], {
    cwd: projectRoot,
    env: options.env ?? baseEnvironment,
    encoding: 'utf8',
    ...(options.input === undefined ? {} : { input: options.input }),
    maxBuffer: 10 * 1_024 * 1_024,
  });
  if (result.error || result.status !== (options.expectedStatus ?? 0)) {
    throw new Error(
      [
        `SQLite recovery command returned an unexpected status: ${arguments_.join(' ')}`,
        `status: ${result.status ?? 'unavailable'}`,
        `stdout: ${sanitized(result.stdout)}`,
        `stderr: ${sanitized(result.stderr)}`,
      ].join('\n'),
    );
  }
  return result;
}

function event(idempotencyKey, occurredAt) {
  return JSON.stringify({
    eventType: 'interaction',
    role: 'user',
    occurredAt,
    timezone: 'UTC',
    agent: { name: 'Recovery verifier', platform: 'generic' },
    project: { path: projectRoot, name: 'Recovery project' },
    sessionId: 'recovery-session',
    text: 'Continue tomorrow.',
    idempotencyKey,
  });
}

try {
  if (!existsSync(cliEntry)) throw new Error('Build the workspace before SQLite recovery verification');

  const initialized = JSON.parse(
    runCli(['init', '--yes', '--timezone', 'UTC', '--integration', 'generic', '--json']).stdout,
  );
  if (!existsSync(initialized.databasePath)) throw new Error('Recovery source database was not created');

  const firstIngest = JSON.parse(
    runCli(['ingest', '--json'], {
      input: event('recovery-first', '2026-07-20T10:00:00Z'),
    }).stdout,
  );
  if (firstIngest.ingested !== 1) throw new Error('Recovery source event was not ingested');

  const backup = JSON.parse(runCli(['backup', '--output', backupPath, '--json']).stdout);
  if (
    backup.path !== backupPath ||
    backup.bytes <= 0 ||
    backup.health?.healthy !== true ||
    !existsSync(backupPath)
  ) {
    throw new Error('Verified recovery snapshot was not created correctly');
  }

  const duplicateBackup = runCli(['backup', '--output', backupPath, '--json'], { expectedStatus: 1 });
  if (!duplicateBackup.stderr.includes('Backup destination already exists')) {
    throw new Error('Existing recovery snapshot was not refused safely');
  }

  const secondIngest = JSON.parse(
    runCli(['ingest', '--json'], {
      input: event('recovery-second', '2026-07-21T10:00:00Z'),
    }).stdout,
  );
  if (secondIngest.ingested !== 1) throw new Error('Post-backup source event was not ingested');

  const sourceStatus = JSON.parse(runCli(['status', '--json']).stdout);
  if (sourceStatus.integrity !== 'ok' || sourceStatus.counts.interactions !== 2) {
    throw new Error('Recovery source database failed its final status check');
  }

  const restoredEnvironment = {
    ...baseEnvironment,
    TEMPORALTHREAD_DATABASE_PATH: backupPath,
  };
  const restoredStatus = JSON.parse(runCli(['status', '--json'], { env: restoredEnvironment }).stdout);
  if (restoredStatus.integrity !== 'ok' || restoredStatus.counts.interactions !== 1) {
    throw new Error('Verified snapshot did not reopen as an independent point-in-time recovery database');
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      backupCreated: true,
      backupVerified: true,
      existingDestinationRefused: true,
      sourceInteractions: sourceStatus.counts.interactions,
      restoredInteractions: restoredStatus.counts.interactions,
      pointInTimeIsolation: true,
      sourceIntegrity: sourceStatus.integrity,
      restoredIntegrity: restoredStatus.integrity,
    })}\n`,
  );
} finally {
  rmSync(verificationRoot, { recursive: true, force: true });
}
