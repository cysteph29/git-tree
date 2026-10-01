import { loadRepository } from "../../../lib/github.server";
import { RepositoryError } from "../../../lib/repository-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;

export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  try {
    return Response.json(await loadRepository(new URL(request.url).searchParams.get("url") ?? ""), { headers });
  } catch (error) {
    const problem = error instanceof RepositoryError ? error : new RepositoryError("internal", "The repository couldn’t be loaded. Please try again.", 500);
    if (problem.retryAt) headers.set("Retry-After", String(Math.max(1, Math.ceil((Date.parse(problem.retryAt) - Date.now()) / 1000))));
    return Response.json({ error: { code: problem.code, message: problem.message, retryAt: problem.retryAt } }, { status: problem.status, headers });
  }
}
