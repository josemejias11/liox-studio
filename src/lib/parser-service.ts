// ── Server-to-server client for the self-hosted FastAPI parser/RAG service ───
// SERVER-ONLY. The parser service (local Ollama in dev, self-hosted in prod) is
// never called from the browser: all traffic proxies through the Next.js route
// handlers in src/app/api/{chat,quiz,upload}. Every request carries the shared-
// secret `X-Internal-Token` header. Env vars are intentionally NOT NEXT_PUBLIC_*.

import { z } from 'zod';

const PARSER_SERVICE_URL = (process.env.PARSER_SERVICE_URL ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
);
const PARSER_SERVICE_TOKEN = process.env.PARSER_SERVICE_TOKEN ?? '';

/** Raised when the parser service is unreachable, times out, or responds non-2xx. */
export class ParserServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ParserServiceError';
  }
}

interface ParserRequestOptions {
  /** JSON body — mutually exclusive with `body`. */
  json?: unknown;
  /** Raw body (e.g. FormData for uploads). */
  body?: BodyInit;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
}

/**
 * Send an authenticated request to the parser service.
 *
 * Throws `ParserServiceError` on network failure, timeout, or non-2xx status —
 * callers map that to a clean 502 with a user-safe message.
 */
async function parserRequest(
  method: 'POST' | 'DELETE',
  path: string,
  { json, body, timeoutMs = 30_000 }: ParserRequestOptions,
): Promise<unknown> {
  const headers: Record<string, string> = { 'X-Internal-Token': PARSER_SERVICE_TOKEN };
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${PARSER_SERVICE_URL}${path}`, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : body,
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'network error';
    throw new ParserServiceError(`Parser service unreachable: ${reason}`);
  }

  if (!res.ok) {
    throw new ParserServiceError(`Parser service responded ${res.status}`, res.status);
  }

  try {
    return await res.json();
  } catch {
    throw new ParserServiceError('Parser service returned a non-JSON response');
  }
}

/**
 * POST to the parser service with the internal token attached.
 * Throws ParserServiceError on network failure, timeout, or non-2xx status.
 */
export function parserPost(path: string, opts: ParserRequestOptions): Promise<unknown> {
  return parserRequest('POST', path, opts);
}

/**
 * DELETE to the parser service with the internal token attached.
 * Always sends a JSON body. Throws ParserServiceError on failure.
 */
export function parserDelete(
  path: string,
  opts: { json: unknown; timeoutMs?: number },
): Promise<unknown> {
  return parserRequest('DELETE', path, opts);
}

// ── Parser wire contracts (mirror of the FastAPI response models) ─────────────

/** POST {PARSER_SERVICE_URL}/api/chat → */
export const ParserChatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
});

/** POST {PARSER_SERVICE_URL}/api/generate-quiz → (contractually exactly 5 questions) */
export const ParserQuizResponseSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        correct_answer_index: z.number().int().min(0).max(3),
      }),
    )
    .length(5),
});

/** POST {PARSER_SERVICE_URL}/api/upload → */
export const ParserUploadResponseSchema = z.object({
  status: z.string(),
  filename: z.string(),
  chunks_stored: z.number().int().min(0),
});
