# dialrates

Before you dial abroad, what will the minute actually cost? dialrates is a local forwarding client for the hosted eFon call-rates MCP service: it answers `tools/list` locally from the captured tool definitions and forwards every call to the service, returning the answers exactly as the service sends them back.

The four tools read eFon's published rate catalogue and dialing reference. Nothing here places a call, opens an account, or takes a payment — every tool is a lookup over prices and dialing information the vendor already publishes.

## The tools

- **`get_call_rates`** — Per-minute prices (EUR and USD) for calling one `country`: every rate line for mobile, landline and specific networks or regions, the cheapest price, any announced price change, plus the country page and app links. `country` is required; `language` is optional.
- **`compare_call_rates`** — The cheapest per-minute price for several `countries` (up to 20), sorted from cheapest to most expensive, each with its country page link. `countries` is required.
- **`how_to_call`** — A dialing guide for calling a `destination` country, optionally from an `origin` country: exit code, country code, example numbers written the way to dial them, the time difference and the hours when it is daytime on both ends, plus the cheapest rate. `destination` is required.
- **`lookup_calling_code`** — Which country (or countries, for shared codes such as +1, +7 or +44) a dialing `code` belongs to, with capital, example number, the rate page, the cheapest rate for calling back and a scam warning for one-ring calls. `code` is required.

Country arguments accept a country name in any language, an ISO 3166-1 alpha-2 code, or a dialing code. Every tool also accepts an optional `language` for country names and returned page links.

## Install and run

As an MCP server via npm:

```bash
npx -y @reneturcios/dialrates mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "dialrates": {
      "command": "npx",
      "args": ["-y", "@reneturcios/dialrates", "mcp"]
    }
  }
}
```

As a container:

```bash
docker run -i ghcr.io/cloudcorprecords/dialrates
docker run --rm ghcr.io/cloudcorprecords/dialrates get_call_rates '{"country":"Eritrea"}'
```

## CLI

One binary serves both the command line and the MCP server. Each tool is a subcommand taking a single JSON string with that tool's arguments:

```bash
dialrates get_call_rates '{"country":"Eritrea"}'
dialrates compare_call_rates '{"countries":["India","Pakistan","Bangladesh"]}'
dialrates how_to_call '{"destination":"Eritrea","origin":"Germany"}'
dialrates lookup_calling_code '{"code":"+36"}'
dialrates --version
```

Exit codes: `0` when the forwarded call succeeds, `1` when the upstream result is an error, and `2` for usage problems such as an unknown subcommand or a malformed JSON argument.

## Configuration

- `DIALRATES_MCP_URL` — Overrides the upstream endpoint. The default is the pinned hosted endpoint, `https://efon.com/mcp`. (The override variable is a reconstruction added by this rebuild.)

The upstream registry record declares no headers, so no authentication header is ever sent; the tool surface was captured keyless.

Upstream failures — a JSON-RPC error from the service, a non-2xx response, an unreadable body, or a request that fails outright — are reported to the caller as an error result whose text starts with `dialrates error:`.

## How forwarding works

The first forwarded call opens a session: an `initialize` request (protocol version `2025-03-26`), followed by a `notifications/initialized` notification, then the `tools/call` itself. If the service answers the initialize request with an `Mcp-Session-Id` header, that value is carried on every later request, and the open session is reused for the rest of the process. Replies are accepted either as plain JSON or as server-sent events. Successful results pass through verbatim, including any `isError` flag and any extra fields the service includes.

## Development

```bash
npm install
npm run build   # tsc -> dist/ (dist/cli.js is the bin)
npm test        # tsx --test test/*.test.ts — stubbed upstream, no network
npm run dev     # run the CLI from source
```

The test suite checks the served tool list against the captured surface (the 4 tools, deep-equal, titles included exactly as captured, and each `required` list exactly as captured), exercises the session handshake and its reuse, verifies that no `Authorization` or `X-API-Key` header is ever sent under any environment, and verifies that arguments go upstream untouched and results come back untouched.

## License

MIT — see `LICENSE`. Copyright (c) 2026 Rene Turcios.
