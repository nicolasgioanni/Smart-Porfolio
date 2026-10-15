import { lookup as lookupHostname } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { isIP } from "node:net";
import { Readable } from "node:stream";

export type WorkbookFetchResponse = Pick<Response, "ok" | "status" | "statusText" | "headers" | "body" | "arrayBuffer">;
export type WorkbookFetch = (url: string, init: RequestInit) => Promise<WorkbookFetchResponse>;

export type WorkbookResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type WorkbookHostnameResolver = (
  hostname: string,
  options: { all: true; verbatim: true }
) => Promise<ReadonlyArray<WorkbookResolvedAddress>>;

export type WorkbookHttpsRequestOptions = RequestOptions & {
  autoSelectFamily: false;
};

export type WorkbookHttpsRequest = (
  url: URL,
  options: WorkbookHttpsRequestOptions,
  onResponse: (response: IncomingMessage) => void
) => ClientRequest;

const maximumResolvedAddresses = 16;

export class WorkbookTransportSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookTransportSafetyError";
  }
}

function abortedError(): Error {
  return new Error("The workbook download was aborted");
}

function ipv4Octets(value: string): number[] | undefined {
  const octets = value.split(".").map((part) => Number(part));
  return octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? octets
    : undefined;
}

function isPublicIpv4Address(value: string): boolean {
  const octets = ipv4Octets(value);
  if (!octets) return false;

  const [first, second, third] = octets;
  if (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 31 && third === 196) ||
    (first === 192 && second === 52 && third === 193) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 175 && third === 48) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  ) {
    return false;
  }

  return true;
}

function ipv6Value(value: string): bigint | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes(".")) return undefined;
  const parts = normalized.split("::");
  if (parts.length > 2) return undefined;

  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  if (
    left.length + right.length > 8 ||
    [...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/.test(part)) ||
    (parts.length === 1 && left.length !== 8)
  ) {
    return undefined;
  }

  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return groups.reduce((result, group) => (result << 16n) + BigInt(`0x${group}`), 0n);
}

function ipv6InRange(value: bigint, network: string, prefixLength: number): boolean {
  const parsedNetwork = ipv6Value(network);
  if (parsedNetwork === undefined) return true;
  const mask = prefixLength === 0 ? 0n : ((1n << BigInt(prefixLength)) - 1n) << BigInt(128 - prefixLength);
  return (value & mask) === (parsedNetwork & mask);
}

function isPublicIpv6Address(value: string): boolean {
  const parsed = ipv6Value(value);
  if (parsed === undefined) return false;

  const specialPurposeRanges: ReadonlyArray<readonly [string, number]> = [
    ["2001::", 23],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["3fff::", 20]
  ];
  return ipv6InRange(parsed, "2000::", 3) && !specialPurposeRanges.some(([network, prefixLength]) => ipv6InRange(parsed, network, prefixLength));
}

export function isPublicWorkbookAddress(value: string, family: number): boolean {
  if (family === 4 && isIP(value) === 4) return isPublicIpv4Address(value);
  if (family === 6 && isIP(value) === 6) return isPublicIpv6Address(value);
  return false;
}

async function resolveWithAbort(
  hostname: string,
  signal: AbortSignal,
  resolver: WorkbookHostnameResolver
): Promise<ReadonlyArray<WorkbookResolvedAddress>> {
  if (signal.aborted) throw abortedError();

  const resolution = Promise.resolve().then(() => resolver(hostname, { all: true, verbatim: true }));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      callback();
    };
    const abort = () => finish(() => reject(abortedError()));

    signal.addEventListener("abort", abort, { once: true });
    resolution.then(
      (addresses) => finish(() => resolve(addresses)),
      (error: unknown) => finish(() => reject(error))
    );
  });
}

function selectPinnedAddress(addresses: ReadonlyArray<WorkbookResolvedAddress>): WorkbookResolvedAddress {
  if (
    addresses.length === 0 ||
    addresses.length > maximumResolvedAddresses ||
    !addresses.every((entry) => isPublicWorkbookAddress(entry.address, entry.family))
  ) {
    throw new WorkbookTransportSafetyError("The workbook download resolved to an unsafe network destination");
  }

  return addresses[0]!;
}

