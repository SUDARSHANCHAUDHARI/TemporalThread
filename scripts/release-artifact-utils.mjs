import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { releaseVersion } from './release-packages.mjs';

export const repositoryRoot = resolve(import.meta.dirname, '..');
export const repositoryUrl = 'git+https://github.com/SUDARSHANCHAUDHARI/TemporalThread.git';
const maximumDiagnosticCharacters = 4_000;

export function sanitizeDiagnostic(value, temporaryRoot) {
  const replacements = [
    [repositoryRoot, '<repository>'],
    ...(temporaryRoot ? [[temporaryRoot, '<temporary>']] : []),
    [homedir(), '$HOME'],
  ];
  let result = String(value ?? '');
  for (const [sensitive, replacement] of replacements) {
    if (sensitive) result = result.replaceAll(sensitive, replacement);
  }
  result = result
    .replace(
      /((?:authorization|token|secret|password|api[_-]?key)["']?\s*[=:]\s*["']?)[^\s,"']+/giu,
      '$1<redacted>',
    )
    .replace(
      /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|npm_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,})\b/gu,
      '<redacted-token>',
    )
    .trim();
  return result.length > maximumDiagnosticCharacters
    ? `${result.slice(0, maximumDiagnosticCharacters)}…[truncated]`
    : result || '<empty>';
}

