// @vitest-environment node
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let runtime: Miniflare;

beforeAll(async () => {
  const source = await readFile(new URL("../functions/_shared/contact/transport.ts", import.meta.url), "utf8");
  const transport = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  }).outputText;
  runtime = new Miniflare(convertV4MiniflareOptions({
    cf: false,
    port: 0,
    workers: [{
      name: "contact-transport",
      modules: true,
      compatibilityDate: "2026-08-27",
      outboundService: "provider-fixture",
      script: transport + `
export default { async fetch(request) {
  const query = new URL(request.url).searchParams;
  if (query.has("stats")) return fetch("https://provider.test/stats");
  const init = { method: "POST", headers: { Authorization: "Bearer fixture-credential" }, body: "fixture-private-body" };
  const target = "https://provider.test/" + (query.get("status") || "success");
  let value;
  if (query.get("mode") === "plain") {
    const response = await fetchWithTimeout(target, init, 1000);
    value = response ? await response.json() : undefined;
  } else {
    value = await fetchWithJsonTimeout(target, init, 1000, 1024, (_response, readJson) => readJson());
  }
  return Response.json({ value: value ?? null });
} };`
    }, {
      name: "provider-fixture",
      modules: true,
      compatibilityDate: "2026-08-27",
      script: `let requests = 0; let destinationRequests = 0;
export default { async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/stats") return Response.json({ requests, destinationRequests });
  requests += 1;
  if (path === "/destination") destinationRequests += 1;
  const status = Number(path.slice(1));
  if (status >= 300 && status < 400) return new Response(null, {status, headers: {Location:"https://destination.test/destination"}});
  return Response.json({ authorization:request.headers.get("Authorization"), body:await request.text() });
} };`
    }]
  }));
  await runtime.ready;
}, 20_000);

afterAll(async () => { await runtime?.dispose(); });

describe("contact transport in the real Workers runtime", () => {
  it.each(["json", "plain"])("accepts successful %s exchanges with native fetch", async (mode) => {
    const response = await runtime.dispatchFetch(`https://localhost/?mode=${mode}`);
    expect(await response.json()).toEqual({ value: { authorization: "Bearer fixture-credential", body: "fixture-private-body" } });
  });

  it.each(["json", "plain"])("rejects every 3xx %s response without forwarding credentials or bodies", async (mode) => {
    const before = await (await runtime.dispatchFetch("https://localhost/?stats")).json() as { requests: number };
    for (let status = 300; status < 400; status += 1) {
      const response = await runtime.dispatchFetch(`https://localhost/?mode=${mode}&status=${status}`);
      expect(await response.json(), `HTTP ${status}`).toEqual({ value: null });
    }
    expect(await (await runtime.dispatchFetch("https://localhost/?stats")).json()).toEqual({
      requests: before.requests + 100, destinationRequests: 0
    });
  }, 15_000);
});
