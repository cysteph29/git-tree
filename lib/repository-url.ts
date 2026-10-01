import type { Repository } from "./tree.ts";

export type RepositoryResult = { repository: Repository; fetchedAt: string; cached: boolean };
export class RepositoryError extends Error {
  code: string;
  status: number;
  retryAt?: string;
  constructor(code: string, message: string, status = 400, retryAt?: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.status = status;
    this.retryAt = retryAt;
  }
}

export function parseRepositoryUrl(input: string) {
  const invalid = () => new RepositoryError("invalid_url", "Enter a public GitHub repository URL, such as https://github.com/owner/repository.");
  if (typeof input !== "string" || !input.trim() || input.length > 2048) throw invalid();
  const trimmed = input.trim();
  const source = /^(?:www\.)?github\.com\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
  if (/[\s\\\u0000-\u001f\u007f]/.test(source)) throw invalid();
  let url: URL;
  let segments: string[];
  try {
    // URL normalizes dot segments. Reject them before that can change the repository.
    if (source.split(/[?#]/)[0].split("/").some(part => [".", ".."].includes(decodeURIComponent(part)))) throw invalid();
    url = new URL(source);
    segments = url.pathname.replace(/\/+$/, "").slice(1).split("/").map(decodeURIComponent);
  } catch { throw invalid(); }
  if (!["https:", "http:"].includes(url.protocol) || !["github.com", "www.github.com"].includes(url.hostname) || url.username || url.password || url.port) throw invalid();
  const [owner, rawRepo, kind] = segments;
  const repo = rawRepo?.replace(/\.git$/i, "");
  const reserved = ["settings", "orgs", "users", "search", "topics", "collections", "marketplace", "features", "login", "signup", "notifications", "new", "explore", "sponsors", "apps", "codespaces", "dashboard", "pulls", "issues"];
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner ?? "") || owner.includes("--") || reserved.includes(owner.toLowerCase()) || !/^[\w.-]{1,100}$/.test(repo ?? "") || repo === "." || repo === "..") throw invalid();
  if (segments.some(part => !part || /[\u0000-\u001f\u007f]/.test(part))) throw invalid();
  if (segments.length > 2 && !((kind === "tree" && segments.length >= 4) || (kind === "blob" && segments.length >= 5))) throw invalid();
  return { owner, repo, url: `https://github.com/${owner}/${repo}`, key: `${owner}/${repo}`.toLowerCase() };
}
