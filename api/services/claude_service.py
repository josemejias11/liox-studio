import os
import json
import asyncio
from typing import Optional

API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

ASSET_SCOPE = (
    "You are a sales training assistant for the motorola edge 70 max. "
    "You may ONLY answer questions about this device's specifications, features, and capabilities "
    "as described in the course material. "
    "If the question is unrelated to this device, politely redirect: "
    "'I can only help with questions about the motorola edge 70 max specs and features.'"
)

# ── Mock responses used when no API key is available ─────────────────────────
MOCK_RESPONSES = {
    # Feature explanations (triggered by topic on hotspot open)
    "snapdragon": "The Snapdragon® 8 Gen 5 is the most powerful chip Motorola has ever put in an edge device. It delivers flagship-level CPU and GPU performance, meaning apps open instantly, gaming is buttery smooth, and multitasking never slows down. For customers who demand speed, this is your headline feature.",
    "quad hd": "The Quad HD+ display on the edge 70 max delivers over 4 million pixels — that's four times the resolution of standard HD. Text is razor-sharp, photos look true-to-life, and video content is cinema-grade. It's the kind of screen customers notice immediately when they pick up the phone.",
    "magnetically charged": "The edge 70 max supports 25W magnetic wireless charging (Qi2) plus 90W TurboPower wired charging. That means 50% battery in under 15 minutes wired, and a truly cable-free desk experience with compatible wireless pads. Battery anxiety is officially off the table.",
    "moment with ai": "Motorola Qira, the on-device AI assistant, handles real-time translation, smart replies, content summaries, and more — all without sending data to the cloud. It's AI that actually speeds up your day rather than getting in the way, and it works even offline.",
    "glass design": "The edge 70 max uses aircraft-grade aluminum rails and a back panel designed in collaboration with Pantone™ color experts. The result is a phone that feels premium in-hand, survives real-world drops (MIL-STD-810H certified), and looks like nothing else on the shelf.",
    "highest standards": "With IP68 water resistance, MIL-STD-810H drop certification, and Corning® Gorilla® Glass 7i on the display, the edge 70 max is genuinely built for life — not just lab tests. It's the phone you confidently hand to a customer who works outdoors or travels constantly.",
    "pro-quality": "The 50MP main sensor with Optical Image Stabilization captures professional-quality shots in any light. Pair that with an 8MP ultrawide, 2-in-1 macro/depth lens, and Motorola's AI photography modes, and you have a camera system that rivals phones twice the price.",

    # Common follow-up Q&A
    "battery": "The edge 70 max has a 5,000 mAh battery with 90W TurboPower wired charging — 0 to 50% in under 15 minutes. It also supports 25W Qi2 magnetic wireless charging and 5W reverse wireless charging. All-day battery is a key selling point.",
    "how long": "With the 5,000 mAh battery, most customers get 30+ hours of mixed use. With 90W TurboPower charging, a full charge takes about 45 minutes. Magnetic wireless charging tops it up to 50% in roughly 1.5 hours.",
    "price": "Pricing varies by region and carrier, but the edge 70 max is positioned as a premium mid-range device — roughly the $600–$700 USD range at launch. It competes directly with the Galaxy A55 and Pixel 8a while offering flagship-tier specs.",
    "cost": "Pricing varies by region and carrier, but the edge 70 max is positioned as a premium mid-range device — roughly the $600–$700 USD range at launch. It competes directly with the Galaxy A55 and Pixel 8a while offering flagship-tier specs.",
    "waterproof": "Yes — the edge 70 max is IP68 rated, meaning it can withstand submersion in up to 1.5 meters of fresh water for 30 minutes. Pair that with the MIL-STD-810H drop certification and it's one of the most durable phones in its class.",
    "water": "Yes — the edge 70 max is IP68 rated, meaning it can withstand submersion in up to 1.5 meters of fresh water for 30 minutes. Pair that with the MIL-STD-810H drop certification and it's one of the most durable phones in its class.",
    "ip68": "IP68 means the edge 70 max is protected against dust (6) and can be submerged in up to 1.5m of fresh water for 30 minutes (8). This is the same rating as many flagship phones at twice the price — a strong reassurance message for active customers.",
    "storage": "The edge 70 max comes in 256GB and 512GB storage configurations with 12GB RAM standard. There's no microSD slot, so customers who need maximum storage should go straight for the 512GB model.",
    "ram": "The edge 70 max comes with 12GB LPDDR5 RAM as standard across all configurations. Combined with the Snapdragon 8 Gen 5, it handles true multitasking — 20+ apps in memory without a reload.",
    "color": "The edge 70 max launches in three Pantone™ validated colors: Midnight Eclipse (deep charcoal), Lunar Glow (platinum silver), and Misted Sage (soft green). The Pantone partnership is a great conversation starter about premium design.",
    "weight": "The edge 70 max weighs 196g and measures 161.7 × 73.9 × 8.3mm — slim and well-balanced for a 6.7-inch phone. The aluminum frame gives it a premium feel without the bulk of older flagships.",
    "size": "The edge 70 max has a 6.7-inch Quad HD+ pOLED display with a 165Hz refresh rate. The phone measures 161.7 × 73.9 × 8.3mm and weighs 196g. It's a large screen experience in a surprisingly hand-friendly body.",
    "screen": "The 6.7-inch Quad HD+ pOLED panel runs at 165Hz with peak brightness of 2,500 nits — easily readable in direct sunlight. The 1ms response time makes it one of the best gaming displays in its price bracket.",
    "display": "The 6.7-inch Quad HD+ pOLED panel runs at 165Hz with peak brightness of 2,500 nits — easily readable in direct sunlight. The 1ms response time makes it one of the best gaming displays in its price bracket.",
    "refresh": "The display runs at 165Hz adaptive refresh — it intelligently drops to 1Hz for static content to save battery, and jumps to 165Hz for gaming or scrolling. Customers upgrading from 60Hz phones will notice the difference immediately.",
    "camera": "The triple camera system leads with a 50MP main sensor (OIS), an 8MP ultrawide, and a 2-in-1 macro/depth lens. Video shoots up to 8K at 30fps. The AI photo modes handle low-light automatically — no manual tweaking needed.",
    "5g": "Yes, the edge 70 max supports Sub-6GHz and mmWave 5G depending on the market variant. It also includes Wi-Fi 7 and Bluetooth 5.4 — future-proofed connectivity across the board.",
    "wifi": "The edge 70 max supports Wi-Fi 7 (802.11be) for multi-gigabit speeds on compatible routers, plus Wi-Fi 6E for backward compatibility. This is a differentiator for customers who use their phone as a hotspot.",
    "android": "The edge 70 max ships with Android 15 and Motorola's clean My UX overlay. Motorola has committed to 3 OS upgrades and 4 years of security patches — a strong long-term value message versus competitors.",
    "update": "Motorola has committed to 3 major Android OS upgrades and 4 years of security patches for the edge 70 max. That means customers who buy today are covered through Android 18.",

    "default": "Great question! The motorola edge 70 max is packed with flagship-level specs. Could you be more specific about which feature you'd like to know more about? I can cover the display, camera, battery, performance, design, or connectivity.",
}


