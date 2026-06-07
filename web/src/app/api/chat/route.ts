import { NextRequest } from "next/server";

const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY ?? "";

import { z } from "zod";

const ChatRequestSchema = z.object({
  query: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).optional(),
  context_hint: z.boolean().optional(),
  lesson_content: z.string().optional(),
  course_title: z.string().optional(),
  course_description: z.string().optional(),
});

type ChatRequestBody = z.infer<typeof ChatRequestSchema>;

function buildSystemPrompt(
  course_title: string | undefined,
  course_description: string | undefined,
  lesson_content: string | undefined
): string {
  const title = course_title?.trim() || "this course";

  let prompt =
    `You are a learning assistant for the course: ${title}.\n\n` +
    `Your role is strictly limited to answering questions that are directly related to the content of this course. ` +
    `You must NOT discuss other products, other courses, current events, or any general knowledge that falls outside the scope of this course.\n\n` +
    `If a user asks a question that is off-topic or unrelated to the course or the provided lesson content, ` +
    `you must respond with this exact message: ` +
    `"I can only help with questions about ${title}. Please ask me something related to the course content!"\n\n` +
    `Base all of your answers exclusively on the lesson content provided below. ` +
    `Do not draw on outside knowledge beyond what is described in this course.`;

  if (course_description?.trim()) {
    prompt += `\n\nCourse overview: ${course_description.trim()}`;
  }

  if (lesson_content?.trim()) {
    prompt +=
      `\n\nOfficial lesson content for this section (use as your primary reference):\n"""\n${lesson_content.trim()}\n"""`;
  }

  return prompt;
}

// ── Mock responses for development without an API key ─────────────────────────
const MOCK_RESPONSES: Record<string, string> = {
  snapdragon: "The Snapdragon® 8 Gen 5 is the most powerful chip Motorola has ever put in an edge device. It delivers flagship-level CPU and GPU performance, meaning apps open instantly, gaming is buttery smooth, and multitasking never slows down. For customers who demand speed, this is your headline feature.",
  "quad hd": "The Quad HD+ display on the edge 70 max delivers over 4 million pixels — that's four times the resolution of standard HD. Text is razor-sharp, photos look true-to-life, and video content is cinema-grade.",
  "magnetically charged": "The edge 70 max supports 25W magnetic wireless charging (Qi2) plus 90W TurboPower wired charging. 50% battery in under 15 minutes wired, and a truly cable-free desk experience.",
  "moment with ai": "Motorola Qira, the on-device AI assistant, handles real-time translation, smart replies, content summaries, and more — all without sending data to the cloud.",
  "glass design": "Aircraft-grade aluminum rails and a Pantone™ validated back panel — premium in-hand feel with MIL-STD-810H drop certification.",
  "highest standards": "IP68 water resistance, MIL-STD-810H drop certification, and Corning® Gorilla® Glass 7i. Built for life, not just lab tests.",
  "pro-quality": "50MP main sensor with OIS, 8MP ultrawide, macro/depth lens. 8K video. Rivals phones twice the price.",
  battery: "5,000 mAh battery. 90W TurboPower wired (0→50% in 15 min). 25W Qi2 magnetic wireless. 5W reverse wireless charging.",
  "how long": "30+ hours of mixed use. Full charge in ~45 minutes wired, ~1.5 hours wireless.",
  price: "Positioned at $600–$700 USD at launch — premium mid-range competing with Galaxy A55 and Pixel 8a.",
  cost: "Positioned at $600–$700 USD at launch — premium mid-range competing with Galaxy A55 and Pixel 8a.",
  waterproof: "IP68 rated — up to 1.5 meters of fresh water for 30 minutes. Paired with MIL-STD-810H drop cert.",
  water: "IP68 rated — up to 1.5 meters of fresh water for 30 minutes.",
  ip68: "IP68: dust-tight (6) + submersible to 1.5m for 30 minutes (8). Same rating as many flagships at twice the price.",
  storage: "256GB and 512GB variants, 12GB LPDDR5 RAM standard. No microSD slot.",
  ram: "12GB LPDDR5 RAM standard. Handles 20+ apps in memory without reload.",
  color: "Three Pantone™ validated colors: Midnight Eclipse, Lunar Glow, and Misted Sage.",
  weight: "196g, 161.7 × 73.9 × 8.3mm. Slim and balanced for a 6.7-inch phone.",
  size: "6.7-inch Quad HD+ pOLED, 165Hz. Measures 161.7 × 73.9 × 8.3mm, weighs 196g.",
  screen: "6.7-inch Quad HD+ pOLED, 165Hz, 2,500 nits peak, 1ms response. One of the best gaming displays in its bracket.",
  display: "6.7-inch Quad HD+ pOLED, 165Hz, 2,500 nits peak brightness, 1ms response.",
  refresh: "165Hz adaptive — drops to 1Hz for static content to save battery, jumps to 165Hz for gaming/scrolling.",
  camera: "50MP main (OIS) + 8MP ultrawide + macro/depth. 8K video, AI photo modes for low-light.",
  "5g": "Sub-6GHz and mmWave 5G (market dependent) + Wi-Fi 7 + Bluetooth 5.4.",
  wifi: "Wi-Fi 7 (802.11be) — multi-gigabit on compatible routers, backward-compatible with Wi-Fi 6E.",
  android: "Ships with Android 15. 3 major OS upgrades + 4 years of security patches committed.",
  update: "3 major Android OS upgrades and 4 years of security patches — covered through Android 18.",
  default: "Great question! I can cover the display, camera, battery, performance, design, or connectivity of the motorola edge 70 max. What would you like to know more about?",
};

function getMockResponse(query: string): string {
  const q = query.toLowerCase();
  for (const [keyword, response] of Object.entries(MOCK_RESPONSES)) {
    if (q.includes(keyword)) return response;
  }
  return MOCK_RESPONSES.default;
}

function mockStream(text: string): ReadableStream {
  const words = text.split(" ");
  return new ReadableStream({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
        await new Promise((r) => setTimeout(r, 30));
      }
      controller.enqueue("data: [DONE]\n\n");
      controller.close();
    },
  });
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    const json = await req.json();
    body = ChatRequestSchema.parse(json);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Invalid request payload", details: err.errors }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { query, messages: msgHistory, lesson_content, course_title, course_description } = body;

  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  // Derive the last user query for mock-mode keyword matching
  const lastQuery: string =
    msgHistory?.findLast((m) => m.role === "user")?.content ?? query ?? "";

  // Mock mode — no API key needed
  if (!API_KEY) {
    return new Response(mockStream(getMockResponse(lastQuery)), { headers });
  }

  // Real mode — stream from Gemini
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: buildSystemPrompt(course_title, course_description, lesson_content),
  });

  // Google uses "model" for assistant role, "user" for user role
  const history = (msgHistory ?? []).slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = msgHistory?.at(-1)?.content ?? query ?? "";

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
        controller.enqueue("data: [DONE]\n\n");
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error occurred";
        controller.enqueue(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
