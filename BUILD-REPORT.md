# BUILD REPORT — dialrates

Clean-room rebuild of `com.efon/call-rates` v1.3.2
(remote-only MCP server at `https://efon.com/mcp`),
built 2026-10-28 as a forwarding client. Package:
`@reneturcios/dialrates` 0.1.0, registry name
`io.github.CloudCorpRecords/dialrates`.

## Surface built

Full surface: **4 of 4 captured tools built**, none omitted.

| Tool | Required fields as served |
|------|---------------------------|
| `get_call_rates` | `country` |
| `compare_call_rates` | `countries` |
| `how_to_call` | `destination` |
| `lookup_calling_code` | `code` |

Each served tool carries exactly the keys `name`, `title`,
`description`, `inputSchema`, exactly as captured: the capture's
tools carry `title` keys and they are served verbatim. The tool
literals were generated programmatically from
`harness/fixtures/efon-tools.json` by the script at
`/tmp/b51-dialrates-scratch/gen.py` (parse + re-serialise; the
generator's round-trip assertions confirmed the emitted literal
parses back to the fixture's tool objects) — never retyped — and
the registration-integrity test suite plus the parity harness
confirmed the served literals deep-equal the fixture's tool
objects. Tools are registered via the MCP SDK low-level Server
API (`ListToolsRequestSchema` / `CallToolRequestSchema`
handlers), not McpServer+zod.

## Fixture conflicts

**None.** The spec and the fixture agree on the tool names,
titles, descriptions, required fields and property shapes for
all 4 tools.

## Labelled reconstructions (from the spec's Wire section)

- Upstream endpoint pinned: `https://efon.com/mcp`.
- Env override `DIALRATES_MCP_URL` — labelled reconstruction.
- The registry record declares NO headers on the remote: no auth
  header is ever sent. Tests assert that no `Authorization`
  header is sent under any environment — including with key-like
  env vars (`DIALRATES_API_KEY`, `API_KEY`, `AUTHORIZATION`)
  set — and that no `X-API-Key` header is ever sent; upstream
  requests carry only `Content-Type`, `Accept` and, when issued,
  `Mcp-Session-Id`.
- Error rendering `dialrates error:` text for upstream
  failures — labelled reconstruction.
- Upstream results pass through verbatim, including
  `structuredContent`, `isError` and extra fields. tools/call is
  forwarded as streamable-HTTP JSON-RPC: initialize
  (protocolVersion `2025-03-26`) → notifications/initialized →
  tools/call, honouring `Mcp-Session-Id` when issued; plain-JSON
  and SSE replies are both parsed. The forwarding core takes an
  injectable fetch; tests stub the upstream — no live network
  calls in tests.

## Deviations

**None.**

## Lockfile

- Route: Route 3 (offline) succeeded on the first attempt:
  `npm install --package-lock-only --ignore-scripts --offline`,
  generated clean from birth in the build dir with no
  `node_modules` and no pre-existing lockfile.
- Parses as JSON; `name` == `@reneturcios/dialrates`.
- Package entries: **128**.
- sha256: `ca9eba1a58d63e18ee5da67aadac1756cafb9cb2e565fd062f1b561baa51a499`
  (re-verified unchanged after the subsequent full `npm install`).

## server.json

- Description exactly: "International call and VoIP per-minute rates for 200+ countries, comparisons and dialing help." —
  **94 characters** (verified programmatically from the file).
- npm package entry carries `"version": "0.1.0"`; the OCI entry
  (`ghcr.io/cloudcorprecords/dialrates:0.1.0`) carries **no**
  `version` field. Both entries carry packageArguments
  `[{type: positional, value: mcp}]` and transport stdio.
  Dockerfile (node:20-alpine, both stages) carries the label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/dialrates"`.
  Container workflow `IMAGE` is `ghcr.io/cloudcorprecords/dialrates`
  and its smoke test asserts the server name `dialrates`.

## Verification (all run 2026-10-28)

1. `tsc --noEmit` (direct binary) → exit 0.
2. `tsc` build → exit 0; real `dist/` produced (cli, forward,
   index, mcp, types — .js, .d.ts, .js.map each).
3. `node dist/cli.js --version` → `0.1.0`.
4. Tests (`tsx --test test/forward.test.ts`, fake-fetch only) →
   **55 tests, 55 pass, 0 fail** (registration-integrity suite
   deep-equals the served tools/list against the fixture's 4
   tools, including title/description verbatim checks,
   required-key exactness, language enum/default checks and the
   countries array bounds, plus session handling/reuse, env
   override, the no-Authorization / no-X-API-Key assertions
   under any environment, verbatim argument forwarding for all
   4 tools and result pass-through including structuredContent
   and upstream isError, SSE parsing, error rendering for both
   the JSON-RPC-error and transport-failure paths, MCP-layer
   validation, and CLI behaviour including a working subcommand
   for each of the 4 tools against a local stub server).
5. Parity: `python3 /home/hatch/workspace/mcp-rebuild-100/harness/parity.py --original /home/hatch/workspace/mcp-rebuild-100/harness/fixtures/efon-tools.json --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/dialrates/dist/cli.js mcp" --out /home/hatch/workspace/mcp-rebuild-100/builds/dialrates/parity-out` → **verdict PASS, parity 100.0**
   (4/4 identical, 0 missing, 0 extra, no schema diffs). Output in
   `parity-out/`.
