# Security policy

## Supported versions

Until the first stable release, only the latest commit on `main` is supported with security fixes.

## Reporting a vulnerability

Please use GitHub’s private vulnerability reporting feature for this repository. If that feature is unavailable, open a minimal issue asking the maintainer to establish a private channel; do not include vulnerability details in that issue. Do not disclose the issue publicly before maintainers have had a reasonable opportunity to investigate and release a fix.

Include the affected version or commit, reproduction steps, impact, and any suggested mitigation. Do not include real conversation data, credentials, tokens, or personal information. You should receive an acknowledgement within seven days; timing for a fix depends on severity and complexity.

## Security model

TemporalThread is local-first. Its default server transport is stdio, it opens no network port, and it sends no telemetry or stored content. SQLite and configuration files are created with restrictive permissions where the operating system supports them. MCP clients and host hooks execute with the user’s local permissions, so users must review project configuration and trust prompts before enabling an integration.

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model, controls, and recovery guidance.
