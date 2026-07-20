import { posix, win32 } from 'node:path';
import { parse, stringify, type TomlTable } from 'smol-toml';
import { z } from 'zod';

export const CODEX_MCP_MARKER_START = '# temporalthread:codex-mcp:start';
export const CODEX_MCP_MARKER_END = '# temporalthread:codex-mcp:end';
const LEGACY_MCP_MARKER_START = '# temporalthread:start';
const LEGACY_MCP_MARKER_END = '# temporalthread:end';

const ApprovalModeSchema = z.enum(['auto', 'prompt', 'writes', 'approve']);
const CodexMcpServerConfigSchema = z
  .object({
    command: z.string().trim().min(1).max(4096),
    args: z.array(z.string().max(4096)).max(64),
    enabled: z.boolean(),
    required: z.boolean(),
    default_tools_approval_mode: ApprovalModeSchema,
    startup_timeout_sec: z.number().int().min(1).max(600),
    tool_timeout_sec: z.number().int().min(1).max(3_600),
  })
  .passthrough();

export type CodexMcpServerConfig = z.infer<typeof CodexMcpServerConfigSchema>;
export type CodexMcpLaunchOptions =
  | { mode: 'installed' }
  | {
      mode: 'development';
      cliEntryPath: string;
      nodeExecutable?: string;
      platform?: NodeJS.Platform;
    };

export type CodexConfigErrorCode =
  | 'malformed-config'
  | 'invalid-template'
  | 'incomplete-markers'
  | 'duplicate-markers';

export class CodexConfigError extends Error {
  readonly code: CodexConfigErrorCode;

  constructor(code: CodexConfigErrorCode, message: string) {
    super(message);
    this.name = 'CodexConfigError';
    this.code = code;
  }
}

export interface CodexMcpInspection {
  valid: boolean;
  managed: boolean;
  present: boolean;
  matchesRecommended: boolean;
  entry: Record<string, unknown> | null;
  errorCode?: CodexConfigErrorCode;
}

export interface CodexMcpMergeResult {
  content: string;
  change: 'created' | 'updated' | 'unchanged';
  ownership: 'temporalthread' | 'external' | 'none';
  matchesRecommended: boolean;
}

export interface CodexMcpRemovalResult {
  content: string;
  change: 'removed' | 'unchanged';
  ownership: 'temporalthread' | 'external' | 'none';
}

function asTable(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseConfig(content: string): TomlTable {
  try {
    return parse(content);
  } catch {
    throw new CodexConfigError('malformed-config', 'Codex config.toml is malformed');
  }
}

function occurrences(content: string, marker: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const found = content.indexOf(marker, offset);
    if (found < 0) return count;
    count += 1;
    offset = found + marker.length;
  }
}

function rangeForMarkers(
  content: string,
  startMarker: string,
  endMarker: string,
): { start: number; end: number } | null {
  const starts = occurrences(content, startMarker);
  const ends = occurrences(content, endMarker);
  if (starts !== ends) {
    throw new CodexConfigError('incomplete-markers', 'TemporalThread MCP ownership markers are incomplete');
  }
  if (starts > 1) {
    throw new CodexConfigError('duplicate-markers', 'TemporalThread MCP ownership markers are duplicated');
  }
  if (starts === 0) return null;
  const start = content.indexOf(startMarker);
  const markerEnd = content.indexOf(endMarker);
  if (markerEnd < start) {
    throw new CodexConfigError('incomplete-markers', 'TemporalThread MCP ownership markers are incomplete');
  }
  let end = markerEnd + endMarker.length;
  if (content[end] === '\r' && content[end + 1] === '\n') end += 2;
  else if (content[end] === '\n') end += 1;
  return { start, end };
}

function markerRange(content: string): { start: number; end: number } | null {
  const current = rangeForMarkers(content, CODEX_MCP_MARKER_START, CODEX_MCP_MARKER_END);
  const legacy = rangeForMarkers(content, LEGACY_MCP_MARKER_START, LEGACY_MCP_MARKER_END);
  if (current && legacy) {
    throw new CodexConfigError('duplicate-markers', 'TemporalThread MCP ownership markers are duplicated');
  }
  return current ?? legacy;
}

function entryFromDocument(document: TomlTable): Record<string, unknown> | null {
  const servers = asTable(document.mcp_servers);
  return servers ? asTable(servers['temporal-thread']) : null;
}

function entryMatches(entry: Record<string, unknown> | null, recommended: CodexMcpServerConfig): boolean {
  if (!entry) return false;
  const parsed = CodexMcpServerConfigSchema.safeParse(entry);
  if (!parsed.success) return false;
  return (
    parsed.data.command === recommended.command &&
    JSON.stringify(parsed.data.args) === JSON.stringify(recommended.args) &&
    parsed.data.enabled === recommended.enabled &&
    parsed.data.required === recommended.required &&
    parsed.data.default_tools_approval_mode === recommended.default_tools_approval_mode &&
    parsed.data.startup_timeout_sec === recommended.startup_timeout_sec &&
    parsed.data.tool_timeout_sec === recommended.tool_timeout_sec
  );
}