def _get_mock_response(query: str) -> str:
    q = query.lower()
    for keyword, response in MOCK_RESPONSES.items():
        if keyword in q:
            return response
    return MOCK_RESPONSES["default"]


async def stream_tutor_response(query: str, context: str, context_hint: Optional[str] = None):
    """Streams an AI tutor response. Falls back to mock data if no API key is set."""
    if not API_KEY:
        response = _get_mock_response(query)
        for word in response.split(" "):
            yield f"data: {json.dumps({'text': word + ' '})}\n\n"
            await asyncio.sleep(0.03)
        yield "data: [DONE]\n\n"
        return

    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=API_KEY)

    system_prompt = ASSET_SCOPE if context_hint else (
        "You are a helpful and knowledgeable AI tutor. "
        "Use the provided lesson content context to answer the student's question accurately. "
        "If the answer is not contained within the context, politely let the student know."
    )

    hint_prefix = f"[Feature context: {context_hint}]\n\n" if context_hint else ""
    prompt = f"{hint_prefix}Context:\n{context}\n\nQuestion: {query}"

    try:
        async with client.messages.stream(
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
            model="claude-3-5-sonnet-20241022",
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


async def generate_quiz(context: str, num_questions: int = 3) -> dict:
    """Generates a multiple choice quiz. Returns a stub if no API key is set."""
    if not API_KEY:
        return {
            "title": "Feature Knowledge Check",
            "questions": [
                {
                    "question": "Which processor powers the motorola edge 70 max?",
                    "options": ["Snapdragon 7s Gen 2", "Snapdragon 8 Gen 5", "Dimensity 9300", "Exynos 2400"],
                    "correct_answer": "Snapdragon 8 Gen 5",
                    "explanation": "The edge 70 max is powered by the Snapdragon® 8 Gen 5, Motorola's most powerful chip to date.",
                }
            ],
        }

    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=API_KEY)

    system_prompt = "You are an expert curriculum designer. Output strictly raw JSON."
    prompt = (
        f"Based on the following context, generate a {num_questions}-question multiple choice quiz.\n"
        f"Context:\n{context}\n\n"
        "Return ONLY a JSON object with this exact structure:\n"
        '{"title": "Quiz Title", "questions": [{"question": "...", "options": ["A","B","C","D"], "correct_answer": "...", "explanation": "..."}]}'
    )

    response = await client.messages.create(
        max_tokens=1500,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
        model="claude-3-5-sonnet-20241022",
        temperature=0.2,
    )

    try:
        raw = response.content[0].text
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        return json.loads(raw)
    except Exception as e:
        return {"error": f"Failed to parse quiz response: {str(e)}"}
