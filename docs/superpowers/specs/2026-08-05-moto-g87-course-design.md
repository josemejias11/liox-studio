# moto g87 Course Design

## Goal

Create an editable, launch-ready Course Studio course for the LATAM moto g87 using the Venice product-marketing package. The course must help retail learners make accurate, confident recommendations, not merely display the source material.

## Scope and source authority

- The course title is **moto g87: Always Social Ready**.
- The Venice Copy Guide, product marketing brief, and marketing-spec workbook are the authoritative copy and claim sources.
- Product and on-device assets from `/Users/josemejias/Downloads/Venice Content` provide the visual material.
- LATAM naming and availability apply: moto g87, up to 56-hour battery life, LATAM connectivity and NFC availability.
- Market-dependent statements retain their supplied disclaimer or clear availability language. Claims are not broadened beyond the source pack.
- The course remains an editable Studio draft. It is not frozen, published, or delivered to learners by this work.

## Course structure

The course has three chapters. Each of the nine non-quiz lesson types appears exactly once. The authored, content-created Chapter 1 checkpoint uses the existing chapter-quiz model rather than another lesson type. A single `quiz` lesson is AI-generated and closes the course at the end of Chapter 3; it is not shown before the course end.

The course also exposes dedicated Specifications and Disclaimer pages outside the chapter sequence. They are reference pages, not additional content lessons, so learners can consult accurate technical details and claim limits without breaking the lesson flow.

### Chapter 1: Capture and create

Learners build a camera recommendation around social-ready capture, not a feature checklist.

| Lesson | Type | Learning purpose | Source material |
| --- | --- | --- | --- |
| Always Social Ready | `content` | Establish the product story and the Sony LYTIA 600 camera-system value. | Copy guide, Stargazer hero |
| The camera system at a glance | `stage` | Explore the 50MP main, 8MP ultrawide, and 32MP selfie camera. | Product renders, marketing specs |
| Find the right camera feature | `interaction` | Match a customer scenario to the relevant camera feature. | Copy guide |
| See yourself in the story | `splitScreen` | Contrast selfie, portrait, and photo-booth use cases. | Front-camera samples |
| Camera confidence check | Authored quiz | A content-created checkpoint for camera, editing, and availability claims. | Copy guide, specifications |

### Chapter 2: Keep up with every day

Learners connect performance, battery, display, and smart experiences to customer priorities.

| Lesson | Type | Learning purpose | Source material |
| --- | --- | --- | --- |
| Built to keep up | `scrollStory` | Progress from Snapdragon performance through battery, display, and sound. | Copy guide, performance and entertainment artwork |
| A day without compromise | `canvas` | Use a guided visual map to connect 7000mAh capacity, up-to-56-hour LATAM battery life, 30W charging, and typical day scenarios. | Copy guide, marketing specs |
| Choose the customer benefit | `dragDrop` | Practice mapping needs to the accurate performance, battery, and entertainment proof point. | Copy guide |

### Chapter 3: Recommend with confidence

Learners bring the product together in a concise, accurate retail conversation.

| Lesson | Type | Learning purpose | Source material |
| --- | --- | --- | --- |
| Designed to be seen | `colorSwitcher` | Explore PANTONE Stargazer, Alaskan Blue, and Malaga product finishes. | Color-specific product renders |
| Social-ready capture in action | `video` | Teach Dual Capture, slow motion, and FHD video selling points. | Supplied on-device video |
| Final retail readiness | AI-generated quiz | A supplemental, skippable end-of-course recap; it is generated only from the course's approved material and never replaces authored assessment. | All approved authored course material |

## Reference pages

| Page | Purpose | Source material |
| --- | --- | --- |
| Specifications | Present the authoritative camera, battery, charging, display, platform, protection, and connectivity details in a scannable reference. | Marketing-spec workbook, copy guide |
| Disclaimer | Present LATAM availability, battery, IP64, refresh-rate, and payment/feature limitations before learners make recommendations. | Copy guide, marketing-spec workbook |

## Asset and storage approach

Course assets are copied from the Venice source pack into Cloudflare R2 through the existing Course Studio asset boundary. PostgreSQL stores their durable references and the editable course graph; R2 owns the bytes. No alternative storage provider is introduced now. A later free-storage replacement must preserve the `CourseAssetRef` and course-asset route contract so authored lesson payloads do not need migration.

The implementation uses the supplied PNG, JPG, and MP4 assets. PSD and AI working files remain source-only and are not sent to the learner player. The three source documents are uploaded as course sources for author traceability and later grounded retrieval when OpenAI is configured.

## Runtime and verification

The launch procedure starts PostgreSQL, applies existing Prisma migrations, and starts the Next.js web app, job worker, and parser service. The parser service may remain degraded until a real OpenAI key replaces its local placeholder; this must not prevent creating or previewing the authored course.

Verification covers the authenticated Studio creation path, R2 asset upload and retrieval, save-and-reload of the course graph, the two reference pages, the authored Chapter 1 quiz, and the final-only AI quiz. No automated test files are created or run, per project instruction.
