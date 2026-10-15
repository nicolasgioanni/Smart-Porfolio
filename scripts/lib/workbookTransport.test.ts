import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createPinnedWorkbookFetch,
  isPublicWorkbookAddress,
  type WorkbookHttpsRequest
} from "./workbookTransport";

type Lookup = (hostname: string, options: unknown, callback: (error: Error | null, address: string, family: 4 | 6) => void) => void;

function response(): IncomingMessage {
  const source = Readable.from([Buffer.from("workbook")]) as unknown as IncomingMessage;
  Object.assign(source, {
    headers: { "content-type": "application/octet-stream" },
    statusCode: 200,
    statusMessage: "OK"
  });
  return source;
}

function requestHarness(
  onEnd: (url: URL, options: RequestOptions, respond: (value: IncomingMessage) => void) => void,
  onDestroy?: () => void
): WorkbookHttpsRequest {
  return ((url, options, respond) => {
    const request = new EventEmitter() as ClientRequest;
    request.end = () => {
      onEnd(url, options, respond);
      return request;
    };
    request.destroy = () => {
      onDestroy?.();
      return request;
    };
    return request;
  }) as WorkbookHttpsRequest;
}

describe("pinned workbook HTTPS transport", () => {
  it.each([
    ["93.184.216.34", 4, true],
    ["10.0.0.1", 4, false],
    ["100.64.0.1", 4, false],
    ["127.0.0.1", 4, false],
    ["169.254.1.1", 4, false],
    ["192.0.2.1", 4, false],
    ["198.18.0.1", 4, false],
    ["203.0.113.1", 4, false],
    ["2606:4700:4700::1111", 6, true],
    ["::1", 6, false],
    ["::ffff:127.0.0.1", 6, false],
    ["64:ff9b::c000:201", 6, false],
    ["100:0:0:1::1", 6, false],
    ["2001:db8::1", 6, false],
    ["2002:c000:201::1", 6, false],
    ["3fff::1", 6, false],
    ["5f00::1", 6, false],
    ["fc00::1", 6, false],
    ["fe80::1", 6, false],
    ["fec0::1", 6, false]
  ])("classifies %s as %s public=%s", (address, family, expected) => {
    expect(isPublicWorkbookAddress(address, family)).toBe(expected);
  });

  it("requires every DNS result to be public before connecting", async () => {
    const request = vi.fn();
    const fetchWorkbook = createPinnedWorkbookFetch({
      resolver: async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 }
      ],
      requestImplementation: request as unknown as WorkbookHttpsRequest
    });

    await expect(fetchWorkbook("https://downloads.example.test/portfolio.xlsx", { signal: new AbortController().signal }))
      .rejects.toThrow("unsafe network destination");
    expect(request).not.toHaveBeenCalled();
  });

  it("uses one verbatim all-address lookup, pins the selected address, and retains host/SNI certificate validation", async () => {
    const resolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);
    const lookupCalls: Array<{ hostname: string; address: string; family: number }> = [];
    let capturedOptions: RequestOptions | undefined;
    const fetchWorkbook = createPinnedWorkbookFetch({
      resolver,
      requestImplementation: requestHarness((url, options, respond) => {
        capturedOptions = options;
        const lookup = options.lookup as unknown as Lookup;
        lookup(url.hostname, {}, (error, address, family) => {
          expect(error).toBeNull();
          lookupCalls.push({ hostname: url.hostname, address, family });
          respond(response());
        });
      })
    });

    const result = await fetchWorkbook("https://downloads.example.test/portfolio.xlsx", {
      headers: { accept: "application/octet-stream" },
      signal: new AbortController().signal
    });

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledWith("downloads.example.test", { all: true, verbatim: true });
    expect(lookupCalls).toEqual([{ hostname: "downloads.example.test", address: "93.184.216.34", family: 4 }]);
    expect(capturedOptions).toMatchObject({ agent: false, autoSelectFamily: false, family: 4, rejectUnauthorized: true, servername: "downloads.example.test" });
    expect(result.status).toBe(200);
  });

  it("returns at the outer abort deadline when DNS stalls", async () => {
    const controller = new AbortController();
    const fetchWorkbook = createPinnedWorkbookFetch({ resolver: async () => new Promise(() => {}) });
    const request = fetchWorkbook("https://downloads.example.test/portfolio.xlsx", { signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toThrow("aborted");
  });

  it("destroys a request that has not connected when its outer signal aborts", async () => {
    const controller = new AbortController();
    let destroyCount = 0;
    let resolveCreated: (() => void) | undefined;
    const created = new Promise<void>((resolve) => { resolveCreated = resolve; });
    const fetchWorkbook = createPinnedWorkbookFetch({
      resolver: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImplementation: (() => {
        const request = new EventEmitter() as ClientRequest;
        request.end = () => request;
        request.destroy = () => {
          destroyCount += 1;
          return request;
        };
        resolveCreated?.();
        return request;
      }) as WorkbookHttpsRequest
    });
    const request = fetchWorkbook("https://downloads.example.test/portfolio.xlsx", { signal: controller.signal });
    await created;
    controller.abort();
    await expect(request).rejects.toThrow("aborted");
    expect(destroyCount).toBe(1);
  });

  it("closes a response that arrives after an aborted request", async () => {
    const controller = new AbortController();
    let respond: ((value: IncomingMessage) => void) | undefined;
    let resolveEnded: (() => void) | undefined;
    const ended = new Promise<void>((resolve) => { resolveEnded = resolve; });
    const fetchWorkbook = createPinnedWorkbookFetch({
      resolver: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImplementation: requestHarness((_url, _options, onResponse) => {
        respond = onResponse;
        resolveEnded?.();
      })
    });

    const request = fetchWorkbook("https://downloads.example.test/portfolio.xlsx", { signal: controller.signal });
    await ended;
    controller.abort();
    await expect(request).rejects.toThrow("aborted");

    const late = response();
    const destroy = vi.spyOn(late, "destroy");
    respond?.(late);
    expect(destroy).toHaveBeenCalled();
  });
});
