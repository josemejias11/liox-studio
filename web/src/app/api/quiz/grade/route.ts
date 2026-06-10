import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readClient } from "@/sanity/lib/client";
import { QUIZ_GRADING_QUERY } from "@/sanity/lib/queries";
import {
  QuizGradeRequestSchema,
  ServerAiQuizSchema,
  type QuizSource,
} from "@/lib/contracts/quiz";
import {
  DEFAULT_PASSING_SCORE,
  gradeQuestion,
  gradeSubmission,
  type GradableQuestion,
} from "@/lib/quiz-grading";

class CmsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CmsConfigurationError";
  }
}

// ── Server-side answer key — never serialized to the browser ─────────────────

/** Shape of QUIZ_GRADING_QUERY (GROQ returns null for missing fields). */
const sanityGradingSchema = z.object({
  questions: z
    .array(
      z.object({
        answers: z
          .array(
            z.object({
              text: z.string().catch(""),
              isCorrect: z.boolean().catch(false),
              feedback: z
                .string()
                .nullish()
                .transform((v) => v ?? undefined),
            })
          )
          .catch([]),
        explanation: z
          .string()
          .nullish()
          .transform((v) => v ?? undefined),
      })
    )
    .catch([]),
  passingScore: z
    .number()
    .nullish()
    .transform((v) => v ?? undefined),
});

interface AnswerKey {
  questions: GradableQuestion[];
  passingScore: number;
}

async function loadAnswerKey(
  source: QuizSource,
  quizId: string
): Promise<AnswerKey | null> {
  if (source === "ai") {
    const record = await prisma.generatedQuiz.findUnique({ where: { id: quizId } });
    if (!record) return null;

    let payload: unknown;
    try {
      payload = JSON.parse(record.payload);
    } catch {
      return null;
    }
    const parsed = ServerAiQuizSchema.safeParse(payload);
    if (!parsed.success) return null;

    return {
      questions: parsed.data.questions.map((q) => ({
        options: q.options,
        correctIndex: q.options.indexOf(q.correct_answer),
        explanation: q.explanation,
      })),
      passingScore: DEFAULT_PASSING_SCORE,
    };
  }

  // source === "sanity" — re-derive the answer key from the CMS document.
  const raw = await readClient.fetch<unknown>(QUIZ_GRADING_QUERY, { id: quizId });
  if (!raw) return null;
  const parsed = sanityGradingSchema.safeParse(raw);
  if (!parsed.success || parsed.data.questions.length === 0) return null;

  return {
    questions: parsed.data.questions.map((q, index) => {
      const correctIndex = q.answers.findIndex((a) => a.isCorrect);
      if (correctIndex === -1) {
        throw new CmsConfigurationError(
          `CMS Quiz misconfigured: Question ${index + 1} has no correct answer marked.`
        );
      }
      return {
        options: q.answers.map((a) => a.text),
        correctIndex,
        explanation: q.explanation ?? q.answers[correctIndex]?.feedback ?? "",
      };
    }),
    passingScore: parsed.data.passingScore ?? DEFAULT_PASSING_SCORE,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = QuizGradeRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const body = parsed.data;

  try {
    const key = await loadAnswerKey(body.source, body.quizId);
    if (!key) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    if (body.action === "question") {
      const question = key.questions[body.questionIndex];
      if (!question || body.selectedIndex >= question.options.length) {
        return NextResponse.json({ error: "Question or answer out of range" }, { status: 400 });
      }
      return NextResponse.json(gradeQuestion(question, body.selectedIndex));
    }

    // action === "submit"
    if (body.answers.length !== key.questions.length) {
      return NextResponse.json(
        { error: "Answer count does not match question count" },
        { status: 400 }
      );
    }

    const result = gradeSubmission(key.questions, body.answers, key.passingScore);

    // Record the attempt server-side — `passed` is server-derived, never
    // client-supplied. sessionId/courseId are absent when consent was declined;
    // in that case nothing is persisted.
    if (body.sessionId && body.courseId) {
      const { sessionId, courseId } = body;
      await prisma.$transaction(async (tx) => {
        await tx.session.upsert({
          where: { id: sessionId },
          update: { updatedAt: new Date() },
          create: { id: sessionId },
        });
        await tx.quizAttempt.upsert({
          where: { sessionId_quizId: { sessionId, quizId: body.quizId } },
          update: {
            score: result.score,
            total: result.total,
            passed: result.passed,
            answers: JSON.stringify(
              body.answers.map((selectedIndex, questionIndex) => ({
                questionIndex,
                selectedIndex,
                correct: result.results[questionIndex]?.correct ?? false,
              }))
            ),
          },
          create: {
            sessionId,
            quizId: body.quizId,
            courseId,
            score: result.score,
            total: result.total,
            passed: result.passed,
            answers: JSON.stringify(
              body.answers.map((selectedIndex, questionIndex) => ({
                questionIndex,
                selectedIndex,
                correct: result.results[questionIndex]?.correct ?? false,
              }))
            ),
          },
        });
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CmsConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

