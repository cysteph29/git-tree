import { setTimeout as pause } from "node:timers/promises";
import type { Repository } from "./tree.ts";
import { parseRepositoryUrl, RepositoryError, type RepositoryResult } from "./repository-url.ts";

const API = "https://api.github.com";
const TTL = 5 * 60 * 1000;
const CACHE_BYTES = 5 * 1024 * 1024;
const unavailable = () => new RepositoryError("unavailable", "This repository could not be accessed. Check the URL and that it is public.", 404);
const incomplete = () => new RepositoryError("incomplete", "GitHub returned incomplete branch data. Please try again.", 502);
type Metadata = { id: number; full_name: string; default_branch: string; private: boolean; visibility: string };

function publicMetadata(value: unknown): Metadata {
  if (!value || typeof value !== "object") throw incomplete();
  const data = value as Partial<Metadata>;
  if (data.private === true || (typeof data.visibility === "string" && data.visibility !== "public")) throw unavailable();
  if (data.private !== false || data.visibility !== "public" || !Number.isSafeInteger(data.id) || (data.id ?? 0) <= 0 || typeof data.full_name !== "string" || typeof data.default_branch !== "string" || !data.default_branch) throw incomplete();
  parseRepositoryUrl(`https://github.com/${data.full_name}`);
  return data as Metadata;
}

