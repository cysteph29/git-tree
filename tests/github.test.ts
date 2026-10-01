import assert from "node:assert/strict";
import { test } from "node:test";
import { createRepositoryLoader } from "../lib/github.server.ts";
import { parseRepositoryUrl, RepositoryError } from "../lib/repository-url.ts";

const url = "https://github.com/fieldnotes/evergreen";
const metadata = { id: 314159, full_name: "fieldnotes/evergreen", default_branch: "develop", private: false, visibility: "public" };
const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers });
const branches = (...names: string[]) => names.map(name => ({ name }));
const nextLink = '<https://api.github.com/repos/fieldnotes/evergreen/branches?per_page=100&page=2>; rel="next"';

function queue(...responses: (Response | Error)[]) {
  const calls: { url: string; options?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, options) => {
    calls.push({ url: String(input), options });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected upstream request");
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetchImpl, calls };
}
const problem = (code: string) => (error: unknown) => error instanceof RepositoryError && error.code === code;

test("normalizes repository, .git, tree, and file URLs without guessing branch names", () => {
  for (const input of [url, ` ${url}.git/ `, `${url}/tree/feature/with/slashes?tab=readme#section`, `${url}/blob/feature/with/slashes/README.md`, "github.com/fieldnotes/evergreen", "http://www.github.com/fieldnotes/evergreen"]) {
    assert.equal(parseRepositoryUrl(input).url, url);
  }
  assert.equal(parseRepositoryUrl("https://GitHub.com/FieldNotes/EverGreen").key, "fieldnotes/evergreen");
  assert.equal(parseRepositoryUrl(`${url}/tree/feature%2Fwith%2Fslashes`).repo, "evergreen");
});

test("rejects foreign hosts, credentials, ports, traversal, malformed and non-repository URLs", () => {
  for (const input of ["", "not a url", "https://example.com/a/b", "https://github.com.evil.test/a/b", "https://github.com@evil.test/a/b", "https://user:secret@github.com/a/b", "ftp://github.com/a/b", "https://github.com:8000/a/b", "https://github.com/owner", `${url}/issues/1`, `${url}/blob/main`, `${url}/tree`, "https://github.com/settings/profile", "https://github.com/a/%2e%2e/repo", "https://github.com/a/b/../c", "https://github.com/a%2Fb/c", "https://github.com/a/rep%ZZ", "https://github.com/a//b", "https://github.com/a/b\\c", "https://github.com/a/b\nc", `${url}/tree/%00`, "x".repeat(2049)]) {
    assert.throws(() => parseRepositoryUrl(input), problem("invalid_url"), input);
  }
});

test("loads every page, uses the actual default branch, and returns only normalized public data", async () => {
  const first = ["develop", ...Array.from({ length: 99 }, (_, i) => `branch-${i}`)];
  const upstream = queue(json(metadata), json(branches(...first), 200, { link: nextLink }), json(branches("last/page")), json(metadata));
  const load = createRepositoryLoader({ fetchImpl: upstream.fetchImpl, token: "test-token" });
  const result = await load(`${url}/tree/not-the-default`);
  assert.equal(result.repository.branches.length, 101);
  assert.equal(result.repository.defaultBranch, "develop");
  assert.ok(result.repository.branches.includes("last/page"));
  assert.equal(result.cached, false);
  assert.equal(upstream.calls.length, 4);
  assert.equal(upstream.calls[1].url, "https://api.github.com/repos/fieldnotes/evergreen/branches?per_page=100&page=1");
  assert.equal(upstream.calls[2].url, "https://api.github.com/repos/fieldnotes/evergreen/branches?per_page=100&page=2");
  assert.equal(new Headers(upstream.calls[0].options?.headers).get("authorization"), "Bearer test-token");
  assert.ok(!JSON.stringify(result).includes("test-token"));
});

