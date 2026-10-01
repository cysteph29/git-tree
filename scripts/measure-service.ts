import { performance } from "node:perf_hooks";
import { setTimeout as pause } from "node:timers/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform, arch } from "node:os";
import { fixture, generateDrawing } from "../lib/tree.ts";
import { createRepositoryLoader } from "../lib/github.server.ts";

const round = (n: number) => Math.round(n * 100) / 100;
const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? 0;
const geometry = [1, 2, 10, 100, 1000].map(count => {
  const repository = fixture(count);
  for (let i = 0; i < 5; i++) generateDrawing(repository);
  const times = Array.from({ length: 30 }, () => {
    const start = performance.now();
    generateDrawing(repository);
    return performance.now() - start;
  });
  return { branches: count, samples: times.length, layoutP50Ms: round(percentile(times, 0.5)), layoutP95Ms: round(percentile(times, 0.95)), geometryBytes: Buffer.byteLength(JSON.stringify(generateDrawing(repository))) };
});

async function scenario(name: string, count: number, visitors: number, distinct: boolean, warm: boolean, sequential = false) {
  let requests = 0, active = 0, peak = 0;
  const paths: string[] = [];
  const fetchImpl: typeof fetch = async (input, options) => {
    const url = new URL(String(input));
    requests++;
    active++;
    peak = Math.max(peak, active);
    paths.push(url.pathname);
    await pause(20, undefined, { signal: options?.signal ?? undefined });
    active--;
    const id = Number(url.pathname.match(/repo-(\d+)/)?.[1] ?? url.pathname.match(/repositories\/(\d+)/)?.[1] ?? 1);
    const fullName = `bench/repo-${id}`;
    if (!url.pathname.endsWith("/branches")) return Response.json({ id, full_name: fullName, default_branch: "develop", private: false, visibility: "public" });
    const page = Number(url.searchParams.get("page") ?? 1);
    const all = fixture(count).branches;
    const data = all.slice((page - 1) * 100, page * 100).map(name => ({ name }));
    const headers = page * 100 < count ? { link: `<https://api.github.com/repos/${fullName}/branches?per_page=100&page=${page + 1}>; rel="next"` } : undefined;
    return Response.json(data, { headers });
  };
  const load = createRepositoryLoader({ fetchImpl });
  if (warm) await load("https://github.com/bench/repo-1");
  requests = 0; peak = 0; paths.length = 0;
  let cached = 0;
  const times: number[] = [];
  const start = performance.now();
  const visit = async (i: number) => {
    const began = performance.now();
    const result = await load(`https://github.com/bench/repo-${distinct ? i + 1 : 1}`);
    if (result.repository.branches.length !== count) throw new Error("Incomplete benchmark result");
    if (result.cached) cached++;
    times.push(performance.now() - began);
  };
  if (sequential) for (let i = 0; i < visitors; i++) await visit(i);
  else await Promise.all(Array.from({ length: visitors }, (_, i) => visit(i)));
  return { name, branches: count, visitors, elapsedMs: round(performance.now() - start), visitorP50Ms: round(percentile(times, 0.5)), visitorP95Ms: round(percentile(times, 0.95)), upstreamRequests: requests, branchPageRequests: paths.filter(path => path.endsWith("/branches")).length, peakUpstreamConcurrency: peak, cachedResults: cached, upstreamRequestsPerVisitor: round(requests / visitors) };
}

const service = [];
for (const count of [1, 10, 100, 1000]) service.push(await scenario(`cold-${count}`, count, 1, false, false));
service.push(await scenario("50-concurrent-same-cold", 1000, 50, false, false));
service.push(await scenario("50-concurrent-same-warm", 1000, 50, false, true));
service.push(await scenario("50-sequential-same-warm", 1000, 50, false, true, true));
service.push(await scenario("50-concurrent-distinct-cold", 1000, 50, true, false));

const report = {
  measuredAt: new Date().toISOString(),
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  method: "Geometry: 5 warm-ups, 30 samples. Service: real loader with synthetic GitHub responses and fixed 20 ms per upstream request; no external traffic. Latencies and concurrency describe this simulation, not production throughput or GitHub latency.",
  geometry, service,
};
await mkdir("reports", { recursive: true });
await writeFile("reports/step-5-service.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
