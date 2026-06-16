"""Fixed eval corpus and question cases for the RAG chat harness.

The corpus is a self-contained product-training handbook. Each fact-bearing
section plants a unique, checkable fact (a ``gold_marker``) so retrieval and
answer correctness can be measured deterministically without an LLM judge.

The corpus is intentionally large and padded with adjacent, same-domain
"distractor" sections, and several queries are paraphrased away from the source
wording. This creates real retrieval competition so that threshold / k / chunk
size produce measurable differences rather than a saturated 1.00 baseline.

Course ids must satisfy main.COURSE_ID_PATTERN (3-63 chars, alnum at both ends).
"""

from dataclasses import dataclass, field

EVAL_COURSE_ID = "eval-rag-course-01"
# Never ingested — used to exercise the no-materials fallback.
EMPTY_COURSE_ID = "eval-empty-course-01"

CORPUS_SOURCE = "moto-handbook.md"

# Fact-bearing sections (referenced by cases) are interleaved with same-domain
# filler so the gold chunk is not trivially the only candidate above threshold.
CORPUS = """# Motorola 2026 Sales Enablement Handbook

## Program Overview
This handbook prepares sales representatives to position the Motorola 2026
portfolio with confidence. It covers the flagship device, the on-device AI
suite, the security stack, accessories, commercial terms, and the support
experience. Reps should read every section before their certification exam.
The portfolio is organized around three pillars: create, protect, and endure.
Each pillar maps to a set of features that reps must be able to demo live.

## Positioning and Messaging
When positioning the portfolio, lead with outcomes rather than specifications.
Customers care about getting work done faster, keeping their data safe, and a
device that lasts the day. Translate every feature into one of those three
benefits. Avoid jargon and never quote internal roadmap dates to a customer.

## Qira Image Studio
Qira Image Studio is the on-device generative imaging assistant. Sales reps use
it to produce marketing visuals from a short text prompt. Qira can generate
images at a maximum resolution of 4096x4096 pixels. It renders a batch of up to
20 images per request, and every generated image carries an invisible
provenance watermark for compliance review.

## Qira Prompt Tips
Effective prompts for Qira describe subject, style, and lighting in that order.
Reps should keep a library of approved prompt templates for common asset types
such as banners, social tiles, and email headers. Qira respects brand safety
filters and will decline prompts that request competitor logos or trademarked
characters.

## Style Sync
Style Sync keeps brand assets visually consistent. It automatically matches the
approved corporate color palette across slides, social posts, and product
sheets. Style Sync can store up to 12 distinct brand palettes per workspace, and
switching the active palette re-themes all linked assets instantly.

## Style Sync Rollout
Rolling out Style Sync to a customer team starts with importing their existing
brand book. The onboarding wizard extracts colors, fonts, and logo lockups, then
asks an administrator to approve the imported palette. Only approved palettes
become available to end users, which prevents off-brand assets from shipping.

## Edge Defense
Edge Defense is the device security layer. When a user downloads a file from an
untrusted source, Edge Defense quarantines the download inside an isolated
sandbox for 30 seconds while it scans for threats. If the scan is clean the file
is released; otherwise it is deleted and the event is logged to the dashboard.

## Edge Defense Policies
Administrators configure Edge Defense through policy profiles. A profile defines
trusted sources, blocked categories, and whether scan events notify the user.
Policies sync to the fleet within minutes of publication, and a device that is
offline applies the most recently cached policy until it reconnects.

## Identity and Sign-In
Sign-in uses passkeys by default, falling back to a PIN only when biometric
hardware is unavailable. Reps should emphasize that passkeys are phishing
resistant. The device supports up to five enrolled fingerprints per user
profile and one registered face.

## Battery and Charging
The flagship device ships with a 5200 mAh battery. Using the bundled 65W
charger, the device fast-charges from empty to 80 percent in 25 minutes. A full
charge takes approximately 55 minutes under standard room-temperature
conditions, and the battery is rated for 1000 full cycles before noticeable
capacity loss.

## Thermal and Performance
Sustained workloads are managed by an adaptive thermal governor that trades a
small amount of peak performance for quieter, cooler operation. Reps demoing
heavy generative tasks should keep the device on a hard surface so the vapor
chamber can dissipate heat efficiently.

## Display
The display is a 6.7-inch LTPO panel with a variable refresh rate that ranges
from 1 Hz on static content up to 144 Hz during scrolling and gameplay. Peak
brightness reaches 2400 nits in direct sunlight, which makes outdoor demos
reliable even at midday.

## Connectivity
The device supports Wi-Fi 7, Bluetooth 5.4, and sub-6 GHz plus mmWave 5G. Dual
SIM is available as one physical nano-SIM plus one eSIM, and the eSIM can hold
up to eight stored profiles for travelers who switch carriers frequently.

## Accessories
The accessory range includes a magnetic folio case, a wireless charging stand,
and a USB-C to 3.5mm adapter. The folio case doubles as a kickstand and stores
two payment cards. Accessories are sold separately and are not bundled with the
device.

## Warranty and Support
Every device includes a 24-month limited warranty that covers manufacturing
defects. Accidental damage is not covered by the standard warranty but can be
added through the optional MotoCare protection plan, which also bundles priority
support and one battery replacement during the coverage term.

## Support Channels
Customers reach support through in-app chat, phone, and authorized service
centers. Priority support, included with MotoCare, guarantees a first response
within two hours during business hours. Standard support targets one business
day.

## Trade-In and Commercial Terms
Qualifying trade-ins receive credit applied at point of sale. Volume customers
can negotiate staged rollouts, and financing is available over 12, 24, or 36
month terms. Reps must never promise a discount that has not been approved in
the deal desk.
"""