test("a failed later page is never returned or cached as a complete tree", async () => {
  const upstream = queue(json(metadata), json(branches("develop"), 200, { link: nextLink }), json({ message: "Not Found" }, 404), json(metadata), json(branches("develop", "complete")), json(metadata));
  const load = createRepositoryLoader({ fetchImpl: upstream.fetchImpl });
  await assert.rejects(load(url), problem("unavailable"));
  const result = await load(url);
  assert.equal(result.cached, false);
  assert.deepEqual(result.repository.branches, ["complete", "develop"]);
  assert.equal(upstream.calls.length, 6);
});

test("coalesces concurrent requests and rechecks visibility before cached results", async () => {
  const upstream = queue(json(metadata), json(branches("develop")), json(metadata), json(metadata), json({ ...metadata, private: true, visibility: "private" }));
  const load = createRepositoryLoader({ fetchImpl: upstream.fetchImpl });
  const [one, two] = await Promise.all([load(url), load(`${url}.git`)]);
  assert.deepEqual(one, two);
  assert.equal(upstream.calls.length, 3);
  assert.equal((await load(url)).cached, true);
  assert.equal(upstream.calls.length, 4);
  await assert.rejects(load(url), problem("unavailable"));
  assert.equal(upstream.calls.length, 5);
});

test("cache expires and a new default branch invalidates a fresh cache", async () => {
  let clock = 1_800_000_000_000;
  const changed = { ...metadata, default_branch: "trunk" };
  const upstream = queue(json(metadata), json(branches("develop")), json(metadata), json(metadata), json(branches("develop", "new")), json(metadata), json(changed), json(branches("trunk")), json(changed));
  const load = createRepositoryLoader({ fetchImpl: upstream.fetchImpl, now: () => clock });
  await load(url);
  clock += 300_001;
  const expired = await load(url);
  assert.equal(expired.cached, false);
  assert.ok(expired.repository.branches.includes("new"));
  const updated = await load(url);
  assert.equal(updated.cached, false);
  assert.equal(updated.repository.defaultBranch, "trunk");
});

test("private data is rejected before branches and if visibility changes during pagination", async () => {
  const privateRepo = { ...metadata, private: true, visibility: "private" };
  const first = queue(json(privateRepo));
  await assert.rejects(createRepositoryLoader({ fetchImpl: first.fetchImpl, token: "test-token" })(url), problem("unavailable"));
  assert.equal(first.calls.length, 1);
  const later = queue(json(metadata), json(branches("develop", "secret-branch")), json(privateRepo));
  await assert.rejects(createRepositoryLoader({ fetchImpl: later.fetchImpl, token: "test-token" })(url), problem("unavailable"));
});

test("empty repositories are empty data, while unrelated conflicts remain errors", async () => {
  for (const response of [json([]), json({ message: "Git Repository is empty." }, 409)]) {
    const upstream = queue(json(metadata), response, json(metadata));
    assert.deepEqual((await createRepositoryLoader({ fetchImpl: upstream.fetchImpl })(url)).repository.branches, []);
  }
  const upstream = queue(json(metadata), json({ message: "Unexpected conflict" }, 409));
  await assert.rejects(createRepositoryLoader({ fetchImpl: upstream.fetchImpl })(url), problem("github_error"));
});

