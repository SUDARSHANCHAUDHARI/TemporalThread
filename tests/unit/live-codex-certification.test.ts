import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const certification = await import('../../scripts/live-codex-certification-utils.mjs');

const temporaryRoots: string[] = [];

function temporaryRoot(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `temporalthread-cert-test-${label}-`));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    certification.removeTestDirectory(root);
  }
});

describe('live Codex certification safety utilities', () => {
  it('handles POSIX, Windows, spaces, and Unicode containment without prefix confusion', () => {
    expect(certification.isPathInside('/tmp/cert root Ω', '/tmp/cert root Ω/Project space', posix)).toBe(
      true,
    );
    expect(certification.isPathInside('/tmp/cert', '/tmp/cert-escape', posix)).toBe(false);
    expect(
      certification.isPathInside('C:\\Temp\\Cert Root Ω', 'c:\\temp\\cert root Ω\\Project space', win32),
    ).toBe(true);
    expect(certification.isPathInside('C:\\Temp\\Cert', 'C:\\Temp\\Cert-escape', win32)).toBe(false);
    expect(certification.isPathInside('\\\\?\\C:\\Temp\\Cert', 'C:\\Temp\\Cert\\Project', win32)).toBe(true);
    expect(certification.isPathInside('\\\\?\\C:\\Temp\\Cert', 'C:\\Work\\Repository', win32)).toBe(false);
  });

  it('creates a fully isolated non-host environment and keeps the existing PATH', () => {
    const root = temporaryRoot('environment');
    const paths = certification.certificationPaths(root);
    const environment = certification.buildIsolatedEnvironment(
      paths,
      {
        PATH: '/trusted/bin',
        NODE_AUTH_TOKEN: 'must-not-reach-child',
        OPENAI_API_KEY: 'must-not-reach-child',
        'npm_config_//registry.npmjs.org/:_authToken': 'must-not-reach-child',
      },
      'linux',
    );

    expect(environment).toMatchObject({
      HOME: paths.setupHome,
      USERPROFILE: paths.setupHome,
      TEMPORALTHREAD_HOME: paths.temporalThreadHome,
      TMPDIR: paths.processTemp,
      TEMP: paths.processTemp,
      TMP: paths.processTemp,
      npm_config_cache: paths.npmCache,
      npm_config_userconfig: paths.npmUserConfig,
      NO_COLOR: '1',
    });
    expect(environment.PATH).toContain(paths.executableDirectory);
    expect(environment.PATH).toContain('/trusted/bin');
    expect(environment.NODE_AUTH_TOKEN).toBeUndefined();
    expect(environment.OPENAI_API_KEY).toBeUndefined();
    expect(environment['npm_config_//registry.npmjs.org/:_authToken']).toBeUndefined();
  });

  it('declares the MCP SDK as a direct certification-harness dependency', () => {
    const manifest = certification.createCertificationConsumerManifest(
      { temporalthread: 'file:../temporalthread-0.1.0.tgz' },
      '1.29.0',
    );

    expect(manifest.dependencies).toEqual({
      temporalthread: 'file:../temporalthread-0.1.0.tgz',
      '@modelcontextprotocol/sdk': '1.29.0',
    });
  });

  it('refuses the real home, repository root, and a non-temporary parent', () => {
    const root = temporaryRoot('refusal');
    expect(() =>
      certification.assertSafeCertificationParent({
        parent: '/Users/example',
        userHome: '/Users/example',
        repositoryRoot: '/work/repository',
        systemTemp: root,
      }),
    ).toThrow('real home');
    expect(() =>
      certification.assertSafeCertificationParent({
        parent: '/work/repository',
        userHome: '/Users/example',
        repositoryRoot: '/work/repository',
        systemTemp: root,
      }),
    ).toThrow('repository root');
    expect(() =>
      certification.assertSafeCertificationParent({
        parent: '/opt/not-temporary',
        userHome: '/Users/example',
        repositoryRoot: '/work/repository',
        systemTemp: root,
      }),
    ).toThrow('system temporary directory');
  });

  it('creates a new root for every preparation and safely refuses reuse', () => {
    const parent = temporaryRoot('new-root');
    const first = certification.createCertificationRoot(parent);
    const second = certification.createCertificationRoot(parent);
    temporaryRoots.push(first, second);
    const id = '123e4567-e89b-42d3-a456-426614174000';
    certification.initializeCertificationRoot(first, id);

    expect(first).not.toBe(second);
    expect(() => certification.initializeCertificationRoot(first, id)).toThrow('already initialized');
  });

  it.runIf(process.platform !== 'win32')('refuses a symlink that escapes the certification root', () => {
    const root = temporaryRoot('symlink-root');
    const outside = temporaryRoot('symlink-outside');
    const link = join(root, 'Project Ω with spaces');
    symlinkSync(outside, link, 'dir');

    expect(() => certification.assertManagedPath(root, join(link, 'unsafe.txt'))).toThrow('symbolic link');
  });

  it('sanitizes diagnostics without leaking home, repository, temporary, or marker values', () => {
    const marker = 'TT_CERT_PRIVATE_0123456789';
    const diagnostic = certification.sanitizeCertificationDiagnostic(
      `/Users/maintainer/project failed at /tmp/cert with ${marker}`,
      {
        repositoryRoot: '/Users/maintainer/project',
        userHome: '/Users/maintainer',
        temporaryRoot: '/tmp/cert',
        privacyMarker: marker,
      },
    );

    expect(diagnostic).toBe('<repository> failed at <temporary> with <privacy-marker>');
    expect(diagnostic).not.toContain('/Users/maintainer');
    expect(diagnostic).not.toContain(marker);
  });

  it('checks exact nine-tool discovery without accepting extras or leaking names in errors', () => {
    expect(() => certification.assertExactToolDiscovery(certification.EXPECTED_MCP_TOOLS)).not.toThrow();
    expect(() =>
      certification.assertExactToolDiscovery([...certification.EXPECTED_MCP_TOOLS, 'unexpected']),
    ).toThrow('Expected exactly nine');
  });

  it('computes the controlled scenario relative to a minute-stable instant', () => {
    const scenario = certification.computeControlledScenario(Date.parse('2026-07-23T12:34:56.789Z'));

    expect(scenario.now).toBe('2026-07-23T12:34:00Z');
    expect(scenario.previous).toBe('2026-07-19T09:34:00Z');
    expect(scenario.due).toBe('2026-07-20T09:34:00Z');
    expect(Date.parse(scenario.now) - Date.parse(scenario.previous)).toBe(99 * 60 * 60 * 1_000);
    expect(Date.parse(scenario.due) - Date.parse(scenario.previous)).toBe(24 * 60 * 60 * 1_000);
  });

  it('evaluates installed, uninstalled, and purged data lifecycle stages', () => {
    expect(
      certification.evaluateCertificationStage('installed', {
        integrationPresent: true,
        databaseExists: true,
        unrelatedConfigPreserved: true,
        interactions: 1,
        commitments: 1,
      }),
    ).toEqual([]);
    expect(
      certification.evaluateCertificationStage('uninstalled', {
        integrationPresent: false,
        databaseExists: true,
        unrelatedConfigPreserved: true,
        interactions: 2,
        commitments: 1,
      }),
    ).toEqual([]);
    expect(
      certification.evaluateCertificationStage('purged', {
        integrationPresent: false,
        databaseExists: true,
        unrelatedConfigPreserved: true,
        interactions: 0,
        commitments: 0,
      }),
    ).toEqual([]);
  });

  it('rejects missing uninstall preservation and incomplete explicit purge', () => {
    expect(
      certification.evaluateCertificationStage('uninstalled', {
        integrationPresent: false,
        databaseExists: false,
        unrelatedConfigPreserved: true,
        interactions: 0,
        commitments: 0,
      }),
    ).toContain('The isolated database was not preserved');
    expect(
      certification.evaluateCertificationStage('purged', {
        integrationPresent: false,
        databaseExists: true,
        unrelatedConfigPreserved: true,
        interactions: 1,
        commitments: 0,
      }),
    ).toContain('Explicit purge left isolated domain data');
  });

  it('renders relative POSIX and Windows launchers without a trust bypass or maintainer path', () => {
    const shell = certification.renderPosixLauncher();
    const command = certification.renderWindowsLauncher();

    for (const content of [shell, command]) {
      expect(content).toContain('CODEX_HOME');
      expect(content).toContain('TEMPORALTHREAD_HOME');
      expect(content).not.toContain('dangerously-bypass');
      expect(content).not.toContain('/Users/');
      expect(content).not.toContain('C:\\Users\\');
    }
    expect(command).toContain('temporalthread.cmd');
    expect(shell).toContain('exec codex');
  });

  it('terminates a timed-out child process and sanitizes the temporary path', () => {
    const root = temporaryRoot('child-cleanup');
    const pidPath = join(root, 'child.pid');
    let message = '';
    try {
      certification.runCertificationCommand({
        operation: 'bounded child cleanup check',
        executable: process.execPath,
        arguments: [
          '-e',
          `require('node:fs').writeFileSync(${JSON.stringify(pidPath)}, String(process.pid)); process.stderr.write(${JSON.stringify(root)}); setInterval(() => {}, 1000);`,
        ],
        cwd: root,
        env: process.env,
        replacements: { temporaryRoot: root },
        timeoutMs: 5_000,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    const childPid = Number(readFileSync(pidPath, 'utf8'));
    expect(message).toContain('<temporary>');
    expect(message).not.toContain(root);
    expect(() => process.kill(childPid, 0)).toThrow();
  }, 10_000);

  it('validates a content-free manifest and rejects unknown fields or unsafe paths', () => {
    const root = temporaryRoot('manifest');
    const paths = certification.certificationPaths(root);
    const manifest = certification.createCertificationManifest({
      certificationId: '123e4567-e89b-42d3-a456-426614174000',
      expectedCommit: 'a'.repeat(40),
      timezone: 'UTC',
      paths,
      privacyMarkerSha256: 'b'.repeat(64),
      createdAt: '2026-07-23T12:34:00.000Z',
      scenario: certification.computeControlledScenario(Date.parse('2026-07-23T12:34:00.000Z')),
    });

    expect(certification.validateCertificationManifest(manifest, root)).toEqual(manifest);
    expect(JSON.stringify(manifest)).not.toContain('TT_CERT_PRIVATE');
    expect(() => certification.validateCertificationManifest({ ...manifest, extra: true }, root)).toThrow(
      'unknown field',
    );
    expect(() =>
      certification.validateCertificationManifest(
        { ...manifest, projectRoot: join(root, '..', 'escape') },
        root,
      ),
    ).toThrow('outside');
  });

  it('detects privacy-marker leakage without repeating the marker in diagnostics', () => {
    const marker = 'TT_CERT_PRIVATE_DO_NOT_REPEAT';
    expect(() =>
      certification.assertPrivacyMarkerAbsent({ rawText: null, textPreview: null }, marker),
    ).not.toThrow();
    let message = '';
    try {
      certification.assertPrivacyMarkerAbsent({ rawText: marker }, marker);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('Privacy marker');
    expect(message).not.toContain(marker);
  });

  it('cleans only a marked temporary root and is idempotent after removal', () => {
    const root = temporaryRoot('cleanup');
    const id = '123e4567-e89b-42d3-a456-426614174000';
    certification.initializeCertificationRoot(root, id);
    writeFileSync(join(root, 'private-data.txt'), 'temporary', 'utf8');

    const first = certification.cleanupCertificationRoot({
      root,
      certificationId: id,
      userHome: '/Users/example',
      repositoryRoot: '/work/repository',
      systemTemp: tmpdir(),
    });
    const second = certification.cleanupCertificationRoot({
      root,
      certificationId: id,
      userHome: '/Users/example',
      repositoryRoot: '/work/repository',
      systemTemp: tmpdir(),
    });

    expect(first).toEqual({ removed: true, alreadyRemoved: false });
    expect(second).toEqual({ removed: false, alreadyRemoved: true });
    expect(existsSync(root)).toBe(false);
    temporaryRoots.splice(temporaryRoots.indexOf(root), 1);
  });

  it('refuses cleanup when the marker is absent, mismatched, or outside the temporary root', () => {
    const root = temporaryRoot('cleanup-refusal');
    const unmarked = join(root, 'temporalthread-unmarked');
    mkdirSync(unmarked);
    expect(() =>
      certification.cleanupCertificationRoot({
        root: unmarked,
        certificationId: '123e4567-e89b-42d3-a456-426614174000',
        userHome: '/Users/example',
        repositoryRoot: '/work/repository',
        systemTemp: tmpdir(),
      }),
    ).toThrow('marker');

    const marked = join(root, 'temporalthread-marked');
    mkdirSync(marked);
    certification.initializeCertificationRoot(marked, '123e4567-e89b-42d3-a456-426614174000');
    expect(() =>
      certification.cleanupCertificationRoot({
        root: marked,
        certificationId: '123e4567-e89b-42d3-a456-426614174001',
        userHome: '/Users/example',
        repositoryRoot: '/work/repository',
        systemTemp: tmpdir(),
      }),
    ).toThrow('does not match');

    expect(readFileSync(join(marked, certification.ROOT_MARKER_FILE), 'utf8')).toContain(
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });

  it.runIf(process.platform !== 'win32')(
    'allows internal package-manager symlinks but refuses cleanup of an escaping symlink',
    () => {
      const root = temporaryRoot('cleanup-symlinks');
      const id = '123e4567-e89b-42d3-a456-426614174000';
      const internal = join(root, 'internal-target');
      mkdirSync(internal);
      certification.initializeCertificationRoot(root, id);
      symlinkSync(internal, join(root, 'internal-link'), 'dir');
      expect(
        certification.cleanupCertificationRoot({
          root,
          certificationId: id,
          userHome: '/Users/example',
          repositoryRoot: '/work/repository',
          systemTemp: tmpdir(),
        }),
      ).toEqual({ removed: true, alreadyRemoved: false });
      temporaryRoots.splice(temporaryRoots.indexOf(root), 1);

      const escapingRoot = temporaryRoot('cleanup-symlink-escape');
      const outside = temporaryRoot('cleanup-symlink-outside');
      certification.initializeCertificationRoot(escapingRoot, id);
      symlinkSync(outside, join(escapingRoot, 'escaping-link'), 'dir');
      expect(() =>
        certification.cleanupCertificationRoot({
          root: escapingRoot,
          certificationId: id,
          userHome: '/Users/example',
          repositoryRoot: '/work/repository',
          systemTemp: tmpdir(),
        }),
      ).toThrow('escapes');
    },
  );
});
