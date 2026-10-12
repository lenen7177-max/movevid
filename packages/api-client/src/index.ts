import { createORPCClient, type NestedClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";

export interface ApiClientOptions {
  baseUrl: string;
  credentials?: RequestCredentials;
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
  fetch?: typeof fetch;
  serviceBinding?: Fetcher; // Cloudflare Service Binding
}

export type ApiClientContext = Record<PropertyKey, unknown>;

export function getOrpcErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function getOrpcErrorReason(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "object" && data !== null && "reason" in data) {
      const reason = (data as { reason: unknown }).reason;
      return typeof reason === "string" ? reason : undefined;
    }
  }
  return undefined;
}

export interface QueryClientOptions {
  staleTimeMs?: number;
  onError?: (error: Error) => void;
}

// Cloudflare Service Binding interface
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

const DEFAULT_STALE_TIME_MS = 60_000;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function resolveHeaders(getHeaders?: ApiClientOptions["getHeaders"]) {
  if (!getHeaders) {
    return undefined;
  }

  return async () => {
    const raw = await getHeaders();
    return raw instanceof Headers ? raw : new Headers(raw);
  };
}

export function createRpcLink(options: ApiClientOptions): RPCLink<ApiClientContext> {
  const { baseUrl, credentials, fetch: fetchImpl, getHeaders, serviceBinding } = options;
  const headers = resolveHeaders(getHeaders);

  // Use Service Binding if available (server-side only)
  if (serviceBinding && typeof window === "undefined") {
    const serviceBindingBaseUrl = `${normalizeBaseUrl(baseUrl)}/rpc`;

    const serviceFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      return serviceBinding.fetch(request);
    };

    return new RPCLink<ApiClientContext>({
      url: serviceBindingBaseUrl,
      fetch: serviceFetch,
      headers,
    });
  }

  // Fallback to HTTP for client-side or when service binding is not available
  const url = `${normalizeBaseUrl(baseUrl)}/rpc`;
  const baseFetch = (fetchImpl ?? fetch).bind(globalThis);
  const fetchWithCredentials =
    credentials !== undefined
      ? (input: RequestInfo | URL, init?: RequestInit) => baseFetch(input, { ...init, credentials })
      : baseFetch;

  return new RPCLink<ApiClientContext>({
    url,
    fetch: fetchWithCredentials,
    headers,
  });
}

export function createApiClient<TClient extends NestedClient<ApiClientContext>>(
  options: ApiClientOptions,
): TClient {
  const link = createRpcLink(options);
  return createORPCClient<TClient>(link);
}

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  const { staleTimeMs = DEFAULT_STALE_TIME_MS, onError } = options;
  const queryCache = onError
    ? new QueryCache({
        onError,
      })
    : undefined;

  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: staleTimeMs,
      },
    },
    ...(queryCache ? { queryCache } : {}),
  });
}

export function createOrpcUtils<TClient extends NestedClient<ApiClientContext>>(client: TClient) {
  return createTanstackQueryUtils<TClient>(client);
}