test("follows repository renames but rejects foreign redirects and pagination targets", async () => {
  const renamed = { ...metadata, full_name: "fieldnotes/renamed" };
  const upstream = queue(new Response(null, { status: 301, headers: { location: "https://api.github.com/repositories/314159" } }), json(renamed), json(branches("develop")), json(renamed));
  assert.equal((await createRepositoryLoader({ fetchImpl: upstream.fetchImpl })(url)).repository.name, "fieldnotes/renamed");
  for (const location of ["https://evil.test/steal", "http://api.github.com/repositories/314159", "https://api.github.com/user"]) {
    const redirected = queue(new Response(null, { status: 301, headers: { location } }));
    await assert.rejects(createRepositoryLoader({ fetchImpl: redirected.fetchImpl, token: "test-token" })(url), problem("incomplete"));
    assert.equal(redirected.calls.length, 1);
  }
  for (const target of ["https://evil.test/steal?page=2&per_page=100", "https://api.github.com/repos/someone/private/branches?per_page=100&page=2", "https://api.github.com/repos/fieldnotes/evergreen/branches?per_page=100&page=1", "https://api.github.com/repos/fieldnotes/evergreen/branches?per_page=100&page=3"]) {
    const forged = queue(json(metadata), json(branches("develop"), 200, { link: `<${target}>; rel="next"` }));
    await assert.rejects(createRepositoryLoader({ fetchImpl: forged.fetchImpl, token: "test-token" })(url), problem("incomplete"));
    assert.equal(forged.calls.length, 2);
  }
});

test("rate limits preserve retry information and are not retried immediately", async () => {
  const clock = 1_800_000_000_000;
  for (const response of [json({ message: "API rate limit exceeded" }, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(clock / 1000 + 60) }), json({ message: "Secondary rate limit" }, 429, { "retry-after": "60" })]) {
    const upstream = queue(response);
    await assert.rejects(createRepositoryLoader({ fetchImpl: upstream.fetchImpl, now: () => clock })(url), error => problem("rate_limit")(error) && (error as RepositoryError).retryAt === new Date(clock + 60_000).toISOString());
    assert.equal(upstream.calls.length, 1);
  }
});

test("network/service failures get one retry; malformed payloads and authentication failures are useful errors", async () => {
  const network = queue(new TypeError("network failed"), new TypeError("network failed"));
  await assert.rejects(createRepositoryLoader({ fetchImpl: network.fetchImpl, retryDelayMs: 0 })(url), problem("network"));
  assert.equal(network.calls.length, 2);
  const service = queue(json({}, 503), json({}, 503));
  await assert.rejects(createRepositoryLoader({ fetchImpl: service.fetchImpl, retryDelayMs: 0 })(url), problem("github_error"));
  assert.equal(service.calls.length, 2);
  const recovery = queue(json({}, 503), json(metadata), json(branches("develop")), json(metadata));
  assert.equal((await createRepositoryLoader({ fetchImpl: recovery.fetchImpl, retryDelayMs: 0 })(url)).repository.branches.length, 1);
  for (const [response, code] of [[json({}, 401), "configuration"], [json({}, 404), "unavailable"], [json({}, 403), "unavailable"], [json({ private: false }), "incomplete"], [new Response("not JSON"), "incomplete"]] as const) {
    const upstream = queue(response);
    await assert.rejects(createRepositoryLoader({ fetchImpl: upstream.fetchImpl })(url), problem(code));
  }
});

test("missing defaults and duplicate pagination are retried once, never invented", async () => {
  const recovered = queue(json(metadata), json(branches("other")), json(metadata), json(branches("develop", "other")), json(metadata));
  assert.deepEqual((await createRepositoryLoader({ fetchImpl: recovered.fetchImpl })(url)).repository.branches, ["develop", "other"]);
  const missing = queue(json(metadata), json(branches("other")), json(metadata), json(branches("other")), json(metadata));
  await assert.rejects(createRepositoryLoader({ fetchImpl: missing.fetchImpl })(url), problem("inconsistent"));
  const duplicate = queue(json(metadata), json(branches("develop", "develop")), json(metadata), json(branches("develop", "develop")), json(metadata));
  await assert.rejects(createRepositoryLoader({ fetchImpl: duplicate.fetchImpl })(url), problem("inconsistent"));
});

test("the whole request has a deadline and never returns a partial drawing", async () => {
  const fetchImpl: typeof fetch = async (_input, options) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Upstream failed to abort")), 1000);
    options?.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(options.signal?.reason); }, { once: true });
  });
  await assert.rejects(createRepositoryLoader({ fetchImpl, timeoutMs: 15 })(url), problem("timeout"));
});