// A loader instance owns its cache and in-flight requests. Injection lets the
// same real pagination/error path run against controlled GitHub responses in tests.
export function createRepositoryLoader({ fetchImpl = fetch, token, now = Date.now, timeoutMs = 30_000, retryDelayMs = 350 }: {
  fetchImpl?: typeof fetch; token?: string; now?: () => number; timeoutMs?: number; retryDelayMs?: number;
} = {}) {
  const cache = new Map<number, { result: RepositoryResult; expires: number; bytes: number }>();
  const inFlight = new Map<string, Promise<RepositoryResult>>();
  let cacheBytes = 0;
  const evict = (id: number) => {
    const entry = cache.get(id);
    if (entry) { cacheBytes -= entry.bytes; cache.delete(id); }
  };

  async function load(input: string): Promise<RepositoryResult> {
    const parsed = parseRepositoryUrl(input);
    const existing = inFlight.get(parsed.key);
    if (existing) return existing;

    const task = (async () => {
      const signal = AbortSignal.timeout(timeoutMs);
      const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "github-tree" };
      if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;

      async function request(initialUrl: string, allowedPath: (path: string) => boolean, emptyAllowed = false): Promise<{ data: unknown; headers: Headers; url: string }> {
        let address = initialUrl;
        let redirects = 0;
        let retries = 0;
        while (true) {
          const target = new URL(address);
          if (target.origin !== API || target.username || target.password || !allowedPath(target.pathname)) throw incomplete();
          let response: Response;
          try {
            response = await fetchImpl(target.href, { headers, signal, redirect: "manual", cache: "no-store" });
          } catch (error) {
            if (signal.aborted) throw error;
            if (retries++ < 1) { await pause(retryDelayMs, undefined, { signal }); continue; }
            throw new RepositoryError("network", "Couldn’t reach GitHub. Please try again.", 502);
          }
          if ([301, 302, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location || ++redirects > 3) throw incomplete();
            address = new URL(location, address).href;
            await response.body?.cancel();
            continue;
          }
          let data: unknown;
          try { data = await response.json(); } catch {
            if (signal.aborted) throw new DOMException("Timed out", "TimeoutError");
            if (response.ok) throw incomplete();
          }
          const message = data && typeof data === "object" && "message" in data ? String(data.message) : "";
          if (response.status === 429 || (response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after") || /rate limit|abuse detection/i.test(message)))) {
            const retry = response.headers.get("retry-after");
            const reset = response.headers.get("x-ratelimit-reset");
            const retryTime = retry ? (/^\d+$/.test(retry) ? now() + Number(retry) * 1000 : Date.parse(retry)) : reset ? Number(reset) * 1000 : NaN;
            const retryAt = Number.isFinite(retryTime) && retryTime > now() && retryTime < 8.64e15 ? new Date(retryTime).toISOString() : undefined;
            throw new RepositoryError("rate_limit", "GitHub’s request limit has been reached. Please try again later.", 429, retryAt);
          }
          if ([403, 404, 451].includes(response.status)) throw unavailable();
          if (response.status === 401) throw new RepositoryError("configuration", "The server couldn’t authenticate with GitHub. Please try again after its GitHub connection is updated.", 503);
          if (emptyAllowed && response.status === 409 && /^git repository is empty\.?$/i.test(message)) return { data: [], headers: new Headers(), url: target.href };
          if (response.status >= 500) {
            if (retries++ < 1) { await pause(retryDelayMs, undefined, { signal }); continue; }
            throw new RepositoryError("github_error", "GitHub is having trouble responding. Please try again shortly.", 502);
          }
          if (!response.ok) throw new RepositoryError("github_error", "GitHub couldn’t return this repository. Please try again.", 502);
          return { data, headers: response.headers, url: target.href };
        }
      }

      const metadataPath = (path: string) => /^\/repos\/[\w.-]+\/[\w.-]+$/.test(path) || /^\/repositories\/\d+$/.test(path);
      const readMetadata = async (url: string) => publicMetadata((await request(url, metadataPath)).data);
      try {
        let metadata = await readMetadata(`${API}/repos/${parsed.owner}/${parsed.repo}`);
        // Always re-check visibility before returning cached data, including when
        // a server token could still read a repository that has become private.
        for (const [id, entry] of cache) if (entry.expires <= now()) evict(id);
        const cached = cache.get(metadata.id);
        if (cached && cached.result.repository.defaultBranch === metadata.default_branch) {
          cache.delete(metadata.id);
          cache.set(metadata.id, cached);
          return { ...cached.result, repository: { ...cached.result.repository, name: metadata.full_name }, cached: true };
        }
        evict(metadata.id);

        for (let attempt = 0; attempt < 2; attempt++) {
          const names = new Set<string>();
          let duplicates = false;
          const namedPath = `/repos/${metadata.full_name}/branches`;
          const idPath = `/repositories/${metadata.id}/branches`;
          const allowedPath = (path: string) => path.toLowerCase() === namedPath.toLowerCase() || path === idPath;
          let address: string | undefined = `${API}${namedPath}?per_page=100&page=1`;
          const visited = new Set<string>();
          while (address) {
            if (visited.has(address)) throw incomplete();
            visited.add(address);
            const page = await request(address, allowedPath, true);
            if (!Array.isArray(page.data)) throw incomplete();
            for (const item of page.data) {
              if (!item || typeof item.name !== "string" || !item.name) throw incomplete();
              if (names.has(item.name)) duplicates = true;
              names.add(item.name);
            }
            const link = page.headers.get("link");
            const nextLinks = link ? [...link.matchAll(/<([^>]+)>\s*;\s*rel="([^"]+)"/g)].filter(match => match[2].split(/\s+/).includes("next")) : [];
            if (nextLinks.length > 1 || (link && /\bnext\b/.test(link) && nextLinks.length !== 1)) throw incomplete();
            address = nextLinks[0]?.[1];
            if (address) {
              if (page.data.length === 0) throw incomplete();
              const next = new URL(address, page.url);
              const previousPage = Number(new URL(page.url).searchParams.get("page") ?? "1");
              if (next.origin !== API || next.username || next.password || !allowedPath(next.pathname) || next.searchParams.get("per_page") !== "100" || !/^\d+$/.test(next.searchParams.get("page") ?? "") || Number(next.searchParams.get("page")) !== previousPage + 1 || [...next.searchParams.keys()].some(key => !["page", "per_page"].includes(key))) throw incomplete();
              address = next.href;
            }
          }

          const fresh = await readMetadata(`${API}/repositories/${metadata.id}`);
          if (fresh.id !== metadata.id) throw incomplete();
          if (duplicates || fresh.default_branch !== metadata.default_branch || (names.size > 0 && !names.has(fresh.default_branch))) {
            metadata = fresh;
            if (attempt === 0) continue;
            throw new RepositoryError("inconsistent", "The repository’s branches changed while loading. Please try again.", 502);
          }
          const repository: Repository = { id: fresh.id, name: fresh.full_name, defaultBranch: fresh.default_branch, branches: [...names].sort() };
          const result: RepositoryResult = { repository, fetchedAt: new Date(now()).toISOString(), cached: false };
          const bytes = Buffer.byteLength(JSON.stringify(result));
          // This bounds cache memory, not repository size. Large complete results
          // are still returned; they simply aren't retained in this process.
          if (bytes <= CACHE_BYTES) {
            while (cacheBytes + bytes > CACHE_BYTES || cache.size >= 100) evict(cache.keys().next().value!);
            evict(repository.id);
            cache.set(repository.id, { result, expires: now() + TTL, bytes });
            cacheBytes += bytes;
          }
          return result;
        }
        throw incomplete();
      } catch (error) {
        if (signal.aborted) throw new RepositoryError("timeout", "Loading all branches took too long. Please try again.", 504);
        if (error instanceof RepositoryError) throw error;
        throw incomplete();
      }
    })();
    inFlight.set(parsed.key, task);
    try { return await task; } finally { inFlight.delete(parsed.key); }
  }
  return load;
}

export const loadRepository = createRepositoryLoader({ token: process.env.GITHUB_TOKEN });