export function runChecked(operation, executable, arguments_, options = {}) {
  const result = spawnSync(executable, arguments_, {
    cwd: options.cwd ?? repositoryRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
    input: options.input,
    maxBuffer: options.maxBuffer ?? 20 * 1_024 * 1_024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${operation} failed`,
        `exit status: ${result.status ?? 'unavailable'}`,
        `signal: ${result.signal ?? 'none'}`,
        `stdout:\n${sanitizeDiagnostic(result.stdout, options.temporaryRoot)}`,
        `stderr:\n${sanitizeDiagnostic(result.stderr, options.temporaryRoot)}`,
      ].join('\n'),
    );
  }
  return result.stdout;
}

export function runPnpm(operation, arguments_, options = {}) {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) throw new Error(`${operation} must run through a pnpm package script`);
  return runChecked(operation, process.execPath, [pnpmCli, ...arguments_], {
    ...options,
    env: { ...process.env, NO_COLOR: '1', ...options.env },
  });
}

function tarString(buffer, start, length) {
  const nul = buffer.indexOf(0, start);
  const end = nul >= start && nul < start + length ? nul : start + length;
  return buffer.subarray(start, end).toString('utf8').trim();
}

function tarNumber(buffer, start, length) {
  const value = tarString(buffer, start, length).replaceAll('\0', '').trim();
  if (!value) return 0;
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Tarball contains an invalid size');
  return parsed;
}

function parsePax(content) {
  const result = {};
  let offset = 0;
  while (offset < content.length) {
    const space = content.indexOf(0x20, offset);
    if (space < 0) break;
    const length = Number.parseInt(content.subarray(offset, space).toString('ascii'), 10);
    if (!Number.isSafeInteger(length) || length <= 0 || offset + length > content.length) break;
    const record = content.subarray(space + 1, offset + length - 1).toString('utf8');
    const equals = record.indexOf('=');
    if (equals > 0) result[record.slice(0, equals)] = record.slice(equals + 1);
    offset += length;
  }
  return result;
}

export function readTarball(archivePath) {
  const compressed = readFileSync(archivePath);
  const buffer = gunzipSync(compressed);
  const entries = [];
  let offset = 0;
  let pax = {};
  let longPath;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const storedChecksum = tarNumber(header, 148, 8);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const calculatedChecksum = checksumHeader.reduce((sum, value) => sum + value, 0);
    if (storedChecksum !== calculatedChecksum) throw new Error('Tarball header checksum is invalid');

    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const size = tarNumber(header, 124, 12);
    const mode = tarNumber(header, 100, 8);
    const type = String.fromCharCode(header[156] || 0);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > buffer.length) throw new Error('Tarball entry extends beyond the archive');
    const content = buffer.subarray(contentStart, contentEnd);
    const headerPath = prefix ? `${prefix}/${name}` : name;

    if (type === 'x') pax = { ...pax, ...parsePax(content) };
    else if (type === 'L') longPath = content.toString('utf8').replace(/\0+$/u, '');
    else {
      const path = String(pax.path ?? longPath ?? headerPath).replace(/^\.\//u, '');
      entries.push({ path, type: type === '\0' ? '0' : type, size, mode, content });
      pax = {};
      longPath = undefined;
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  const seen = new Set();
  for (const entry of entries) {
    if (!entry.path || entry.path.startsWith('/') || entry.path.includes('\\')) {
      throw new Error('Tarball contains an invalid path');
    }
    const segments = entry.path.split('/');
    if (segments.includes('..') || segments.includes('.')) throw new Error('Tarball contains path traversal');
    if (seen.has(entry.path)) throw new Error(`Tarball contains duplicate path: ${entry.path}`);
    seen.add(entry.path);
  }
  return { compressed, entries };
}

function packagePath(path) {
  if (!path.startsWith('package/')) throw new Error('Tarball entry is outside the package root');
  return path.slice('package/'.length);
}

function isAllowedFile(path, packageName) {
  if (['LICENSE', 'README.md', 'package.json'].includes(path)) return true;
  if (/^dist\/.+\.(?:d\.ts|d\.ts\.map|js|js\.map)$/u.test(path)) return true;
  if (packageName === '@sudarshanchaudhari/temporalthread-codex-integration') {
    return path === 'hooks.json' || path.startsWith('plugin/');
  }
  return false;
}

function forbiddenPath(path) {
  const lower = path.toLowerCase();
  const segments = lower.split('/');
  return (
    segments.some((segment) =>
      ['.git', '.github', '.agents', 'node_modules', 'coverage'].includes(segment),
    ) ||
    segments.some((segment) => segment === '.env' || segment.startsWith('.env.')) ||
    segments.some((segment) => segment === 'src' || segment === 'test' || segment === 'tests') ||
    segments.some((segment) => segment === 'tmp' || segment === 'temp') ||
    lower.endsWith('.tsbuildinfo') ||
    lower.endsWith('.sqlite') ||
    lower.endsWith('.sqlite-shm') ||
    lower.endsWith('.sqlite-wal') ||
    lower.endsWith('.log') ||
    lower.endsWith('tsconfig.json')
  );
}

function textLooksSensitive(content) {
  if (content.includes(repositoryRoot) || content.includes(homedir())) return true;
  if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\//u.test(content)) return true;
  if (/[A-Za-z]:\\Users\\[^\\]+\\/u.test(content)) return true;
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(content)) return true;
  if (
    /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|npm_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,})\b/u.test(
      content,
    )
  )
    return true;
  return /(?:token|secret|password|api[_-]?key)["']?\s*[=:]\s*["'][^"'\n]{12,}["']/iu.test(content);
}

function parseManifest(entries) {
  const entry = entries.find((candidate) => packagePath(candidate.path) === 'package.json');
  if (entry?.type !== '0') throw new Error('Tarball is missing a regular package.json');
  try {
    return JSON.parse(entry.content.toString('utf8'));
  } catch {
    throw new Error('Tarball package.json is invalid JSON');
  }
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function auditTarball(archivePath, spec) {
  const { compressed, entries } = readTarball(archivePath);
  const files = entries.filter((entry) => entry.type !== '5');
  const unsafeTypes = files.filter((entry) => !['0', '7'].includes(entry.type));
  if (unsafeTypes.length) throw new Error(`${spec.archive} contains links or unsupported entry types`);
  const paths = files.map((entry) => packagePath(entry.path)).sort();
  const unexpectedFiles = paths.filter((path) => forbiddenPath(path) || !isAllowedFile(path, spec.name));
  if (unexpectedFiles.length) {
    throw new Error(`${spec.archive} contains unexpected release files: ${unexpectedFiles.join(', ')}`);
  }
  for (const required of ['LICENSE', 'README.md', 'package.json']) {
    if (!paths.includes(required)) throw new Error(`${spec.archive} is missing ${required}`);
  }

  const manifest = parseManifest(entries);
  if (manifest.name !== spec.name || manifest.version !== releaseVersion) {
    throw new Error(`${spec.archive} package identity does not match the release plan`);
  }
  if (manifest.private === true || manifest.publishConfig?.access !== 'public') {
    throw new Error(`${spec.archive} is not explicitly configured as a public package`);
  }
  if (manifest.license !== 'MIT' || !manifest.description || !manifest.engines?.node) {
    throw new Error(`${spec.archive} is missing required license, description, or Node engine metadata`);
  }
  if (manifest.repository?.url !== repositoryUrl || !manifest.repository?.directory) {
    throw new Error(`${spec.archive} repository metadata is incomplete or incorrect`);
  }
  if (
    typeof manifest.homepage !== 'string' ||
    typeof manifest.bugs?.url !== 'string' ||
    /^(?:file:|https?:\/\/(?:localhost|127\.0\.0\.1))/iu.test(manifest.homepage)
  ) {
    throw new Error(`${spec.archive} homepage or issue metadata is invalid`);
  }
  const dependencies = Object.entries(manifest.dependencies ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (dependencies.some(([, version]) => /^(?:workspace:|file:|link:)/u.test(String(version)))) {
    throw new Error(`${spec.archive} contains a local-only dependency specifier`);
  }

  for (const entry of files) {
    const path = packagePath(entry.path);
    if (!/\.(?:json|js|map|md|txt|toml)$/iu.test(path) && path !== 'LICENSE') continue;
    if (textLooksSensitive(entry.content.toString('utf8'))) {
      throw new Error(`${spec.archive} contains sensitive or machine-specific content in ${path}`);
    }
  }

  if (spec.name === 'temporalthread') {
    if (manifest.bin?.temporalthread !== './dist/bin.js') {
      throw new Error('CLI tarball does not expose the expected temporalthread executable');
    }
    const binary = files.find((entry) => packagePath(entry.path) === 'dist/bin.js');
    if (!binary?.content.toString('utf8').startsWith('#!/usr/bin/env node\n')) {
      throw new Error('CLI tarball does not contain the portable Node.js shebang');
    }
  }

  return {
    name: manifest.name,
    version: manifest.version,
    filename: spec.archive,
    compressedSize: compressed.length,
    unpackedSize: files.reduce((sum, entry) => sum + entry.size, 0),
    fileCount: files.length,
    sha256: sha256(compressed),
    runtimeDependencies: Object.fromEntries(dependencies),
    unexpectedFiles: [],
    nativeDependencies: spec.nativeDependencies,
    files: paths,
  };
}
