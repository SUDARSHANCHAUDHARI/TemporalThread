import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const integrationDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(integrationDirectory, '../..');
const skillSource = join(repositoryRoot, 'skills/codex/temporalthread/SKILL.md');
const hookSource = join(integrationDirectory, 'hooks.json');
const markerStart = '# temporalthread:start';
const markerEnd = '# temporalthread:end';
const mcpBlock = `${markerStart}\n${readFileSync(join(integrationDirectory, 'mcp-config.toml'), 'utf8').trim()}\n${markerEnd}`;

function backup(path, backups) {
  if (!existsSync(path)) return;
  const backupPath = `${path}.backup-${new Date().toISOString().replaceAll(':', '-')}`;
  copyFileSync(path, backupPath);
  backups.push(backupPath);
}

function atomicWrite(path, content) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, path);
}

function hookCommand(group) {
  return group?.hooks?.some((hook) => hook?.command === 'temporalthread hook codex');
}

export function installCodexIntegration(target = process.cwd()) {
  const root = resolve(target);
  const codexDirectory = join(root, '.codex');
  const configPath = join(codexDirectory, 'config.toml');
  const hooksPath = join(codexDirectory, 'hooks.json');
  const skillPath = join(root, '.agents/skills/temporalthread/SKILL.md');
  const changed = [];
  const preserved = [];
  const backups = [];

  const existingConfig = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  if (!existingConfig.includes(markerStart)) {
    backup(configPath, backups);
    const separator = existingConfig.trim() ? '\n\n' : '';
    atomicWrite(configPath, `${existingConfig.trimEnd()}${separator}${mcpBlock}\n`);
    changed.push(configPath);
  } else preserved.push(configPath);

  const desiredHooks = JSON.parse(readFileSync(hookSource, 'utf8'));
  const existingHooks = existsSync(hooksPath) ? JSON.parse(readFileSync(hooksPath, 'utf8')) : { hooks: {} };
  if (!existingHooks || typeof existingHooks !== 'object' || Array.isArray(existingHooks)) {
    throw new Error('Existing .codex/hooks.json must contain a JSON object');
  }
  existingHooks.hooks ??= {};
  let hooksChanged = false;
  for (const [event, groups] of Object.entries(desiredHooks.hooks)) {
    const current = Array.isArray(existingHooks.hooks[event]) ? existingHooks.hooks[event] : [];
    for (const group of groups) {
      if (!current.some(hookCommand)) {
        current.push(group);
        hooksChanged = true;
      }
    }
    existingHooks.hooks[event] = current;
  }
  if (hooksChanged || !existsSync(hooksPath)) {
    backup(hooksPath, backups);
    atomicWrite(hooksPath, `${JSON.stringify(existingHooks, null, 2)}\n`);
    changed.push(hooksPath);
  } else preserved.push(hooksPath);

  const skillContent = readFileSync(skillSource, 'utf8');
  if (!existsSync(skillPath) || readFileSync(skillPath, 'utf8') !== skillContent) {
    backup(skillPath, backups);
    atomicWrite(skillPath, skillContent);
    changed.push(skillPath);
  } else preserved.push(skillPath);

  return { target: root, changed, preserved, backups, requiresTrustReview: true };
}

export function uninstallCodexIntegration(target = process.cwd()) {
  const root = resolve(target);
  const configPath = join(root, '.codex/config.toml');
  const hooksPath = join(root, '.codex/hooks.json');
  const skillPath = join(root, '.agents/skills/temporalthread/SKILL.md');
  const changed = [];
  const preserved = [];
  const backups = [];

  if (existsSync(configPath)) {
    const current = readFileSync(configPath, 'utf8');
    const expression = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}\\n?`, 'g');
    const updated = current.replace(expression, '').trimEnd();
    if (updated !== current.trimEnd()) {
      backup(configPath, backups);
      atomicWrite(configPath, updated ? `${updated}\n` : '');
      changed.push(configPath);
    }
  }

  if (existsSync(hooksPath)) {
    const hooks = JSON.parse(readFileSync(hooksPath, 'utf8'));
    let hooksChanged = false;
    for (const [event, groups] of Object.entries(hooks.hooks ?? {})) {
      if (!Array.isArray(groups)) continue;
      const filtered = groups.filter((group) => !hookCommand(group));
      if (filtered.length !== groups.length) hooksChanged = true;
      if (filtered.length) hooks.hooks[event] = filtered;
      else delete hooks.hooks[event];
    }
    if (hooksChanged) {
      backup(hooksPath, backups);
      atomicWrite(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
      changed.push(hooksPath);
    }
  }

  if (existsSync(skillPath)) {
    if (readFileSync(skillPath, 'utf8') === readFileSync(skillSource, 'utf8')) {
      backup(skillPath, backups);
      unlinkSync(skillPath);
      changed.push(skillPath);
    } else preserved.push(skillPath);
  }
  return { target: root, changed, preserved, backups };
}

export function doctorCodexIntegration(target = process.cwd()) {
  const root = resolve(target);
  const configPath = join(root, '.codex/config.toml');
  const hooksPath = join(root, '.codex/hooks.json');
  const skillPath = join(root, '.agents/skills/temporalthread/SKILL.md');
  const checks = [
    {
      name: 'project MCP configuration',
      ok: existsSync(configPath) && readFileSync(configPath, 'utf8').includes(markerStart),
    },
    {
      name: 'project hook configuration',
      ok: existsSync(hooksPath) && readFileSync(hooksPath, 'utf8').includes('temporalthread hook codex'),
    },
    { name: 'project skill', ok: existsSync(skillPath) },
  ];
  return { ok: checks.every((check) => check.ok), target: root, checks };
}
