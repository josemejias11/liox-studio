import { z } from 'zod';

export const OFFLINE_ASSISTANT_PAYLOAD_VERSION = 'offline-assistant.v1' as const;
export const COURSE_ASSISTANT_FALLBACK =
  "I don't have an answer for that in this course. Please review the course materials.";

export const AssistantCitationSchema = z.object({
  sourceId: z.string().min(1),
  label: z.string().min(1).max(255),
  excerpt: z.string().min(1).max(1000),
});
export const AssistantQaStatusSchema = z.enum(['draft', 'approved']);
export const AssistantQaItemSchema = z.object({
  id: z.string().min(1),
  questionVariants: z.array(z.string().min(1).max(500)).min(1).max(12),
  matchingKeywords: z.array(z.string().min(1).max(100)).max(30),
  approvedAnswer: z.string().min(1).max(4000),
  status: AssistantQaStatusSchema,
  citations: z.array(AssistantCitationSchema).min(1).max(12),
});
export type AssistantQaItem = z.infer<typeof AssistantQaItemSchema>;

export const OfflineAssistantPayloadSchema = z.object({
  version: z.literal(OFFLINE_ASSISTANT_PAYLOAD_VERSION),
  items: z.array(AssistantQaItemSchema.omit({ status: true, citations: true })).max(200),
});
export type OfflineAssistantPayload = z.infer<typeof OfflineAssistantPayloadSchema>;

export function normalizeAssistantQuestion(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

export function matchOfflineAssistant(
  payload: OfflineAssistantPayload | null | undefined,
  question: string,
): { itemId: string | null; answer: string; matched: boolean } {
  const query = new Set(normalizeAssistantQuestion(question));
  if (!payload || query.size === 0)
    return { itemId: null, answer: COURSE_ASSISTANT_FALLBACK, matched: false };
  const ranked = payload.items
    .map((item) => {
      const candidate = new Set([
        ...item.questionVariants.flatMap(normalizeAssistantQuestion),
        ...item.matchingKeywords.flatMap(normalizeAssistantQuestion),
      ]);
      const shared = [...query].filter((word) => candidate.has(word)).length;
      return { item, score: shared / Math.max(query.size, candidate.size, 1), shared };
    })
    .sort((a, b) => b.score - a.score || b.shared - a.shared);
  const best = ranked[0];
  const second = ranked[1];
  if (
    !best ||
    best.shared < 2 ||
    best.score < 0.22 ||
    (second && best.score - second.score < 0.08)
  ) {
    return { itemId: null, answer: COURSE_ASSISTANT_FALLBACK, matched: false };
  }
  return { itemId: best.item.id, answer: best.item.approvedAnswer, matched: true };
}
