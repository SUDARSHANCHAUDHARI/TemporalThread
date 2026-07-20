import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { auditTarball, repositoryRoot, runChecked, runPnpm } from './release-artifact-utils.mjs';
import { releasePackages, releaseVersion } from './release-packages.mjs';

function outputArgument() {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
  if (arguments_.length === 0) return resolve(repositoryRoot, 'release-artifacts');
  if (arguments_.length !== 2 || arguments_[0] !== '--output' || !arguments_[1]) {
    throw new Error('Usage: pnpm release:artifacts -- --output <directory>');
  }
  return resolve(repositoryRoot, arguments_[1]);
}

const outputDirectory = outputArgument();
const repositoryFromOutput = relative(outputDirectory, repositoryRoot);
if (
  outputDirectory === repositoryRoot ||
  (!repositoryFromOutput.startsWith('..') && !isAbsolute(repositoryFromOutput))
) {
  throw new Error('Release artifact output must not be the repository root or one of its parents');
}
if (existsSync(outputDirectory) && readdirSync(outputDirectory).length > 0) {
  throw new Error('Release artifact output directory must be empty');
}

runPnpm('clean release workspace build outputs', ['clean']);
runPnpm('build release workspace', ['build']);
mkdirSync(outputDirectory, { recursive: true });

const packageResults = [];
for (const spec of releasePackages) {
  const packed = JSON.parse(
    runPnpm(`pack ${spec.name}`, [
      '--dir',
      resolve(repositoryRoot, spec.directory),
      'pack',
      '--pack-destination',
      outputDirectory,
      '--json',
    ]),
  );
  if (basename(packed.filename) !== spec.archive) {
    throw new Error(`Unexpected archive name for ${spec.name}`);
  }
  packageResults.push(auditTarball(resolve(outputDirectory, spec.archive), spec));
}

const sourceCommit = runChecked('read source commit', 'git', ['rev-parse', 'HEAD']).trim();
const sourceDirty = Boolean(runChecked('read source status', 'git', ['status', '--porcelain']).trim());
const manifest = {
  schemaVersion: 1,
  releaseCandidate: true,
  version: releaseVersion,
  generatedAt: new Date().toISOString(),
  sourceCommit,
  sourceTree: sourceDirty ? 'dirty' : 'clean',
  reproducibility: 'Byte-for-byte reproducibility has not been established.',
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  packages: packageResults,
};

writeFileSync(resolve(outputDirectory, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o600,
  flag: 'wx',
});
writeFileSync(
  resolve(outputDirectory, 'SHA256SUMS'),
  `${[...packageResults]
    .sort((left, right) => left.filename.localeCompare(right.filename))
    .map((item) => `${item.sha256}  ${item.filename}`)
    .join('\n')}\n`,
  { encoding: 'utf8', mode: 0o600, flag: 'wx' },
);

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    outputDirectory,
    sourceCommit,
    sourceTree: manifest.sourceTree,
    packages: packageResults.length,
    files: packageResults.reduce((sum, item) => sum + item.fileCount, 0),
  })}\n`,
);
