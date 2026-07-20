# Windows packed-package failure analysis

Analyzed: 2026-07-20 (Asia/Bangkok)

## Failure evidence

- Workflow: `CI`
- Run: `29748170508`
- Commit: `3cbfbbe9ce7f9042ca6736e6052eb6b24036ebe0`
- Job: `88371391428` (`Node 24 / windows-latest`)
- Failed step: `Validate packed Codex integration`
- Command: `pnpm verify:codex-package`
- Runner: Windows Server 2025, Node.js 24.18.0, pnpm 11.9.0

The job passed checkout, dependency installation, formatting/lint, type checking, all 110 tests, and the
workspace build. It failed while the packed CLI executed this logical operation:

```text
node <packed-cli> integrate codex install --scope project --yes --json
```

The process exited with status `1` and no signal. Sanitized stdout was:

```json
{
  "ok": false,
  "error": {
    "code": "mcp-unavailable",
    "message": "TemporalThread MCP startup validation failed; no Codex files were changed"
  }
}
```

Stderr was empty. The installer correctly rolled back before changing Codex files.

## Root cause

The isolated pnpm installation exposed the package binary as a Windows `temporalthread.cmd` command shim.
The generated installed MCP configuration used `command = "temporalthread"` with `args = ["start"]`. The
Codex doctor probe launches that command directly through Node's stdio process boundary, without a shell.
Windows cannot execute a batch-command shim through that direct executable path, so MCP initialization never
started. Linux and macOS package-manager shims are directly executable scripts, so the same configuration
passed there.

The earlier `.gitattributes` correction fixed a separate CRLF formatting failure. It could not fix this
process-launch boundary.

## Chosen fix

Commit `230be46` made installed MCP launch configuration platform-aware:

- Windows: `cmd.exe /d /s /c temporalthread start`
- macOS/Linux: `temporalthread start`
- development mode: direct `process.execPath`/configured Node executable plus the absolute JavaScript entry
  path, unchanged

The Windows wrapper contains only fixed TemporalThread tokens; no prompt, config value, or user-controlled
text is interpolated. Packed validation still performs the real CLI launch, MCP initialization, tool
discovery, installer doctor, uninstall, database-preservation, and unrelated-config-preservation checks.
Nothing is skipped or marked `continue-on-error`.

The package verifier now wraps child failures with a bounded and sanitized diagnostic containing the logical
operation, redacted working directory, exit status, signal, stdout, and stderr. It does not dump environment
variables.

## Alternatives considered

- Skipping the Windows packed check or allowing failure was rejected because it would hide a release defect.
- Enabling a shell for every platform was rejected because it expands quoting and injection risk.
- Hard-coding a packed absolute CLI path was rejected because installed Codex configuration must remain valid
  outside the temporary verifier project.
- Replacing the real MCP probe with a mock was rejected because it would not prove stdio initialization or
  tool discovery.
- Extending the workflow timeout was rejected because the process never launched; this was not a slow start.

## Regression coverage

- The installed Windows configuration test asserts the exact `cmd.exe` command and fixed argument vector.
- Unix installed mode still asserts direct `temporalthread start` launch.
- Windows development paths cover spaces, Unicode, backslashes, and direct Node entry-point launch.
- `pnpm verify:codex-package` uses an isolated Unicode/space-containing project, eight real tarballs, a real
  MCP doctor probe, install/uninstall, and cleanup.
- GitHub Actions runs `29755452393` and `29756093904` passed Ubuntu, macOS, and Windows, including packed Codex
  integration validation and dependency audit.

## Remaining limitations

The automated test validates the Windows runner and packed package contract, not every interactive shell,
antivirus product, enterprise policy, or Codex release. A current Codex desktop/CLI installation still needs
manual trust and release-candidate certification before public release. Installed mode also requires the
`temporalthread` package command to be visible on the host's `PATH`.
