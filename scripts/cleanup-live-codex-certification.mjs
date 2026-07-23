import { homedir, tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  cleanupCertificationRoot,
  sanitizeCertificationDiagnostic,
} from './live-codex-certification-utils.mjs';
import { repositoryRoot } from './release-artifact-utils.mjs';

function requireNode24() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== 24) throw new Error(`Live Codex certification cleanup requires Node.js 24; found ${major}`);
}

function parseArguments(arguments_) {
  const normalized = arguments_.filter((argument) => argument !== '--');
  let root;
  let certificationId;
  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === '--root') {
      root = normalized[index + 1];
      if (!root) throw new Error('--root requires a path');
      index += 1;
      continue;
    }
    if (argument === '--id') {
      certificationId = normalized[index + 1];
      if (!certificationId) throw new Error('--id requires a certification id');
      index += 1;
      continue;
    }
    throw new Error('Usage: cleanup-live-codex-certification.mjs --root <temporary-root> --id <id>');
  }
  if (!root || !certificationId) {
    throw new Error('Cleanup requires both --root and --id from the preparation output');
  }
  return { root, certificationId };
}

export function cleanupLiveCodexCertification(arguments_ = process.argv.slice(2)) {
  requireNode24();
  const options = parseArguments(arguments_);
  const result = cleanupCertificationRoot({
    root: options.root,
    certificationId: options.certificationId,
    userHome: homedir(),
    repositoryRoot,
    systemTemp: tmpdir(),
  });
  return {
    ok: true,
    temporaryCertificationRootRemoved: result.removed,
    alreadyRemoved: result.alreadyRemoved,
    realUserDirectoriesModified: false,
    releaseArtifactsCreated: false,
  };
}

function main() {
  try {
    process.stdout.write(`${JSON.stringify(cleanupLiveCodexCertification(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${sanitizeCertificationDiagnostic(error instanceof Error ? error.message : error, {
        repositoryRoot,
        userHome: homedir(),
      })}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
