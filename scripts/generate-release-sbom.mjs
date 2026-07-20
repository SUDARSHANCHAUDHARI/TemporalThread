import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { repositoryRoot, runChecked, runPnpm } from './release-artifact-utils.mjs';
import { releasePackages, releaseVersion } from './release-packages.mjs';

function outputArgument() {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
  const defaultPath = resolve(
    repositoryRoot,
    'release-artifacts',
    `temporalthread-v${releaseVersion}.spdx.json`,
  );
  if (arguments_.length === 0) return defaultPath;
  if (arguments_.length !== 2 || arguments_[0] !== '--output' || !arguments_[1]) {
    throw new Error('Usage: pnpm release:sbom -- --output <file>');
  }
  return resolve(repositoryRoot, arguments_[1]);
}

function packageKey(name, version) {
  return `${name}@${version}`;
}

function spdxId(name, version) {
  const digest = createHash('sha256').update(packageKey(name, version)).digest('hex').slice(0, 20);
  return `SPDXRef-Package-${digest}`;
}

function purl(name, version) {
  const packageName = name.startsWith('@') ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${packageName}@${version}`;
}

const outputPath = outputArgument();
if (existsSync(outputPath)) throw new Error('SBOM output file already exists');
mkdirSync(dirname(outputPath), { recursive: true });

const workspaceGraph = JSON.parse(
  runPnpm('read production dependency graph', ['list', '-r', '--prod', '--depth', 'Infinity', '--json'], {
    maxBuffer: 50 * 1_024 * 1_024,
  }),
);
const licenseGroups = JSON.parse(
  runPnpm('read production dependency licenses', ['licenses', 'list', '--prod', '--json'], {
    maxBuffer: 50 * 1_024 * 1_024,
  }),
);
const sourceCommit = runChecked('read source commit', 'git', ['rev-parse', 'HEAD']).trim();
const sourceDirty = Boolean(runChecked('read source status', 'git', ['status', '--porcelain']).trim());

const licenses = new Map();
for (const [license, packages] of Object.entries(licenseGroups)) {
  for (const package_ of packages) {
    for (const version of package_.versions ?? []) licenses.set(packageKey(package_.name, version), license);
  }
}

const releaseByName = new Map(releasePackages.map((item) => [item.name, item]));
const packageRecords = new Map();
const relationshipRecords = new Map();

function addPackage(name, version) {
  const key = packageKey(name, version);
  if (packageRecords.has(key)) return key;
  const local = releaseByName.has(name);
  const license = local ? 'MIT' : (licenses.get(key) ?? 'NOASSERTION');
  packageRecords.set(key, {
    name,
    SPDXID: spdxId(name, version),
    versionInfo: version,
    packageFileName: '',
    primaryPackagePurpose: 'LIBRARY',
    downloadLocation:
      local && !sourceDirty
        ? `https://github.com/SUDARSHANCHAUDHARI/TemporalThread/tree/${sourceCommit}/${releaseByName.get(name).directory}`
        : 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: 'NOASSERTION',
    licenseDeclared: license,
    copyrightText: 'NOASSERTION',
    externalRefs: [
      {
        referenceCategory: 'PACKAGE-MANAGER',
        referenceType: 'purl',
        referenceLocator: purl(name, version),
      },
    ],
  });
  return key;
}

function addRelationship(fromKey, toKey, type) {
  const relationship = {
    spdxElementId: spdxId(...fromKey.match(/^(.+)@([^@]+)$/u).slice(1)),
    relatedSpdxElement: spdxId(...toKey.match(/^(.+)@([^@]+)$/u).slice(1)),
    relationshipType: type,
  };
  relationshipRecords.set(
    `${relationship.spdxElementId}|${relationship.relationshipType}|${relationship.relatedSpdxElement}`,
    relationship,
  );
}

function dependencyVersion(name, node) {
  return releaseByName.has(name) ? releaseVersion : String(node.version);
}

function walkDependencies(parentKey, dependencies, ancestors = new Set()) {
  for (const [name, node] of Object.entries(dependencies ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const version = dependencyVersion(name, node);
    const childKey = addPackage(name, version);
    addRelationship(parentKey, childKey, 'DEPENDS_ON');
    if (ancestors.has(childKey)) continue;
    walkDependencies(childKey, node.dependencies, new Set([...ancestors, childKey]));
  }
}

for (const spec of releasePackages) {
  const project = workspaceGraph.find((item) => item.name === spec.name);
  if (!project) throw new Error(`Production dependency graph is missing ${spec.name}`);
  const rootKey = addPackage(spec.name, releaseVersion);
  walkDependencies(rootKey, project.dependencies, new Set([rootKey]));
}

const packages = [...packageRecords.values()].sort((left, right) => {
  const name = left.name.localeCompare(right.name);
  return name || left.versionInfo.localeCompare(right.versionInfo);
});
const relationships = [...relationshipRecords.values()].sort((left, right) => {
  const from = left.spdxElementId.localeCompare(right.spdxElementId);
  const type = left.relationshipType.localeCompare(right.relationshipType);
  return from || type || left.relatedSpdxElement.localeCompare(right.relatedSpdxElement);
});
for (const spec of releasePackages) {
  relationships.unshift({
    spdxElementId: 'SPDXRef-DOCUMENT',
    relatedSpdxElement: spdxId(spec.name, releaseVersion),
    relationshipType: 'DESCRIBES',
  });
}

const graphDigest = createHash('sha256')
  .update(packages.map((item) => `${item.name}@${item.versionInfo}`).join('\n'))
  .digest('hex')
  .slice(0, 24);
const sbom = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: `TemporalThread-v${releaseVersion}-release-candidate`,
  documentNamespace: `https://github.com/SUDARSHANCHAUDHARI/TemporalThread/sbom/v${releaseVersion}/${sourceCommit}/${graphDigest}${sourceDirty ? '-dirty' : ''}`,
  creationInfo: {
    created: new Date().toISOString(),
    creators: ['Tool: TemporalThread generate-release-sbom.mjs'],
  },
  documentDescribes: releasePackages.map((item) => spdxId(item.name, releaseVersion)),
  packages,
  relationships,
  annotations: [
    {
      annotationDate: new Date().toISOString(),
      annotationType: 'OTHER',
      annotator: 'Tool: TemporalThread generate-release-sbom.mjs',
      comment:
        'Generated from pnpm production dependency and license metadata. Package files are not analyzed; licenses are metadata observations, not legal conclusions.',
    },
  ],
};

writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, {
  encoding: 'utf8',
  mode: 0o600,
  flag: 'wx',
});
process.stdout.write(
  `${JSON.stringify({
    ok: true,
    format: 'SPDX-2.3 JSON',
    outputPath,
    packages: packages.length,
    relationships: relationships.length,
    sourceCommit,
    sourceTree: sourceDirty ? 'dirty' : 'clean',
  })}\n`,
);
