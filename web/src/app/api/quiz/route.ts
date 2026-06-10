import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY ?? "";

import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ServerAiQuizSchema,
  type ClientQuiz,
  type ServerAiQuiz,
} from "@/lib/contracts/quiz";
import { RateLimiter } from "@/lib/rate-limit";

// 5 requests per minute
const limiter = new RateLimiter(5, 60 * 1000);


const QuizRequestSchema = z.object({
  context: z.string().max(5000).optional(),
  num_questions: z.number().int().min(1).max(20).optional().default(5),
});

type QuizRequestBody = z.infer<typeof QuizRequestSchema>;

const MOCK_QUIZ: ServerAiQuiz = {
  title: "motorola edge 70 max — Knowledge Check",
  questions: [
    {
      question: "Which processor powers the motorola edge 70 max?",
      options: ["Snapdragon 7s Gen 2", "Snapdragon 8 Gen 5", "Dimensity 9300", "Exynos 2400"],
      correct_answer: "Snapdragon 8 Gen 5",
      explanation: "The edge 70 max is powered by the Snapdragon® 8 Gen 5 — Motorola's most powerful chip to date.",
    },
    {
      question: "What is the IP rating of the motorola edge 70 max?",
      options: ["IP54", "IP67", "IP68", "IP69K"],
      correct_answer: "IP68",
      explanation: "IP68 means the device can withstand submersion in up to 1.5 meters of fresh water for 30 minutes.",
    },
    {
      question: "What is the peak charging speed over a wired connection?",
      options: ["45W", "65W", "90W", "120W"],
      correct_answer: "90W",
      explanation: "The edge 70 max supports 90W TurboPower wired charging — reaching 50% in under 15 minutes.",
    },
    {
      question: "How many years of security patches has Motorola committed to?",
      options: ["2 years", "3 years", "4 years", "5 years"],
      correct_answer: "4 years",
      explanation: "Motorola committed to 3 major OS upgrades and 4 years of security patches for the edge 70 max.",
    },
    {
      question: "What is the main camera resolution on the edge 70 max?",
      options: ["12MP", "32MP", "50MP", "108MP"],
      correct_answer: "50MP",
      explanation: "The triple camera system leads with a 50MP main sensor with Optical Image Stabilization.",
    },
  ],
};

/**
 * Persist the full quiz (answer key included) server-side and return only the
 * client-safe projection — the browser never sees `correct_answer` /
 * `explanation`. Grading happens in /api/quiz/grade against the stored record.
 */
async function persistAndStrip(quiz: ServerAiQuiz): Promise<ClientQuiz> {
  // Cleanup old generated quizzes (older than 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.generatedQuiz.deleteMany({
    where: { createdAt: { lt: sevenDaysAgo } },
  }).catch(err => console.error("Failed to cleanup old quizzes", err));

  const record = await prisma.generatedQuiz.create({
    data: { payload: JSON.stringify(quiz) },
  });
  return {
    quizId: record.id,
    source: "ai",
    title: quiz.title,
    ...(quiz.instructions !== undefined ? { instructions: quiz.instructions } : {}),
    questions: quiz.questions.map((q) => ({
      question: q.question,
      options: q.options,
      ...(q.image_url !== undefined ? { image_url: q.image_url } : {}),
    })),
  };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!limiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: QuizRequestBody;
  try {
    const json = await req.json();
    body = QuizRequestSchema.parse(json);
  } catch (err: unknown) {
    const details = err instanceof z.ZodError ? err.issues : undefined;
    return NextResponse.json({ error: "Invalid request payload", details }, { status: 400 });
  }

  const { context, num_questions } = body;

  if (!API_KEY) {
    try {
      return NextResponse.json(await persistAndStrip(MOCK_QUIZ));
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: "You are an expert curriculum designer. Output strictly raw JSON, no markdown, no code fences.",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt =
    `Based on the following course content, generate a ${num_questions}-question multiple-choice quiz.\n` +
    `Context:\n${context ?? "course content"}\n\n` +
    `Return a JSON object with this exact shape:\n` +
    `{"title":"...","questions":[{"question":"...","options":["A","B","C","D"],"correct_answer":"...","explanation":"..."}]}`;

  try {
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini response timed out after 30s")), 30_000)
      ),
    ]);
    const raw = result.response.text();

    // Strip any accidental markdown fences
    const cleaned = raw.includes("```json")
      ? raw.split("```json")[1].split("```")[0].trim()
      : raw.includes("```")
        ? raw.split("```")[1].split("```")[0].trim()
        : raw.trim();

    const validated = ServerAiQuizSchema.safeParse(JSON.parse(cleaned));
    if (!validated.success) {
      return NextResponse.json({ error: "Quiz generation failed" }, { status: 502 });
    }
    return NextResponse.json(await persistAndStrip(validated.data));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
