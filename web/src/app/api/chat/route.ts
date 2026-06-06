import { NextRequest } from "next/server";

const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const ASSET_SCOPE =
  "You are a sales training assistant for the motorola edge 70 max. " +
  "You may ONLY answer questions about this device's specifications, features, and capabilities " +
  "as described in the course material. " +
  "If the question is unrelated to this device, politely redirect: " +
  "'I can only help with questions about the motorola edge 70 max specs and features.'";

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
  const { query, context_hint } = await req.json();

  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  // Mock mode — no API key needed
  if (!API_KEY) {
    return new Response(mockStream(getMockResponse(query)), { headers });
  }

  // Real mode — stream from Claude
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: API_KEY });

  const systemPrompt = context_hint ? ASSET_SCOPE : "You are a helpful AI tutor. Answer based on the course content provided.";
  const userContent = context_hint
    ? `[Feature context: ${context_hint}]\n\nQuestion: ${query}`
    : `Question: ${query}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
          }
        }
        controller.enqueue("data: [DONE]\n\n");
      } catch (e: any) {
        controller.enqueue(`data: ${JSON.stringify({ error: e.message })}\n\n`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers });
}
