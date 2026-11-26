# Changelog

## 0.1.0 (2026-10-28)

- First release: a forwarding client for the hosted eFon call-rates MCP server. The 4 captured tools are answered locally for tools/list, and every tools/call is forwarded upstream over a streamable-HTTP JSON-RPC session (initialize, notifications/initialized, tools/call, honouring the Mcp-Session-Id header when the upstream issues one).
- Tools: `get_call_rates`, `compare_call_rates`, `how_to_call`, `lookup_calling_code`. Each tool's `title` is served exactly as captured.
- Upstream results pass through verbatim, including the isError flag; upstream failures surface as `dialrates error:` text results.
- One bin serves the CLI (one subcommand per tool, plus `--version`) and the stdio MCP server (`mcp` subcommand). The upstream endpoint can be overridden via `DIALRATES_MCP_URL`. The upstream record declares no headers, so no auth header is ever sent.
