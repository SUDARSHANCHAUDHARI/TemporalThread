import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillPath = resolve('skills/codex/temporal-awareness/SKILL.md');

function parseFrontmatter(content: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(content);
  if (!match?.[1]) throw new Error('Skill is missing YAML frontmatter');
  return Object.fromEntries(
    match[1].split('\n').map((line) => {
      const separator = line.indexOf(':');
      if (separator < 1) throw new Error(`Invalid frontmatter line: ${line}`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
}

describe('Codex temporal-awareness skill', () => {
  it('uses the current official SKILL.md structure and selective metadata', () => {
    const content = readFileSync(skillPath, 'utf8');
    const frontmatter = parseFrontmatter(content);

    expect(frontmatter).toEqual({
      name: 'temporal-awareness',
      description: expect.stringContaining('Use when'),
    });
    expect(frontmatter.description).toContain('Do not use when');
    expect(frontmatter.description?.length).toBeLessThanOrEqual(512);
  });

  it('references exactly the tools registered by the TemporalThread MCP server', () => {
    const content = readFileSync(skillPath, 'utf8');
    const serverSource = readFileSync(resolve('apps/mcp-server/src/server.ts'), 'utf8');
    const registeredTools = [...serverSource.matchAll(/server\.registerTool\(\s*'([^']+)'/g)].map(
      (match) => match[1],
    );
    const mentionedTools = [...content.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((match) => match[1]);

    expect(new Set(mentionedTools)).toEqual(new Set(registeredTools));
    expect(registeredTools).toHaveLength(9);
  });

  it('defines relevance, non-relevance, privacy, commitment, and failure behavior', () => {
    const content = readFileSync(skillPath, 'utf8');

    expect(content).toContain('## When temporal context is relevant');
    expect(content).toContain('## When temporal context is not relevant');
    expect(content).toContain('## Record interactions selectively');
    expect(content).toContain('## Record commitments conservatively');
    expect(content).toContain('## Privacy behavior');
    expect(content).toContain('## If TemporalThread is unavailable');
    expect(content).toContain('original timestamp and original IANA timezone');
    expect(content).toContain('exact elapsed duration');
    expect(content).toContain('calendar-day difference');
    expect(content).toContain('Never silently mark a commitment complete');
    expect(content).toMatch(/Never claim that a reminder\s+was delivered/);
    expect(content).toContain('Do not make a TemporalThread call for every prompt');
    expect(content).toContain('metadata-only');
    expect(content).toContain('temporal-references-only');
    expect(content).toContain('full-local-history');
  });

  it('guards against fabricated time, false commitments, and internal identifier disclosure', () => {
    const content = readFileSync(skillPath, 'utf8');

    expect(content).toContain('Never re-anchor an old relative expression to the current date');
    expect(content).toContain('Never invent an exact due timestamp for vague language');
    expect(content).toContain("Write a test for the sentence 'Let’s continue tomorrow.'");
    expect(content).toContain('We are not continuing tomorrow.');
    expect(content).toContain('Maybe we can continue tomorrow.');
    expect(content).toContain('Never expose session IDs, internal IDs, message hashes, or database paths');
  });
});
