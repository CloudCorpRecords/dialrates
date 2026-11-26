/**
 * dialrates core: a forwarding client for the hosted
 * eFon call-rates MCP server.
 *
 * Nothing about the rates is computed here.
 * tools/list is answered from the literal definitions
 * below, which reproduce a live capture of the upstream
 * server word for word (name, title, description and
 * inputSchema exactly as captured). A tools/call travels
 * upstream over a streamable-HTTP JSON-RPC session: an
 * initialize POST, a notifications/initialized POST,
 * then the tools/call POST, carrying the Mcp-Session-Id
 * response header on later requests when the upstream
 * issues one. The session opens lazily on the first
 * forwarded call and is reused for the client's lifetime.
 *
 * The endpoint is pinned to https://efon.com/mcp
 * and may be replaced with the DIALRATES_MCP_URL
 * environment variable (that override is a labelled
 * reconstruction). The registry record declares NO
 * headers on the upstream remote, so no auth header is
 * ever sent, under any environment.
 *
 * A successful upstream result is returned exactly as
 * received, isError flag and extra fields included.
 * Failures -- an upstream JSON-RPC error, a non-2xx
 * status, a body that cannot be parsed, or a fetch
 * that throws or times out -- become an isError result
 * whose text begins with `dialrates error:` (that
 * rendering is a labelled reconstruction). Replies may
 * be plain JSON or SSE (`data:` lines); the JSON-RPC
 * message whose id matches the request wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://efon.com/mcp";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/efon-tools.json; generated               */
/* programmatically by parsing and re-serialising the fixture JSON,     */
/* never retyped). The 4 captured tools are built.                      */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "get_call_rates",
    "title": "eFon call rates to a country",
    "description": "eFon per-minute prices (EUR and USD) for calling a country, live: every rate line (mobile / landline / specific networks or regions), the cheapest price, any announced price change, the country page URL and app download links. Rates are the same wherever the caller is. Use this for \"how much does it cost to call X\", \"cheapest way to call X\", \"international / VoIP call rates to X\" or \"is calling X from abroad expensive\".",
    "inputSchema": {
      "type": "object",
      "properties": {
        "country": {
          "type": "string",
          "description": "Country name in any language, ISO 3166-1 alpha-2 code or dialing code — e.g. 'Eritrea', 'ER', 'Эритрея', '+291'."
        },
        "language": {
          "type": "string",
          "enum": [
            "en",
            "de",
            "fr",
            "nl",
            "da",
            "sv",
            "nb",
            "es",
            "pt",
            "it",
            "ar",
            "ti",
            "ru"
          ],
          "default": "en",
          "description": "Language for country names and the returned page links."
        }
      },
      "required": [
        "country"
      ]
    }
  },
  {
    "name": "compare_call_rates",
    "title": "Compare eFon call rates across countries",
    "description": "eFon rate comparison: cheapest per-minute price (EUR and USD) for several countries, sorted from cheapest to most expensive, each with its country page URL. Use this when the user calls more than one country (\"rates to India, Pakistan and Bangladesh\", \"which is cheaper to call, Mexico or Colombia?\").",
    "inputSchema": {
      "type": "object",
      "properties": {
        "countries": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "Country name in any language, ISO 3166-1 alpha-2 code or dialing code — e.g. 'Eritrea', 'ER', 'Эритрея', '+291'."
          },
          "minItems": 1,
          "maxItems": 20,
          "description": "Up to 20 countries, each in any of the formats above."
        },
        "language": {
          "type": "string",
          "enum": [
            "en",
            "de",
            "fr",
            "nl",
            "da",
            "sv",
            "nb",
            "es",
            "pt",
            "it",
            "ar",
            "ti",
            "ru"
          ],
          "default": "en",
          "description": "Language for country names and the returned page links."
        }
      },
      "required": [
        "countries"
      ]
    }
  },
  {
    "name": "how_to_call",
    "title": "How to dial a country from another",
    "description": "eFon dialing guide for calling a destination country from an origin country: exit code, country code, example mobile and landline numbers written the way to dial them, the time difference and the hours when it is daytime on both ends, plus the eFon guide URL and the cheapest eFon rate. Omit origin for the international (+) format only.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "destination": {
          "type": "string",
          "description": "Country name in any language, ISO 3166-1 alpha-2 code or dialing code — e.g. 'Eritrea', 'ER', 'Эритрея', '+291'."
        },
        "origin": {
          "type": "string",
          "description": "Country the caller is in (optional). Country name in any language, ISO 3166-1 alpha-2 code or dialing code — e.g. 'Eritrea', 'ER', 'Эритрея', '+291'."
        },
        "language": {
          "type": "string",
          "enum": [
            "en",
            "de",
            "fr",
            "nl",
            "da",
            "sv",
            "nb",
            "es",
            "pt",
            "it",
            "ar",
            "ti",
            "ru"
          ],
          "default": "en",
          "description": "Language for country names and the returned page links."
        }
      },
      "required": [
        "destination"
      ]
    }
  },
  {
    "name": "lookup_calling_code",
    "title": "Which country is this calling code?",
    "description": "eFon calling-code lookup: which country (or countries, for shared codes like +1, +7 or +44) a code such as +36, 0036 or +1 876 belongs to, with capital, example number and the eFon rate page. Use this for \"which country is +36\", \"who is calling me from +233\", \"what does 00252 mean\" or a missed call from an unknown foreign number. Includes the cheapest eFon per-minute rate for calling back and a scam warning for one-ring calls.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "description": "Dialing code or the start of an international number: '+36', '0036', '36', '+1 876', '00252 61 123 4567'."
        },
        "language": {
          "type": "string",
          "enum": [
            "en",
            "de",
            "fr",
            "nl",
            "da",
            "sv",
            "nb",
            "es",
            "pt",
            "it",
            "ar",
            "ti",
            "ru"
          ],
          "default": "en",
          "description": "Language for country names and the returned page links."
        }
      },
      "required": [
        "code"
      ]
    }
  }
];
export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` belongs to the captured built surface. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `dialrates error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Read a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * present, otherwise the last parseable message, otherwise
 * null when nothing in the body parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not a JSON payload; skip this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client holding a single upstream session,
 * opened lazily on first use and reused from then on
 * (for the process lifetime in the MCP server, or for a
 * single invocation in the CLI).
 */
export class DialratesClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).DIALRATES_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    // The registry record declares NO headers on the upstream
    // remote: no Authorization header is ever sent.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "dialrates", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // Nothing needed from the notification response body.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Hand the upstream result back exactly as received.
    return result;
  }
}

/** Build a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): DialratesClient {
  return new DialratesClient(deps);
}

/** One-shot helper: a fresh client for a single call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new DialratesClient(deps).callTool(name, args);
}
