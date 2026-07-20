import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { auditTarball, repositoryRoot } from './release-artifact-utils.mjs';
import { releasePackages, releaseVersion } from './release-packages.mjs';

function verificationArguments() {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
  const options = {
    artifactDirectory: resolve(repositoryRoot, 'release-artifacts'),
    expectedCommit: undefined,
    requireClean: false,
    requireSbom: false,
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--artifacts' && arguments_[index + 1]) {
      options.artifactDirectory = resolve(repositoryRoot, arguments_[index + 1]);
      index += 1;
    } else if (argument === '--expected-commit' && arguments_[index + 1]) {
      options.expectedCommit = arguments_[index + 1].toLowerCase();
      index += 1;
    } else if (argument === '--require-clean') {
      options.requireClean = true;
    } else if (argument === '--require-sbom') {
      options.requireSbom = true;
    } else {
      throw new Error(
        'Usage: pnpm verify:release-artifacts -- [--artifacts <directory>] [--expected-commit <sha>] [--require-clean] [--require-sbom]',
      );
    }
  }
  if (options.expectedCommit && !/^[0-9a-f]{40}$/u.test(options.expectedCommit)) {
    throw new Error('Expected commit must be a complete 40-character hexadecimal Git commit ID');
  }
  return options;
}

const { artifactDirectory, expectedCommit, requireClean, requireSbom } = verificationArguments();
for (const required of ['release-manifest.json', 'SHA256SUMS']) {
  if (!existsSync(resolve(artifactDirectory, required))) {
    throw new Error(`Release artifacts are missing ${required}`);
  }
}

const expectedNames = new Set([
  ...releasePackages.map((item) => item.archive),
  'release-manifest.json',
  'SHA256SUMS',
  'temporalthread-v0.1.0.spdx.json',
]);
const unexpectedArtifacts = readdirSync(artifactDirectory)
  .filter((name) => !expectedNames.has(name))
  .sort();
if (unexpectedArtifacts.length) {
  throw new Error(`Unexpected files in release artifact directory: ${unexpectedArtifacts.join(', ')}`);
}

const manifest = JSON.parse(readFileSync(resolve(artifactDirectory, 'release-manifest.json'), 'utf8'));
if (
  manifest.schemaVersion !== 1 ||
  manifest.releaseCandidate !== true ||
  manifest.version !== releaseVersion ||
  !['clean', 'dirty'].includes(manifest.sourceTree) ||
  !Array.isArray(manifest.packages)
) {
  throw new Error('Release manifest metadata is invalid');
}
if (requireClean && manifest.sourceTree !== 'clean') {
  throw new Error('Release artifacts were not built from a clean source tree');
}
if (expectedCommit && manifest.sourceCommit !== expectedCommit) {
  throw new Error('Release artifact source commit does not match the expected commit');
}

const checksums = readFileSync(resolve(artifactDirectory, 'SHA256SUMS'), 'utf8')
  .trim()
  .split(/\r?\n/u)
  .filter(Boolean);
const audited = releasePackages.map((spec) => auditTarball(resolve(artifactDirectory, spec.archive), spec));
const expectedChecksums = [...audited]
  .sort((left, right) => left.filename.localeCompare(right.filename))
  .map((item) => `${item.sha256}  ${item.filename}`);
if (!isDeepStrictEqual(checksums, expectedChecksums)) {
  throw new Error('SHA256SUMS does not match the release tarballs');
}
if (!isDeepStrictEqual(manifest.packages, audited)) {
  throw new Error('Release manifest package evidence does not match the release tarballs');
}

const sbomPath = resolve(artifactDirectory, 'temporalthread-v0.1.0.spdx.json');
let sbom = null;
if (requireSbom && !existsSync(sbomPath)) {
  throw new Error('Release artifacts are missing the required SPDX SBOM');
}
if (existsSync(sbomPath)) {
  sbom = JSON.parse(readFileSync(sbomPath, 'utf8'));
  if (
    sbom.spdxVersion !== 'SPDX-2.3' ||
    sbom.dataLicense !== 'CC0-1.0' ||
    !Array.isArray(sbom.packages) ||
    !Array.isArray(sbom.relationships)
  ) {
    throw new Error('SPDX SBOM is structurally invalid');
  }
  if (!sbom.documentNamespace.includes(`/${manifest.sourceCommit}/`)) {
    throw new Error('SPDX SBOM is not associated with the release manifest source commit');
  }
  for (const spec of releasePackages) {
    if (!sbom.packages.some((item) => item.name === spec.name && item.versionInfo === releaseVersion)) {
      throw new Error(`SPDX SBOM is missing ${spec.name}@${releaseVersion}`);
    }
  }
}

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    packages: audited.length,
    files: audited.reduce((sum, item) => sum + item.fileCount, 0),
    checksums: checksums.length,
    sbom: sbom ? 'SPDX-2.3' : 'not-present',
    sourceTree: manifest.sourceTree,
  })}\n`,
);
