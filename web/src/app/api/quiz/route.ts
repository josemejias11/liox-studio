import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

interface QuizRequestBody {
  context?: string;
  num_questions?: number;
}

const MOCK_QUIZ = {
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

export async function POST(req: NextRequest) {
  const { context, num_questions = 5 } = (await req.json()) as QuizRequestBody;

  if (!API_KEY) {
    return NextResponse.json(MOCK_QUIZ);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: API_KEY });

  const prompt =
    `Based on the following course content, generate a ${num_questions}-question multiple-choice quiz.\n` +
    `Context:\n${context ?? "motorola edge 70 max product features"}\n\n` +
    "Return ONLY a JSON object:\n" +
    '{"title":"...","questions":[{"question":"...","options":["A","B","C","D"],"correct_answer":"...","explanation":"..."}]}';

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      system: "You are an expert curriculum designer. Output strictly raw JSON, no markdown.",
      messages: [{ role: "user", content: prompt }],
    });

    const firstContentBlock = message.content[0];
    if (firstContentBlock?.type !== "text") {
      throw new Error("Unexpected response format from Anthropic");
    }

    const raw = firstContentBlock.text;
    const cleaned = raw.includes("```json")
      ? raw.split("```json")[1].split("```")[0].trim()
      : raw.includes("```")
        ? raw.split("```")[1].split("```")[0].trim()
        : raw;

    return NextResponse.json(JSON.parse(cleaned));
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