@dataclass
class Case:
    id: str
    course: str
    query: str
    kind: str  # 'answerable' | 'off_topic' | 'no_materials'
    gold_marker: str = ""  # unique substring expected in a retrieved chunk
    expected: str = ""     # substring the grounded answer must contain
    distractors: tuple = field(default_factory=tuple)


CASES: list[Case] = [
    # --- Answerable, near source wording ------------------------------------
    Case(
        id="qira-resolution",
        course=EVAL_COURSE_ID,
        query="What is the maximum image resolution Qira can produce?",
        kind="answerable",
        gold_marker="4096x4096",
        expected="4096",
    ),
    Case(
        id="edge-defense-quarantine",
        course=EVAL_COURSE_ID,
        query="How long does Edge Defense quarantine an untrusted download?",
        kind="answerable",
        gold_marker="sandbox for 30 seconds",
        expected="30 second",
    ),
    Case(
        id="warranty-length",
        course=EVAL_COURSE_ID,
        query="How long is the standard device warranty?",
        kind="answerable",
        gold_marker="24-month limited warranty",
        expected="24",
    ),
    # --- Answerable, paraphrased away from source wording (harder retrieval) -
    Case(
        id="style-sync-palettes",
        course=EVAL_COURSE_ID,
        query="How many separate color sets can the brand consistency tool keep per workspace?",
        kind="answerable",
        gold_marker="12 distinct brand palettes",
        expected="12",
    ),
    Case(
        id="battery-fast-charge",
        course=EVAL_COURSE_ID,
        query="How quickly does the phone reach 80% on the included charger?",
        kind="answerable",
        gold_marker="80 percent in 25 minutes",
        expected="25 minute",
    ),
    Case(
        id="display-brightness",
        course=EVAL_COURSE_ID,
        query="How bright can the screen get outdoors in sunlight?",
        kind="answerable",
        gold_marker="2400 nits",
        expected="2400",
    ),
    Case(
        id="esim-profiles",
        course=EVAL_COURSE_ID,
        query="How many carrier profiles can the embedded SIM hold for travelers?",
        kind="answerable",
        gold_marker="up to eight stored profiles",
        expected="eight",
    ),
    Case(
        id="fingerprints-enrolled",
        course=EVAL_COURSE_ID,
        query="How many fingerprints can a single user register on the device?",
        kind="answerable",
        gold_marker="five enrolled fingerprints",
        expected="five",
    ),
    # --- Off-topic: nothing in the corpus answers these; must refuse --------
    Case(
        id="offtopic-capital",
        course=EVAL_COURSE_ID,
        query="What is the capital of France?",
        kind="off_topic",
    ),
    Case(
        id="offtopic-recipe",
        course=EVAL_COURSE_ID,
        query="Give me a recipe for chocolate chip cookies.",
        kind="off_topic",
    ),
    Case(
        id="offtopic-stock",
        course=EVAL_COURSE_ID,
        query="What will the Motorola stock price be next quarter?",
        kind="off_topic",
    ),
    Case(
        id="offtopic-waterproof",
        course=EVAL_COURSE_ID,
        query="What is the device's IP water-resistance rating?",
        kind="off_topic",
    ),
    # --- No materials: course collection does not exist; must refuse --------
    Case(
        id="nomaterials-qira",
        course=EMPTY_COURSE_ID,
        query="What can Qira do?",
        kind="no_materials",
    ),
]
