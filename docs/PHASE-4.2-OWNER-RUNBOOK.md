# Phase 4.2 owner runbook

Status: manual certification and authority verification only. Do not publish, tag, create a release, change
visibility, or bypass Codex trust.

Run repository commands from a clean TemporalThread checkout. Use the exact temporary paths printed by the
preparation script; placeholders below are not shell environment variables.

## 1. Runtime and commit

**READ-ONLY**

```sh
node --version
pnpm --version
git status --short --branch
git rev-parse HEAD
```

Require Node.js 24, pnpm 11.9.0, a clean tree, and the intended Phase 4.2 commit.

## 2. Repository quality gates

**TEMPORARY LOCAL WRITE** (`node_modules`/build caches only)

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:codex-package
pnpm verify:clean-source
pnpm run audit
git diff --check
```

The following is **PROHIBITED FOR RELEASE** and expected to fail closed until Phase 4.3:

```sh
pnpm verify:codex-package -- --require-secure-dependencies
```

Stop after that failure. Do not generate release artifacts or an SBOM.

## 3. Prepare the disposable project

**TEMPORARY LOCAL WRITE**

```sh
pnpm run certify:codex:prepare
```

The command must report `dependencySecurity: BLOCKED`, `releaseUse: PROHIBITED`, one temporary project, a
manifest, instructions, nine tools, and a cleanup command. It does not launch Codex or approve trust.

## 4. Review generated files

**READ-ONLY**

From the printed temporary project, review:

```text
CERTIFICATION-INSTRUCTIONS.md
.codex/config.toml
.codex/hooks.json
.codex/temporalthread.integration.json
.agents/skills/temporal-awareness/SKILL.md
```

Confirm every path is under the one temporary root, the MCP command uses the temporary executable shim,
privacy is `temporal-references-only`, and the unrelated Codex comment remains present.

## 5. Run the doctor before the host

**READ-ONLY except normal isolated database access**

- macOS/Linux, from the temporary root:

  ```sh
  ./run-temporalthread-certification.sh integrate codex doctor --scope project --json
  ```

- Windows:

  ```bat
  run-temporalthread-certification.cmd integrate codex doctor --scope project --json
  ```

## 6. Launch the real Codex host

**MANUAL UI ACTION**

- macOS/Linux: `./launch-codex-certification.sh`
- Windows: `launch-codex-certification.cmd`

The launcher uses the supported temporary `CODEX_HOME`, temporary TemporalThread data, and temporary package
shim. If Codex requires authentication in that isolated profile, complete it personally. Do not copy auth
files, tokens, or a real Codex home into the temporary root.

Review project/hook trust prompts and approve only the expected temporary files. Never use
`--dangerously-bypass-hook-trust` or disable Codex security.

## 7. Controlled temporal scenario

**MANUAL UI ACTION**

Follow `CERTIFICATION-INSTRUCTIONS.md`. Confirm:

1. TemporalThread MCP is visible.
2. Exactly nine tools and the `temporal-awareness` skill are discoverable.
3. “I’m back…” resolves from the seeded meaningful user interaction, not SessionStart.
4. Elapsed time is approximately four days and three hours.
5. The single commitment is overdue.
6. A normal assistant Stop message can become the next meaningful conversation.
7. Stop without assistant text creates no fake conversation.

Record only redacted results in `docs/LIVE-CODEX-CERTIFICATION-RESULTS.md`.

## 8. Automated certification checks

**TEMPORARY LOCAL WRITE** (isolated test database only)

After completing the manual host scenario and closing Codex:

```sh
pnpm run certify:codex:check -- --manifest "<temporary-manifest-path>" --stage installed --exercise-lifecycle
```

The lifecycle exercise is an adapter/storage proof, not evidence of Codex UI or model behavior.

## 9. Uninstall and preservation

**DESTRUCTIVE TO TEMPORARY INTEGRATION FILES; DATABASE PRESERVED**

- macOS/Linux:

  ```sh
  ./run-temporalthread-certification.sh integrate codex uninstall --scope project --yes --json
  ```

- Windows:

  ```bat
  run-temporalthread-certification.cmd integrate codex uninstall --scope project --yes --json
  ```

Then run:

```sh
pnpm run certify:codex:check -- --manifest "<temporary-manifest-path>" --stage uninstalled
```

## 10. Explicit purge and cleanup

**DESTRUCTIVE TO TEMPORARY TEST DATA**

- macOS/Linux:

  ```sh
  ./run-temporalthread-certification.sh purge --yes --json
  ```

- Windows:

  ```bat
  run-temporalthread-certification.cmd purge --yes --json
  ```

Verify:

```sh
pnpm run certify:codex:check -- --manifest "<temporary-manifest-path>" --stage purged
```

Finally run the exact cleanup command printed by preparation. It requires the matching root and UUID, refuses
an unmarked/symlinked/non-temporary target, and is idempotent after successful removal.

## 11. Confirm isolation

**READ-ONLY/MANUAL REVIEW**

- Confirm the temporary root no longer exists.
- Confirm no global package was installed.
- Confirm the real Codex and TemporalThread directories were not targets.
- Do not inspect or copy private contents merely to create evidence.

## 12. npm authority

**READ-ONLY plus separate MANUAL UI ACTION**

Complete `docs/NPM-AUTHORITY-AND-2FA-CHECKLIST.md` and follow
`docs/NPM-SCOPE-HUMAN-ACTIONS.md`. Do not run a publish command during Phase 4.2.