function validateDevelopmentPath(value: string, platform: NodeJS.Platform): string {
  if (!value.trim() || value.includes('\0')) {
    throw new CodexConfigError('invalid-template', 'Development CLI entry path is invalid');
  }
  const path = platform === 'win32' ? win32 : posix;
  if (!path.isAbsolute(value)) {
    throw new CodexConfigError('invalid-template', 'Development CLI entry path must be absolute');
  }
  return path.normalize(value);
}

export function createCodexMcpServerConfig(options: CodexMcpLaunchOptions): CodexMcpServerConfig {
  const launch =
    options.mode === 'installed'
      ? { command: 'temporalthread', args: ['start'] }
      : {
          command: options.nodeExecutable?.trim() || 'node',
          args: [
            validateDevelopmentPath(options.cliEntryPath, options.platform ?? process.platform),
            'start',
          ],
        };
  return CodexMcpServerConfigSchema.parse({
    ...launch,
    enabled: true,
    required: false,
    default_tools_approval_mode: 'writes',
    startup_timeout_sec: 10,
    tool_timeout_sec: 60,
  });
}

export function renderCodexMcpConfiguration(options: CodexMcpLaunchOptions): string {
  const content = stringify({
    mcp_servers: { 'temporal-thread': createCodexMcpServerConfig(options) },
  }).trimEnd();
  const parsed = parseConfig(`${content}\n`);
  if (!entryFromDocument(parsed)) {
    throw new CodexConfigError('invalid-template', 'Generated Codex MCP configuration is invalid');
  }
  return `${content}\n`;
}

function managedBlock(options: CodexMcpLaunchOptions): string {
  return `${CODEX_MCP_MARKER_START}\n${renderCodexMcpConfiguration(options).trimEnd()}\n${CODEX_MCP_MARKER_END}`;
}

export function inspectCodexMcpConfiguration(
  content: string,
  recommendedOptions: CodexMcpLaunchOptions = { mode: 'installed' },
): CodexMcpInspection {
  try {
    const range = markerRange(content);
    const document = parseConfig(content);
    const entry = entryFromDocument(document);
    return {
      valid: true,
      managed: range !== null,
      present: entry !== null,
      matchesRecommended: entryMatches(entry, createCodexMcpServerConfig(recommendedOptions)),
      entry,
    };
  } catch (error) {
    return {
      valid: false,
      managed: false,
      present: false,
      matchesRecommended: false,
      entry: null,
      errorCode: error instanceof CodexConfigError ? error.code : 'malformed-config',
    };
  }
}

export function mergeCodexMcpConfiguration(
  content: string,
  options: CodexMcpLaunchOptions,
): CodexMcpMergeResult {
  const range = markerRange(content);
  const document = parseConfig(content);
  const recommended = createCodexMcpServerConfig(options);
  const existingEntry = entryFromDocument(document);

  if (!range && existingEntry) {
    return {
      content,
      change: 'unchanged',
      ownership: 'external',
      matchesRecommended: entryMatches(existingEntry, recommended),
    };
  }

  const desired = managedBlock(options);
  if (range) {
    const existingBlock = content.slice(range.start, range.end).trimEnd();
    if (existingBlock === desired) {
      return {
        content,
        change: 'unchanged',
        ownership: 'temporalthread',
        matchesRecommended: true,
      };
    }
    const updated = `${content.slice(0, range.start)}${desired}\n${content.slice(range.end)}`;
    parseConfig(updated);
    return {
      content: updated,
      change: 'updated',
      ownership: 'temporalthread',
      matchesRecommended: true,
    };
  }

  const separator = content.length === 0 ? '' : content.endsWith('\n') ? '\n' : '\n\n';
  const updated = `${content}${separator}${desired}\n`;
  parseConfig(updated);
  return {
    content: updated,
    change: 'created',
    ownership: 'temporalthread',
    matchesRecommended: true,
  };
}

export function removeCodexMcpConfiguration(content: string): CodexMcpRemovalResult {
  const range = markerRange(content);
  const document = parseConfig(content);
  const existingEntry = entryFromDocument(document);
  if (!range) {
    return {
      content,
      change: 'unchanged',
      ownership: existingEntry ? 'external' : 'none',
    };
  }

  let start = range.start;
  if (start > 0 && content.slice(0, start).endsWith('\n\n')) start -= 1;
  const updated = `${content.slice(0, start)}${content.slice(range.end)}`;
  parseConfig(updated);
  return { content: updated, change: 'removed', ownership: 'temporalthread' };
}