function responseHeaders(response: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(response.headers)) {
    if (Array.isArray(value)) {
      for (const part of value) headers.append(name, part);
    } else if (typeof value === "string") {
      headers.set(name, value);
    }
  }
  return headers;
}

function asFetchResponse(response: IncomingMessage): WorkbookFetchResponse {
  const status = response.statusCode ?? 0;
  const body = Readable.toWeb(response) as ReadableStream<Uint8Array>;
  const mayHaveBody = ![101, 103, 204, 205, 304].includes(status);
  const wrapped = new Response(mayHaveBody ? body : null, {
    status,
    statusText: response.statusMessage ?? "",
    headers: responseHeaders(response)
  });

  if (!mayHaveBody) {
    try {
      const cancellation = body.cancel();
      if (cancellation && typeof cancellation.catch === "function") void cancellation.catch(() => undefined);
    } catch {
      // There is no usable body for this HTTP status, so cleanup is best effort.
    }
  }

  return wrapped;
}

function anonymousRequestHeaders(init: RequestInit): Record<string, string> {
  const headers = new Headers(init.headers);
  if (headers.has("authorization") || headers.has("cookie")) {
    throw new Error("The workbook download must remain anonymous");
  }
  return Object.fromEntries(headers.entries());
}

export function createPinnedWorkbookFetch({
  resolver = lookupHostname as WorkbookHostnameResolver,
  requestImplementation = httpsRequest as WorkbookHttpsRequest
}: {
  resolver?: WorkbookHostnameResolver;
  requestImplementation?: WorkbookHttpsRequest;
} = {}): WorkbookFetch {
  return async (value, init) => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      throw new WorkbookTransportSafetyError("The workbook download target is invalid");
    }
    if (init.signal?.aborted) throw abortedError();

    const controller = init.signal;
    if (!controller) throw new Error("The workbook download requires an abort signal");
    const address = selectPinnedAddress(await resolveWithAbort(url.hostname, controller, resolver));

    return new Promise<WorkbookFetchResponse>((resolve, reject) => {
      let settled = false;
      let request: ClientRequest | undefined;
      let incomingResponse: IncomingMessage | undefined;
      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        callback();
      };
      const abort = () => {
        const error = abortedError();
        try {
          incomingResponse?.destroy(error);
        } catch {
          // The incoming stream can already be closed after a completed read.
        }
        try {
          request?.destroy(error);
        } catch {
          // Request teardown is best effort; the caller's deadline still wins.
        }
        settle(() => reject(error));
      };
      const lookup: RequestOptions["lookup"] = (hostname, _options, callback) => {
        if (hostname.toLowerCase() !== url.hostname) {
          callback(new WorkbookTransportSafetyError("The workbook HTTPS request changed its destination hostname"), "", 0);
          return;
        }
        callback(null, address.address, address.family);
      };

      controller.addEventListener("abort", abort, { once: true });
      try {
        request = requestImplementation(
          url,
          {
            agent: false,
            autoSelectFamily: false,
            family: address.family,
            headers: anonymousRequestHeaders(init),
            lookup,
            method: "GET",
            rejectUnauthorized: true,
            servername: url.hostname
          } satisfies WorkbookHttpsRequestOptions,
          (response) => {
            if (settled) {
              try { response.destroy(); } catch { /* late response cleanup is best effort */ }
              return;
            }
            try {
              incomingResponse = response;
              const converted = asFetchResponse(response);
              settle(() => resolve(converted));
            } catch {
              try { response.destroy(); } catch { /* invalid response cleanup is best effort */ }
              settle(() => reject(new Error("The workbook HTTPS response is invalid")));
            }
          }
        );
        request.once("error", () => settle(() => reject(new Error("The workbook HTTPS request failed"))));
        if (controller.aborted) {
          abort();
          return;
        }
        request.end();
      } catch (error: unknown) {
        settle(() => reject(error));
      }
    });
  };
}
