import { describe, expect, it } from 'vitest';
import {
  CodexConfigError,
  createCodexMcpServerConfig,
  inspectCodexMcpConfiguration,
  mergeCodexMcpConfiguration,
  removeCodexMcpConfiguration,
  renderCodexMcpConfiguration,
} from '../../integrations/codex/src/index.js';

describe('Codex MCP configuration', () => {
  it('renders the official optional stdio configuration for an installed CLI', () => {
    const server = createCodexMcpServerConfig({ mode: 'installed' });
    expect(server).toEqual({
      command: 'temporalthread',
      args: ['start'],
      enabled: true,
      required: false,
      default_tools_approval_mode: 'writes',
      startup_timeout_sec: 10,
      tool_timeout_sec: 60,
    });

    const rendered = renderCodexMcpConfiguration({ mode: 'installed' });
    const inspection = inspectCodexMcpConfiguration(rendered);
    expect(inspection).toMatchObject({ valid: true, present: true, matchesRecommended: true });
  });

  it('quotes a caller-supplied Windows development entry without shell interpolation', () => {
    const rendered = renderCodexMcpConfiguration({
      mode: 'development',
      platform: 'win32',
      nodeExecutable: 'C:\\Program Files\\nodejs\\node.exe',
      cliEntryPath: 'D:\\Code Ω\\TemporalThread\\apps\\cli\\dist\\bin.js',
    });
    const inspection = inspectCodexMcpConfiguration(rendered);

    expect(inspection.valid).toBe(true);
    expect(inspection.entry).toMatchObject({
      command: 'C:\\Program Files\\nodejs\\node.exe',
      args: ['D:\\Code Ω\\TemporalThread\\apps\\cli\\dist\\bin.js', 'start'],
      required: false,
    });
    expect(rendered).not.toContain('cmd.exe');
    expect(rendered).not.toContain('powershell');
  });

  it('preserves unrelated TOML and comments byte-for-byte while adding one owned block', () => {
    const existing = `# user comment\nmodel = "gpt-5"\n\n[mcp_servers.docs]\ncommand = "docs-mcp"\nargs = ["--stdio"]\n`;
    const merged = mergeCodexMcpConfiguration(existing, { mode: 'installed' });

    expect(merged.change).toBe('created');
    expect(merged.ownership).toBe('temporalthread');
    expect(merged.content.startsWith(existing)).toBe(true);
    expect(merged.content).toContain('# temporalthread:codex-mcp:start');
    expect(merged.content).toContain('[mcp_servers.temporal-thread]');
    expect(inspectCodexMcpConfiguration(merged.content)).toMatchObject({
      valid: true,
      managed: true,
      present: true,
      matchesRecommended: true,
    });

    const repeated = mergeCodexMcpConfiguration(merged.content, { mode: 'installed' });
    expect(repeated).toMatchObject({ change: 'unchanged', content: merged.content });
  });

  it('updates only its managed block when switching to development mode', () => {
    const initial = mergeCodexMcpConfiguration('approval_policy = "on-request"\n', {
      mode: 'installed',
    });
    const updated = mergeCodexMcpConfiguration(initial.content, {
      mode: 'development',
      cliEntryPath: '/opt/Temporal Thread/apps/cli/dist/bin.js',
      nodeExecutable: '/opt/node/bin/node',
      platform: 'linux',
    });

    expect(updated.change).toBe('updated');
    expect(updated.content).toContain('approval_policy = "on-request"');
    expect(updated.content).toContain('/opt/Temporal Thread/apps/cli/dist/bin.js');
    expect(updated.content).not.toContain('command = "temporalthread"');
  });

  it('preserves an existing unmarked TemporalThread entry as externally owned', () => {
    const existing = `[mcp_servers.temporal-thread]\ncommand = "custom-wrapper"\nargs = []\n`;
    const merged = mergeCodexMcpConfiguration(existing, { mode: 'installed' });

    expect(merged).toEqual({
      content: existing,
      change: 'unchanged',
      ownership: 'external',
      matchesRecommended: false,
    });
  });

  it('migrates the Phase 1 owned marker block without duplicating the MCP server', () => {
    const legacy = `model = "gpt-5"\n\n# temporalthread:start\n[mcp_servers.temporal-thread]\ncommand = "temporalthread"\nargs = ["start"]\n# temporalthread:end\n`;
    const merged = mergeCodexMcpConfiguration(legacy, { mode: 'installed' });

    expect(merged.change).toBe('updated');
    expect(merged.ownership).toBe('temporalthread');
    expect(merged.content).toContain('model = "gpt-5"');
    expect(merged.content).toContain('# temporalthread:codex-mcp:start');
    expect(merged.content).not.toContain('# temporalthread:start');
    expect(merged.content.match(/\[mcp_servers\.temporal-thread\]/g)).toHaveLength(1);
  });

  it('refuses malformed TOML and unmatched ownership markers without leaking content', () => {
    const privateMalformed = 'private_setting = "do not leak"\n[mcp_servers';
    expect(() => mergeCodexMcpConfiguration(privateMalformed, { mode: 'installed' })).toThrow(
      CodexConfigError,
    );
    try {
      mergeCodexMcpConfiguration(privateMalformed, { mode: 'installed' });
    } catch (error) {
      expect(error).toMatchObject({ code: 'malformed-config', message: 'Codex config.toml is malformed' });
      expect(JSON.stringify(error)).not.toContain('do not leak');
    }

    expect(() =>
      mergeCodexMcpConfiguration('# temporalthread:codex-mcp:start\n', { mode: 'installed' }),
    ).toThrow('TemporalThread MCP ownership markers are incomplete');
  });

  it('removes only the owned block and leaves external entries untouched', () => {
    const base = '# keep this\n[mcp_servers.docs]\ncommand = "docs"\n';
    const installed = mergeCodexMcpConfiguration(base, { mode: 'installed' });
    const removed = removeCodexMcpConfiguration(installed.content);
    expect(removed).toEqual({ content: base, change: 'removed', ownership: 'temporalthread' });

    const external = `[mcp_servers.temporal-thread]\ncommand = "custom"\n`;
    expect(removeCodexMcpConfiguration(external)).toEqual({
      content: external,
      change: 'unchanged',
      ownership: 'external',
    });
  });
});
