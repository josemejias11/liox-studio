import { NextRequest, NextResponse } from 'next/server';
import { GenerateQuizRequestSchema } from '@/lib/contracts/quiz';
import { enqueueQuizGenerationJob } from '@/lib/jobs/queue';
import { readJson, unexpectedApiError } from '@/lib/server/http';

// Creates a durable AI quiz job. The worker persists the full answer key and
// exposes only the existing client-safe quiz projection through job status.

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, GenerateQuizRequestSchema, {
    invalidJsonMessage: 'Invalid request payload',
  });
  if (!parsed.success) return parsed.response;

  try {
    const result = await enqueueQuizGenerationJob({
      courseId: parsed.data.courseId,
      weakTopics: parsed.data.weakTopics ?? [],
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err: unknown) {
    return unexpectedApiError('api/quiz', err);
  }
}
