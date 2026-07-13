import { NextResponse } from 'next/server';
import { z } from 'zod';

interface ReadJsonOptions {
  invalidJsonMessage?: string;
  invalidPayloadMessage?: string;
}

type ReadJsonResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status },
  );
}

export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  {
    invalidJsonMessage = 'Invalid JSON body',
    invalidPayloadMessage = 'Invalid request payload',
  }: ReadJsonOptions = {},
): Promise<ReadJsonResult<T>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return { success: false, response: jsonError(invalidJsonMessage, 400) };
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      response: jsonError(invalidPayloadMessage, 400, parsed.error.issues),
    };
  }

  return { success: true, data: parsed.data };
}

export function unexpectedApiError(scope: string, error: unknown) {
  console.error(`[${scope}] unexpected error:`, error);
  return jsonError('Internal server error', 500);
}
