import { z } from 'zod';

function getServiceConfig() {
  const url = (process.env.PARSER_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
  const token = process.env.PARSER_SERVICE_TOKEN ?? '';
  return { url, token };
}

export class RagServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RagServiceError';
  }
}

interface ParserRequestOptions {
  json?: unknown;
  body?: BodyInit;
  timeoutMs?: number;
}

async function parserRequest(
  method: 'POST' | 'DELETE',
  path: string,
  { json, body, timeoutMs = 30_000 }: ParserRequestOptions,
  contextName: string,
  userSafeMessage: string,
): Promise<unknown> {
  const { url, token } = getServiceConfig();
  const headers: Record<string, string> = { 'X-Internal-Token': token };
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : body,
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'network error';
    console.error(`[${contextName}] parser service unreachable:`, reason);
    throw new RagServiceError(userSafeMessage);
  }

  if (!res.ok) {
    console.error(`[${contextName}] parser service responded ${res.status}`);
    throw new RagServiceError(userSafeMessage, res.status);
  }

  try {
    return await res.json();
  } catch {
    console.error(`[${contextName}] parser service returned a non-JSON response`);
    throw new RagServiceError(userSafeMessage);
  }
}

const ParserChatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
});

const ParserQuizResponseSchema = z.object({
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

const ParserUploadResponseSchema = z.object({
  status: z.string(),
  source_id: z.string(),
  filename: z.string(),
  chunks_stored: z.number().int().min(0),
});

const ParserDeleteResponseSchema = z.object({
  status: z.string(),
  source_id: z.string(),
});

const ParserCourseGenerationResponseSchema = z.object({
  graph: z.unknown(),
  model_identifier: z.string().min(1),
  prompt_template_version: z.string().min(1),
});

export interface RagChatResponse {
  answer: string;
  sources: string[];
}

export interface RagQuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface RagQuizResponse {
  questions: RagQuizQuestion[];
}

export interface RagUploadResponse {
  status: string;
  sourceId: string;
  filename: string;
  chunksStored: number;
}

export interface RagDeleteResponse {
  status: string;
  sourceId: string;
}

export interface RagCourseGenerationResponse {
  graph: unknown;
  modelIdentifier: string;
  promptTemplateVersion: string;
}

export async function askCourseQuestion(
  courseId: string,
  sourceIds: string[],
  query: string,
): Promise<RagChatResponse> {
  const userSafe = 'The AI assistant is temporarily unavailable. Please try again in a moment.';
  const raw = await parserRequest(
    'POST',
    '/api/chat',
    { json: { course_id: courseId, source_ids: sourceIds, query }, timeoutMs: 60_000 },
    'api/chat',
    userSafe,
  );

  const parsed = ParserChatResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[api/chat] parser response failed validation:', parsed.error.issues);
    throw new RagServiceError(userSafe);
  }

  return parsed.data;
}

export async function generateCourseQuiz(
  courseId: string,
  sourceIds: string[],
  weakTopics: string[],
): Promise<RagQuizResponse> {
  const userSafe = 'Quiz generation is temporarily unavailable. Please try again in a moment.';
  const raw = await parserRequest(
    'POST',
    '/api/generate-quiz',
    {
      json: { course_id: courseId, source_ids: sourceIds, weak_topics: weakTopics },
      timeoutMs: 120_000,
    },
    'api/quiz',
    userSafe,
  );

  const parsed = ParserQuizResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[api/quiz] parser response failed validation:', parsed.error.issues);
    throw new RagServiceError(userSafe);
  }

  return {
    questions: parsed.data.questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctAnswerIndex: q.correct_answer_index,
    })),
  };
}

export async function generateCourseDraft(
  courseId: string,
  sourceIds: string[],
  brief: string,
  promptTemplateVersion: string,
): Promise<RagCourseGenerationResponse> {
  const userSafe = 'Course generation is temporarily unavailable. Please try again in a moment.';
  const raw = await parserRequest(
    'POST',
    '/api/generate-course',
    {
      json: {
        course_id: courseId,
        source_ids: sourceIds,
        brief,
        prompt_template_version: promptTemplateVersion,
      },
      timeoutMs: 180_000,
    },
    'api/generate-course',
    userSafe,
  );
  const parsed = ParserCourseGenerationResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[api/generate-course] parser response failed validation:', parsed.error.issues);
    throw new RagServiceError(userSafe);
  }
  return {
    graph: parsed.data.graph,
    modelIdentifier: parsed.data.model_identifier,
    promptTemplateVersion: parsed.data.prompt_template_version,
  };
}

export async function uploadCourseDocument(
  courseId: string,
  sourceId: string,
  sha256: string,
  file: File,
): Promise<RagUploadResponse> {
  const userSafe = 'The upload service is temporarily unavailable. Please try again in a moment.';
  const formData = new FormData();
  formData.append('course_id', courseId);
  formData.append('source_id', sourceId);
  formData.append('sha256', sha256);
  formData.append('file', file, file.name);

  const raw = await parserRequest(
    'POST',
    '/api/upload',
    { body: formData, timeoutMs: 120_000 },
    'api/upload POST',
    userSafe,
  );

  const parsed = ParserUploadResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[api/upload POST] parser response failed validation:', parsed.error.issues);
    throw new RagServiceError(userSafe);
  }

  return {
    status: parsed.data.status,
    sourceId: parsed.data.source_id,
    filename: parsed.data.filename,
    chunksStored: parsed.data.chunks_stored,
  };
}

export async function deleteCourseDocument(
  courseId: string,
  sourceId: string,
): Promise<RagDeleteResponse> {
  const userSafe = 'The upload service is temporarily unavailable. Please try again in a moment.';
  const raw = await parserRequest(
    'DELETE',
    '/api/document',
    { json: { course_id: courseId, source_id: sourceId } },
    'api/upload DELETE',
    userSafe,
  );

  const parsed = ParserDeleteResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[api/upload DELETE] parser response failed validation:', parsed.error.issues);
    throw new RagServiceError(userSafe);
  }

  return { status: parsed.data.status, sourceId: parsed.data.source_id };
}
