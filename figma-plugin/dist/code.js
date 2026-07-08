"use strict";
const BOARD_KEY = "moto-client-demo-board";
const PAGE_KEY = "moto-client-demo-page";
const PALETTE = {
    black: "#131417",
    indigo: "#685BC7",
    white: "#FFFFFF",
    frost: "#E9EAF2",
    slate: "#636880",
    pearl: "#F0EDE9",
    indigoSoft: "#F2F0FB",
    border: "#C8CAD4",
};
const FRAME_BG = ["#E9EAF2", "#F0EDE9", "#E9EAF2", "#F0EDE9", "#E9EAF2", "#F0EDE9"];
const DEFAULT_CONFIG = {
    boardTitle: "Moto Tutor AI",
    frameWidth: 1920,
    frameHeight: 1080,
    frameGap: 56,
    layoutMode: "inline",
    clearExisting: true,
    includeScreenshots: true,
    includeControlKit: true,
    selectedPages: ["overview", "content", "learner", "ai-analytics"],
};
const DEFAULT_CONTENT = {
    style: {
        fonts: {
            primaryFamily: "MotoSans",
            regularStyle: "Regular",
            strongStyle: "Semi Bold",
            fallbackFamily: "Inter",
            fallbackRegularStyle: "Regular",
            fallbackStrongStyle: "Semi Bold",
        },
        typeScale: {
            display: 64,
            subtitle: 38,
            sectionLabel: 48,
            cardTitle: 28,
            detailTitle: 24,
            body: 19,
            secondary: 16,
            caption: 15,
            micro: 14,
        },
        frameLayout: {
            "content.lessonGallery": { headerAlign: "center", titleWidth: 1280, subtitleWidth: 1360 },
            "learner.features": { headerAlign: "center", titleWidth: 1360, subtitleWidth: 1440 },
            "ai-analytics.aiArchitecture": { headerAlign: "center", titleWidth: 1280, subtitleWidth: 1500 },
            "ai-analytics.outcomes": { headerAlign: "center", titleWidth: 1200, subtitleWidth: 1360 },
        },
    },
    overview: {
        pageName: "Product Overview",
        whatIs: {
            name: "What Moto Tutor AI Is",
            subtitle: "An AI-powered, CMS-driven approach to interactive eLearnings",
            badgeLabel: "Product Definition",
            cards: [
                { title: "CMS-driven authoring", body: "Instructional designers manage course updates directly in Sanity Studio." },
                { title: "interactive learner experience", body: "Interactive lesson formats move learning beyond static slides." },
                { title: "AI and analytics feedback loop", body: "Grounded answers, adaptive assessment, and measurable learner behavior in one system." },
            ],
            actors: ["Instructional Designers", "Learners", "AI And Analytics Layer"],
            courseCardsTitle: "Course Library",
            courseCards: ["Course · 3 Chapters · Published", "Course · 4 Chapters · Draft", "Course · 6 Lessons · Published", "Course · 2 Modules · Review", "Course · Refresher Track · Published"],
        },
        platformFlow: {
            name: "How The Platform Works",
            subtitle: "End-to-end flow from authoring through delivery, AI, and analytics",
            badgeLabel: "Platform Flow",
            nodes: ["author in Sanity", "upload & indexing", "deliver interactive learning", "measure & adapt"],
            detailLabel: "What happens at each stage:",
            detailCards: [
                { title: "authoring", body: "Instructional designers create course structure, lessons, hotspots, and upload source materials in Sanity Studio. Content is stored in Sanity Cloud CMS and served via API." },
                { title: "upload & indexing", body: "Course material files are proxied through Next.js to the Python parser service for parsing, embedding, and storage." },
                { title: "delivering", body: "Learners enter the 16:9 Next.js player, explore interactive lessons, and use the AI assistant for course-specific questions." },
                { title: "measure & adapt", body: "Progress is written to PostgreSQL and weak topics drive adaptive quiz generation and reporting." },
            ],
            screenshots: ["Sanity Studio Course Editor", "Learner Player — Hotspot Lesson", "Analytics Dashboard"],
        },
    },
    content: {
        pageName: "Content & Authoring",
        authoring: {
            name: "Authoring In Sanity Studio",
            subtitle: "How instructional designers create and manage courses",
            badgeLabel: "Authoring",
            steps: ["create course", "structure chapters and lessons", "upload source files", "attach supporting content", "publish and maintain"],
            note: "Instructional designers manage content, structure, and supporting materials in Sanity Studio while the platform handles delivery, grounded AI, adaptive quiz generation, and reporting.",
            screenshot: "Sanity Studio",
            studioTitle: "Sanity Studio Layout",
            studioSidebar: ["Content", "Courses", "Lessons", "Chapters", "Quizzes"],
        },
        pipeline: {
            name: "Content Upload & Indexing Pipeline",
            subtitle: "How course materials become grounded AI knowledge",
            badgeLabel: "Content Pipeline",
            nodes: [
                { label: "sanity file library", detail: "Authors upload PDF, DOCX, PPTX, XLSX files through the persistent file library in Sanity Studio." },
                { label: "Next.js API Proxy", detail: "Files are proxied server-to-server with internal auth. Browser never reaches the parser directly." },
                { label: "parser service", detail: "Python FastAPI uses markitdown to parse documents into clean text chunks ready for embedding." },
                { label: "ChromaDB Vector Store", detail: "Chunks are embedded and stored for semantic retrieval. Re-uploads replace old chunks." },
            ],
            keyDetailsLabel: "Key Details",
            keyDetails: [
                "Supported formats: PDF, DOCX, PPTX, XLSX",
                "Internal-only proxying from Next.js to the parser",
                "Re-uploading the same filename replaces previous chunks",
                "Deleting a file in Sanity purges its ChromaDB chunks immediately",
            ],
            screenshots: ["Sanity Studio — Material Upload", "Sanity Studio — File Library", "Parser Service — Health Check"],
        },
        lessonGallery: {
            name: "Lesson Type Gallery",
            subtitle: "Nine ways the platform can deliver interactive learning",
            badgeLabel: "Lesson Types",
            lessons: [
                { title: "Content", body: "Structured learning content with supporting media and guided reading." },
                { title: "Interaction", body: "Clickable hotspots open discovery panels with rich media, AI guidance, and visited-state tracking." },
                { title: "Product Stage", body: "Immersive product exploration with floating points of interest, keyboard navigation, and completion feedback." },
                { title: "Video", body: "Embedded video instruction inside the lesson flow." },
                { title: "Quiz", body: "In-lesson or end-of-course knowledge checks." },
                { title: "Color Switcher", body: "Interactive comparison of product variants." },
                { title: "Split Screen", body: "Paired text and media for side-by-side learning." },
                { title: "Drag And Drop", body: "Practice-based interaction with immediate feedback." },
                { title: "Scroll Story", body: "Chapter-based narrative with motion and visual transitions." },
            ],
        },
    },
    learner: {
        pageName: "Learner Experience",
        journey: {
            name: "Frontend Screen Flow",
            subtitle: "How the real web app moves from Sanity authoring into the learner player flow",
            badgeLabel: "Screen Flow",
            authoringLabel: "Authoring Lane",
            authoringScreens: [
                {
                    title: "Studio Login",
                    route: "/studio",
                    screenshot: "Sanity Studio — Login",
                    note: "Authenticated entry point for content authors.",
                },
                {
                    title: "Course Editor",
                    route: "/studio > Courses",
                    screenshot: "Sanity Studio — Course Editor",
                    note: "Authors manage chapters, lessons, hotspots, and quizzes.",
                },
                {
                    title: "Material Upload",
                    route: "/studio > Source Files",
                    screenshot: "Sanity Studio — Material Upload",
                    note: "Source files later ground AI answers and quiz generation.",
                },
            ],
            learnerLabel: "Learner Lane",
            learnerScreens: [
                {
                    title: "Course Library",
                    route: "/",
                    screenshot: "Frontend — Course Library",
                    note: "Published courses appear as selectable cards.",
                },
                {
                    title: "Course Cover",
                    route: "/course/sydney-lite-108",
                    screenshot: "Frontend — Course Cover",
                    note: "Branded entry state before progression begins.",
                },
                {
                    title: "Chapter Intro",
                    route: "player state > chapter intro",
                    screenshot: "Frontend — Chapter Intro",
                    note: "Chapter start can pause on an intro card.",
                },
                {
                    title: "Content Lesson",
                    route: "player state > lesson 1 / 6",
                    screenshot: "Frontend — Lesson 1",
                    note: "Content lessons stay inside the same player shell.",
                },
                {
                    title: "Hotspot + Panel",
                    route: "player state > lesson 2 / 6",
                    screenshot: "Frontend — Hotspot Discovery Panel",
                    note: "Hotspots open contextual panels without leaving the lesson.",
                },
            ],
            transitionLabel: "Publish To Player",
            transitionBody: "Studio edits do not create a separate app. Published Sanity content feeds the same Next.js player, which then steps through cover, chapter intros, lessons, quizzes, disclaimer, and completion states.",
            notesLabel: "Flow Notes",
            notes: [
                "The learner flow after the cover is state-driven inside the player, not route-driven per lesson.",
                "Hotspot lessons can lock the Next action until required features have been visited.",
                "The floating AI entry point is available through lesson phases outside cover and quiz states.",
                "Weak topics from visited and unvisited features later shape quiz generation and reporting.",
            ],
        },
        features: {
            name: "Interactive Features Deep Dive",
            subtitle: "How a hotspot turns into explanation, AI help, and measurable learner progress",
            badgeLabel: "Features",
            hotspotFlowLabel: "Hotspot Interaction Model",
            hotspotFlowNodes: [
                "Learner sees\nhotspot or link",
                "Clicks or taps\nto explore",
                "Discovery panel\nopens in context",
                "AI help +\nprogress update",
            ],
            panelLabel: "What Opens In The Discovery Panel",
            panelItems: [
                "Title, descriptive body copy, photos, or video can appear in the panel",
                "The panel is anchored to the hotspot location instead of replacing the lesson",
                "An AI greeting starts from the hotspot topic to explain the feature quickly",
                "Suggested follow-up prompts help the learner ask sharper product questions",
            ],
            effectsLabel: "Why The Interaction Matters",
            effects: [
                "The hotspot is marked visited for the learner session",
                "Some lessons stay locked until all required hotspots are explored",
                "Unvisited topics feed weak-topic analysis for later quiz generation",
                "Navigation and completion state reflect what the learner actually explored",
            ],
            supportCards: [
                {
                    title: "AI assistant handoff",
                    body: "A hotspot does not end in a dead static modal. It hands the learner into a grounded chat surface with course context already attached.",
                },
                {
                    title: "navigation + progress",
                    body: "Visited hotspots affect map dots, lesson unlocks, return-state clarity, and the adaptive assessment path shown later in the course.",
                },
            ],
            screenshots: ["Frontend — Lesson 2 Hotspot", "Frontend — Discovery Panel"],
        },
        quiz: {
            name: "Quiz & Adaptive Assessment",
            subtitle: "How knowledge checks are generated, graded, and recorded",
            badgeLabel: "Quiz",
            flowNodes: ["Learner Completes Lessons", "Weak Topics Derived", "Quiz Generated via AI", "Learner Attempts Quiz", "Server-Side Grading"],
            dataFlowLabel: "Data Flow",
            dataFlowItems: [
                "Visited hotspots → weak-topic analysis",
                "Unvisited topics → /api/quiz endpoint",
                "AI quiz payload stored server-side",
                "Answers never leave the server",
                "Quiz attempts recorded per session",
            ],
            storageCards: [
                { title: "GeneratedQuiz", body: "Stores the AI quiz payload including answers and explanations on the server, while the client only sees the learner-safe projection." },
                { title: "QuizAttempt", body: "Records each submission with session, score, pass state, and structured answer data for analytics and review." },
            ],
            screenshots: ["Quiz Screen — Results", "Analytics — Quiz Breakdown", "Instructor Dashboard"],
        },
    },
    aiAnalytics: {
        pageName: "AI, Analytics & Outcomes",
        aiArchitecture: {
            name: "AI Architecture",
            subtitle: "How the grounded AI assistant answers course-specific questions",
            badgeLabel: "AI Architecture",
            flowNodes: ["learner question", "/api/chat Proxy", "parser service", "ChromaDB search", "llama3 response"],
            steps: [
                { step: "1", title: "query received", body: "The learner submits a question from the assistant panel with course context attached." },
                { step: "2", title: "server proxies", body: "Next.js verifies the request, adds internal auth, and forwards it to the parser service." },
                { step: "3", title: "retrieve context", body: "Relevant chunks are searched from course materials in the vector store." },
                { step: "4", title: "generate answer", body: "The model receives grounded context plus the question and returns a domain-specific answer." },
                { step: "5", title: "return response", body: "The response flows back through the app to the learner without leaving the local AI environment." },
            ],
            screenshots: ["AI Assistant Chat Panel", "Parser Service — API Docs"],
        },
        analytics: {
            name: "Analytics & Progress Pipeline",
            subtitle: "How learner behavior flows from the player to the dashboard",
            badgeLabel: "Analytics",
            flowNodes: ["learner player", "API routes", "Prisma ORM", "PostgreSQL", "analytics dashboard"],
            tables: [
                { label: "Session", detail: "Browser-generated session tracking with activity timestamps." },
                { label: "LessonProgress", detail: "Per-lesson views, completion, and course context." },
                { label: "HotspotVisit", detail: "Feature exploration events with topic labels." },
                { label: "GeneratedQuiz", detail: "Stored AI quiz payloads with protected answer keys." },
                { label: "QuizAttempt", detail: "Scores, pass state, and answer JSON per attempt." },
            ],
            metricsLabel: "Dashboard Metrics",
            metrics: ["Total sessions", "Features explored", "Average quiz score", "Quiz attempts", "Top explored features", "Recent sessions", "Lesson engagement"],
            screenshot: "Analytics Dashboard — Full View",
        },
        outcomes: {
            name: "Why This Matters",
            subtitle: "Business outcomes from a more adaptive training platform",
            badgeLabel: "Outcomes",
            cards: [
                { title: "faster updates", body: "CMS-driven authoring means courses can be updated without rebuild cycles." },
                { title: "richer engagement", body: "Interactive lesson formats keep learners active." },
                { title: "grounded AI support", body: "AI answers from uploaded materials instead of generic guesses." },
                { title: "adaptive assessment", body: "Knowledge checks respond to explored and weak topics." },
                { title: "measurable analytics", body: "Learning interactions are recorded and visible to teams." },
            ],
            note: "Moto Tutor AI combines authoring control, interactive delivery, grounded AI, and measurable outcomes in one modern training platform.",
            screenshot: "Analytics Dashboard",
        },
    },
};
const ACTIVE_FONTS = {
    regular: { family: "MotoSans", style: "Regular" },
    strong: { family: "MotoSans", style: "Semi Bold" },
};
const FONT_REGULAR = ACTIVE_FONTS.regular;
const FONT_SEMIBOLD = ACTIVE_FONTS.strong;
function regularFont() {
    return ACTIVE_FONTS.regular;
}
function strongFont() {
    return ACTIVE_FONTS.strong;
}
function typeSize(state, key) {
    return state.content.style.typeScale[key];
}
function getFrameLayout(state, frameId) {
    return state.content.style.frameLayout[frameId] || {};
}
function hexToRgb(hex) {
    const c = hex.replace("#", "");
    return { r: parseInt(c.slice(0, 2), 16) / 255, g: parseInt(c.slice(2, 4), 16) / 255, b: parseInt(c.slice(4, 6), 16) / 255 };
}
function setSolidFill(node, color) {
    node.fills = [{ type: "SOLID", color: hexToRgb(color) }];
}
function setStroke(node, color, weight = 1) {
    node.strokes = [{ type: "SOLID", color: hexToRgb(color) }];
    node.strokeWeight = weight;
}
function createFrame(parent, name, x, y, w, h, fill = PALETTE.white) {
    const frame = figma.createFrame();
    frame.name = name;
    frame.resize(w, h);
    frame.x = x;
    frame.y = y;
    frame.cornerRadius = 18;
    frame.clipsContent = false;
    setSolidFill(frame, fill);
    parent.appendChild(frame);
    return frame;
}
function createText(parent, text, x, y, size, font = regularFont(), color = PALETTE.black, opts = {}) {
    const node = figma.createText();
    node.fontName = font;
    node.characters = text;
    node.fontSize = size;
    node.lineHeight = { value: Math.round(size * 1.35), unit: "PIXELS" };
    setSolidFill(node, color);
    parent.appendChild(node);
    if (opts.width) {
        node.textAutoResize = "HEIGHT";
        node.resize(opts.width, Math.max(node.height, size * 1.35));
    }
    else {
        node.textAutoResize = "WIDTH_AND_HEIGHT";
    }
    if (opts.align)
        node.textAlignHorizontal = opts.align;
    if (opts.height)
        node.resize(opts.width || node.width, Math.max(opts.height, node.height));
    if (opts.valign === "CENTER" && opts.height) {
        node.y = y + Math.round((opts.height - node.height) / 2);
    }
    else {
        node.y = y;
    }
    node.x = x;
    return node;
}
function createHeader(frame, title, subtitle, state, frameId) {
    const layout = getFrameLayout(state, frameId);
    const align = layout.headerAlign === "center" ? "CENTER" : "LEFT";
    const titleWidth = layout.titleWidth || (align === "CENTER" ? 1440 : 1280);
    const subtitleWidth = layout.subtitleWidth || (align === "CENTER" ? 1480 : 1220);
    const titleX = align === "CENTER" ? Math.round((state.config.frameWidth - titleWidth) / 2) : 120;
    const subtitleX = align === "CENTER" ? Math.round((state.config.frameWidth - subtitleWidth) / 2) : 120;
    createText(frame, title, titleX, 82, typeSize(state, "display"), strongFont(), PALETTE.black, { width: titleWidth, align });
    createText(frame, subtitle, subtitleX, 162, typeSize(state, "subtitle"), regularFont(), PALETTE.slate, { width: subtitleWidth, align });
    createChip(frame, 1508, 78, 292, 44, state.config.boardTitle, 16, true);
}
function createSectionLabel(frame, text, x, y, state, size) {
    createText(frame, text, x, y, size || typeSize(state, "sectionLabel"), strongFont(), PALETTE.indigo);
}
function createStepBadge(frame, number, label) {
    const badge = createFrame(frame, `step-${number}`, 120, 24, 88, 34, PALETTE.indigo);
    badge.cornerRadius = 17;
    createText(badge, number, 0, 0, 18, FONT_SEMIBOLD, PALETTE.white, { width: 88, height: 34, align: "CENTER", valign: "CENTER" });
    createText(frame, label, 220, 28, 14, FONT_REGULAR, PALETTE.slate);
}
function createInfoCard(frame, card) {
    const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
    setStroke(container, PALETTE.border, 1);
    createText(container, card.title, 30, 26, 28, FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 60 });
    createText(container, card.body, 30, 84, 19, FONT_REGULAR, PALETTE.slate, { width: card.w - 60 });
    return container;
}
function createDetailCard(frame, card) {
    const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
    setStroke(container, PALETTE.border, 1);
    createText(container, card.title, 28, 22, 24, FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 56 });
    createText(container, card.body, 28, 68, 17, FONT_REGULAR, PALETTE.slate, { width: card.w - 56 });
    return container;
}
function createChip(frame, x, y, w, h, text, size = 18, centered = false) {
    const chip = createFrame(frame, text, x, y, w, h, PALETTE.indigoSoft);
    chip.cornerRadius = h / 2;
    setStroke(chip, PALETTE.indigo, 1);
    createText(chip, text, centered ? 20 : 20, 0, size, FONT_SEMIBOLD, PALETTE.indigo, {
        width: w - 40,
        height: h,
        align: centered ? "CENTER" : "LEFT",
        valign: "CENTER",
    });
    return chip;
}
function createJourneyStop(frame, x, y, number, title) {
    const badge = createFrame(frame, number, x + 74, y, 60, 60, PALETTE.indigo);
    badge.cornerRadius = 30;
    createText(badge, number, 0, 0, 28, FONT_SEMIBOLD, PALETTE.white, { width: 60, height: 60, align: "CENTER", valign: "CENTER" });
    createText(frame, title, x, y + 92, 20, FONT_SEMIBOLD, PALETTE.black, { width: 208, align: "CENTER" });
}
function createConnector(frame, x, y, w) {
    const line = createFrame(frame, "connector", x, y, w, 4, PALETTE.indigoSoft);
    line.cornerRadius = 2;
}
function createFeaturePill(frame, x, y, w, h, text) {
    const pill = createFrame(frame, text, x, y, w, h, PALETTE.white);
    pill.cornerRadius = 16;
    setStroke(pill, PALETTE.border, 1);
    createText(pill, text, 18, 0, 16, FONT_REGULAR, PALETTE.black, { width: w - 36, height: h, valign: "CENTER" });
}
function createLessonTile(frame, card, state) {
    const tile = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
    setStroke(tile, PALETTE.border, 1);
    createText(tile, card.title, 26, 24, 28, FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 52 });
    createText(tile, card.body, 26, 78, 17, FONT_REGULAR, PALETTE.slate, { width: card.w - 52 });
    if (state.config.includeScreenshots) {
        const zone = createFrame(tile, "[screenshot]", 26, card.h - 64, 190, 36, PALETTE.indigoSoft);
        zone.cornerRadius = 18;
        zone.dashPattern = [6, 4];
        setStroke(zone, PALETTE.indigo, 1);
        createText(zone, card.title, 0, 0, 14, FONT_SEMIBOLD, PALETTE.indigo, {
            width: 190,
            height: 36,
            align: "CENTER",
            valign: "CENTER",
        });
    }
}
function createProcessRow(frame, row) {
    const container = createFrame(frame, row.title, row.x, row.y, row.w, row.h, PALETTE.white);
    setStroke(container, PALETTE.border, 1);
    const badge = createFrame(container, row.number, 26, 22, 58, 58, PALETTE.indigo);
    badge.cornerRadius = 29;
    createText(badge, row.number, 0, 0, 28, FONT_SEMIBOLD, PALETTE.white, { width: 58, height: 58, align: "CENTER", valign: "CENTER" });
    if (row.body) {
        createText(container, row.title, 112, 14, 20, FONT_SEMIBOLD, PALETTE.black, { width: row.w - 140 });
        createText(container, row.body, 112, 42, 14, FONT_REGULAR, PALETTE.slate, { width: row.w - 140 });
    }
    else {
        createText(container, row.title, 112, 0, 20, FONT_SEMIBOLD, PALETTE.black, { width: row.w - 140, height: row.h, valign: "CENTER" });
    }
}
function createArchitectureStepRow(frame, row) {
    const container = createFrame(frame, row.title, row.x, row.y, row.w, row.h, PALETTE.white);
    container.cornerRadius = 22;
    setStroke(container, PALETTE.border, 1);
    const badgeSize = 48;
    const badge = createFrame(container, row.number, 28, Math.round((row.h - badgeSize) / 2), badgeSize, badgeSize, PALETTE.indigo);
    badge.cornerRadius = badgeSize / 2;
    createText(badge, row.number, 0, 0, 28, FONT_SEMIBOLD, PALETTE.white, {
        width: badgeSize,
        height: badgeSize,
        align: "CENTER",
        valign: "CENTER",
    });
    createText(container, row.title, 96, 14, 20, FONT_SEMIBOLD, PALETTE.black, { width: row.w - 124 });
    createText(container, row.body, 96, 42, 15, FONT_REGULAR, PALETTE.slate, { width: row.w - 124 });
}
function createOutcomeCard(frame, card) {
    const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
    setStroke(container, PALETTE.border, 1);
    const icon = createFrame(container, "icon", 28, 28, 52, 52, PALETTE.indigoSoft);
    icon.cornerRadius = 16;
    createText(icon, "★", 0, 0, 24, FONT_REGULAR, PALETTE.indigo, { width: 52, height: 52, align: "CENTER", valign: "CENTER" });
    createText(container, card.title, 28, 104, 24, FONT_SEMIBOLD, PALETTE.black, { width: card.w - 56 });
    createText(container, card.body, 28, 150, 17, FONT_REGULAR, PALETTE.slate, { width: card.w - 56 });
}
function createNoteBlock(frame, x, y, w, h, text) {
    const note = createFrame(frame, "note", x, y, w, h, PALETTE.white);
    note.cornerRadius = 14;
    setStroke(note, PALETTE.indigo, 1);
    createText(note, text, 28, 0, 19, FONT_SEMIBOLD, PALETTE.indigo, {
        width: w - 56,
        height: h - 8,
        valign: "CENTER",
    });
}
function createScreenshotZone(frame, x, y, w, h, label, state) {
    if (!state.config.includeScreenshots)
        return;
    const zone = createFrame(frame, `[screenshot] ${label}`, x, y, w, h, PALETTE.indigoSoft);
    zone.cornerRadius = 12;
    zone.dashPattern = [10, 6];
    setStroke(zone, PALETTE.indigo, 2);
    createText(zone, `[Screenshot: ${label}]`, 0, 0, 16, FONT_SEMIBOLD, PALETTE.indigo, {
        width: w,
        height: h,
        align: "CENTER",
        valign: "CENTER",
    });
}
function createFlowNode(frame, node) {
    const container = createFrame(frame, node.label.split("\n")[0], node.x, node.y, node.w, node.h, PALETTE.white);
    container.cornerRadius = 16;
    setStroke(container, node.color || PALETTE.indigo, 2);
    createText(container, node.label.replace(/\n/g, "\n"), 0, 0, 22, FONT_SEMIBOLD, node.color || PALETTE.indigo, {
        width: node.w,
        height: node.h,
        align: "CENTER",
        valign: "CENTER",
    });
}
function createFlowArrow(frame, x, y, w) {
    const line = createFrame(frame, "flow-arrow", x, y, w, 3, PALETTE.indigo);
    line.cornerRadius = 2;
    createText(frame, "→", x + w, y - 8, 22, FONT_SEMIBOLD, PALETTE.indigo);
}
function createPlayerShell(frame, title, progressLabel) {
    const shell = createFrame(frame, "Player Shell", 160, 250, 1600, 120, PALETTE.white);
    shell.cornerRadius = 14;
    setStroke(shell, PALETTE.black, 2);
    const bar = createFrame(shell, "nav-bar", 0, 0, 1600, 38, PALETTE.black);
    bar.cornerRadius = 0;
    createText(bar, "← Course Title", 16, 8, 16, FONT_SEMIBOLD, PALETTE.white);
    const progress = createFrame(shell, "progress-bar", 0, 82, 1600, 38, PALETTE.indigoSoft);
    progress.cornerRadius = 0;
    createText(progress, progressLabel, 16, 10, 14, FONT_REGULAR, PALETTE.slate);
    const fab = createFrame(shell, "ai-fab", 1532, 60, 52, 52, PALETTE.indigo);
    fab.cornerRadius = 26;
    createText(fab, "✦", 0, 0, 22, FONT_REGULAR, PALETTE.white, { width: 52, height: 52, align: "CENTER", valign: "CENTER" });
    createText(frame, title, 160, 232, 16, FONT_SEMIBOLD, PALETTE.slate, { width: 260 });
}
function createStudioShell(frame, layoutTitle, sidebarItems) {
    const shell = createFrame(frame, "Studio Shell", 830, 240, 970, 636, PALETTE.white);
    shell.cornerRadius = 14;
    setStroke(shell, PALETTE.black, 2);
    const bar = createFrame(shell, "studio-bar", 0, 0, 970, 44, PALETTE.black);
    bar.cornerRadius = 0;
    createText(bar, "Sanity Studio", 16, 10, 16, FONT_SEMIBOLD, PALETTE.white);
    const sidebar = createFrame(shell, "sidebar", 0, 44, 160, 592, PALETTE.frost);
    sidebar.cornerRadius = 0;
    let iy = 56;
    for (const item of sidebarItems) {
        createText(sidebar, item, 20, iy, 14, FONT_REGULAR, PALETTE.slate);
        iy += 28;
    }
    const canvas = createFrame(shell, "editor-canvas", 176, 60, 778, 560, PALETTE.white);
    canvas.cornerRadius = 8;
    setStroke(canvas, PALETTE.border, 1);
    createText(frame, layoutTitle, 830, 222, 16, FONT_SEMIBOLD, PALETTE.slate, { width: 300 });
}
function createSimulatedCourseCards(frame, title, items) {
    const row = createFrame(frame, "course-cards", 120, 816, 1680, 120, PALETTE.white);
    row.cornerRadius = 12;
    setStroke(row, PALETTE.black, 1);
    const cards = items.slice(0, 5);
    for (let i = 0; i < cards.length; i += 1) {
        const [headline, subline = ""] = cards[i].split("·").map((part) => part.trim());
        const card = createFrame(row, "card", 20 + i * 332, 18, 300, 84, PALETTE.frost);
        card.cornerRadius = 8;
        setStroke(card, PALETTE.border, 1);
        createText(card, headline || "Course", 14, 12, 16, FONT_SEMIBOLD, PALETTE.black);
        createText(card, subline || "Published", 14, 38, 13, FONT_REGULAR, PALETTE.slate);
        createText(card, "→", 0, 0, 22, FONT_SEMIBOLD, PALETTE.indigo, { width: 292, height: 84, align: "RIGHT", valign: "CENTER" });
    }
    createText(frame, title, 120, 798, 16, FONT_SEMIBOLD, PALETTE.slate, { width: 220 });
}
function createBulletList(frame, items, x, y, width, size, gap, color = PALETTE.slate) {
    let cy = y;
    items.forEach((item) => {
        createText(frame, `• ${item}`, x, cy, size, FONT_REGULAR, color, { width });
        cy += gap;
    });
}
function createLabelValueCard(frame, card) {
    const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.indigoSoft);
    container.cornerRadius = 12;
    setStroke(container, PALETTE.indigo, 1);
    createText(container, card.title, 18, 10, 18, FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 36 });
    createText(container, card.body, 18, 38, 13, FONT_REGULAR, PALETTE.slate, { width: card.w - 36 });
    return container;
}
function createMetricListCard(frame, x, y, w, h, title, items) {
    const card = createFrame(frame, title, x, y, w, h, PALETTE.white);
    card.cornerRadius = 16;
    setStroke(card, PALETTE.border, 1);
    createText(card, title, 24, 22, 22, FONT_SEMIBOLD, PALETTE.indigo, { width: w - 48 });
    let cy = 64;
    items.forEach((item) => {
        createText(card, `• ${item}`, 24, cy, 17, FONT_REGULAR, PALETTE.slate, { width: w - 48 });
        cy += 34;
    });
    return card;
}
function createSupportCard(frame, card) {
    const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
    container.cornerRadius = 16;
    setStroke(container, PALETTE.border, 1);
    createText(container, card.title, 24, 20, 20, FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 48 });
    createText(container, card.body, 24, 52, 15, FONT_REGULAR, PALETTE.slate, { width: card.w - 48 });
    return container;
}
function createScreenFlowCard(frame, card, state) {
    const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
    container.cornerRadius = 18;
    setStroke(container, PALETTE.border, 1);
    const bar = createFrame(container, `${card.title}-bar`, 0, 0, card.w, 34, PALETTE.frost);
    bar.cornerRadius = 0;
    createText(bar, card.route, 16, 9, 12, FONT_SEMIBOLD, PALETTE.slate, { width: card.w - 32 });
    createText(container, card.title, 18, 48, 18, FONT_SEMIBOLD, PALETTE.black, { width: card.w - 36 });
    createScreenshotZone(container, 18, 82, card.w - 36, 114, card.screenshot, state);
    if (card.note) {
        createText(container, card.note, 18, 210, 12, FONT_REGULAR, PALETTE.slate, { width: card.w - 36 });
    }
    return container;
}
function createCompactNotesCard(frame, x, y, w, h, title, items) {
    const card = createFrame(frame, title, x, y, w, h, PALETTE.white);
    card.cornerRadius = 16;
    setStroke(card, PALETTE.border, 1);
    createText(card, title, 24, 20, 18, FONT_SEMIBOLD, PALETTE.indigo, { width: w - 48 });
    const columnWidth = Math.floor((w - 72) / 2);
    items.slice(0, 4).forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        createText(card, `• ${item}`, 24 + col * (columnWidth + 24), 54 + row * 28, 13, FONT_REGULAR, PALETTE.slate, {
            width: columnWidth,
        });
    });
    return card;
}
function createControlKitPage(state) {
    const page = figma.createPage();
    page.name = `${state.config.boardTitle} · Moto Control Kit`;
    page.setPluginData(PAGE_KEY, "generated");
    const root = createFrame(page, "Moto Control Kit", 120, 120, 2240, 1680, "#F7F5F1");
    root.cornerRadius = 24;
    setStroke(root, PALETTE.border, 1);
    createText(root, "MOTO BOARD SYSTEM", 72, 64, 13, FONT_SEMIBOLD, PALETTE.indigo);
    createText(root, "Moto Control Kit", 72, 92, 44, FONT_SEMIBOLD, PALETTE.black);
    createText(root, "Editable board primitives for the Moto Tutor AI presentation flow. Duplicate these blocks or use them as the MCP write target instead of rebuilding full pages every time.", 72, 152, 18, FONT_REGULAR, PALETTE.slate, { width: 920 });
    const palette = createFrame(root, "Palette", 72, 260, 1008, 288, PALETTE.white);
    palette.cornerRadius = 20;
    setStroke(palette, PALETTE.border, 1);
    createText(palette, "Core Palette", 28, 24, 24, FONT_SEMIBOLD, PALETTE.black);
    createText(palette, "These colors match the current Moto presentation generator and give you a stable edit surface in Figma.", 28, 58, 14, FONT_REGULAR, PALETTE.slate, { width: 520 });
    const paletteItems = [
        ["Moto Indigo", PALETTE.indigo],
        ["Frost", PALETTE.frost],
        ["Pearl", PALETTE.pearl],
        ["Ink", PALETTE.black],
        ["Slate", PALETTE.slate],
        ["Soft Indigo", PALETTE.indigoSoft],
    ];
    paletteItems.forEach(([label, hex], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 28 + col * 318;
        const y = 112 + row * 72;
        const swatch = createFrame(palette, String(label), x, y, 286, 52, String(hex));
        swatch.cornerRadius = 14;
        if (hex !== PALETTE.black)
            setStroke(swatch, PALETTE.border, 1);
        createText(swatch, String(label), 16, 11, 14, FONT_SEMIBOLD, hex === PALETTE.black ? PALETTE.white : PALETTE.black);
        createText(swatch, String(hex), 16, 29, 12, FONT_REGULAR, hex === PALETTE.black ? PALETTE.white : PALETTE.slate);
    });
    const typography = createFrame(root, "Typography", 1112, 260, 1056, 288, PALETTE.white);
    typography.cornerRadius = 20;
    setStroke(typography, PALETTE.border, 1);
    createText(typography, "Typography", 28, 24, 24, FONT_SEMIBOLD, PALETTE.black);
    createText(typography, `${state.content.style.fonts.primaryFamily} is the preferred board face. ${state.content.style.fonts.fallbackFamily} is only used as the editable fallback when the primary font is unavailable in Figma.`, 28, 58, 14, FONT_REGULAR, PALETTE.slate, { width: 540 });
    createText(typography, `Display / ${state.content.style.typeScale.display} ${state.content.style.fonts.strongStyle}`, 28, 116, 44, FONT_SEMIBOLD, PALETTE.black);
    createText(typography, `Heading / ${state.content.style.typeScale.detailTitle} ${state.content.style.fonts.strongStyle}`, 28, 184, 24, FONT_SEMIBOLD, PALETTE.black);
    createText(typography, `Body / ${state.content.style.typeScale.secondary} ${state.content.style.fonts.regularStyle}. Use this for operational descriptions, architecture callouts, and slide support copy.`, 28, 226, 16, FONT_REGULAR, PALETTE.slate, { width: 760 });
    const blocks = createFrame(root, "Reusable Blocks", 72, 588, 2096, 520, PALETTE.white);
    blocks.cornerRadius = 20;
    setStroke(blocks, PALETTE.border, 1);
    createText(blocks, "Reusable Blocks", 28, 24, 24, FONT_SEMIBOLD, PALETTE.black);
    createText(blocks, "These are intentionally simple editable primitives rather than locked components, so Codex and Figma edits stay frictionless.", 28, 58, 14, FONT_REGULAR, PALETTE.slate, { width: 780 });
    const stepBadge = createFrame(blocks, "Step Badge", 28, 116, 360, 128, "#F7F5F1");
    stepBadge.cornerRadius = 16;
    setStroke(stepBadge, PALETTE.border, 1);
    const badge = createFrame(stepBadge, "Badge Pill", 20, 20, 84, 34, PALETTE.indigo);
    badge.cornerRadius = 17;
    createText(badge, "3", 0, 0, 18, FONT_SEMIBOLD, PALETTE.white, { width: 84, height: 34, align: "CENTER", valign: "CENTER" });
    createText(stepBadge, "Authoring", 118, 24, 16, FONT_REGULAR, PALETTE.slate);
    createText(stepBadge, "Section headline or frame title", 20, 72, 24, FONT_SEMIBOLD, PALETTE.black);
    const infoCard = createFrame(blocks, "Info Card", 420, 116, 520, 220, PALETTE.white);
    infoCard.cornerRadius = 16;
    setStroke(infoCard, PALETTE.border, 1);
    createText(infoCard, "Info Card Title", 24, 24, 26, FONT_SEMIBOLD, PALETTE.indigo);
    createText(infoCard, "Use this block for architecture explanations, feature summaries, or business outcomes. Duplicate and rewrite instead of redrawing.", 24, 72, 16, FONT_REGULAR, PALETTE.slate, { width: 472 });
    const flowCard = createFrame(blocks, "Flow Node", 972, 116, 280, 160, PALETTE.white);
    flowCard.cornerRadius = 16;
    setStroke(flowCard, PALETTE.indigo, 2);
    createText(flowCard, "Deliver", 92, 46, 24, FONT_SEMIBOLD, PALETTE.indigo);
    createText(flowCard, "Interactive Learning", 36, 82, 20, FONT_SEMIBOLD, PALETTE.indigo, { width: 208 });
    const screenshotCard = createFrame(blocks, "Screenshot Placeholder", 1284, 116, 784, 220, PALETTE.indigoSoft);
    screenshotCard.cornerRadius = 16;
    screenshotCard.dashPattern = [10, 6];
    setStroke(screenshotCard, PALETTE.indigo, 2);
    createText(screenshotCard, "[Screenshot: Learner Player - Hotspot Lesson]", 0, 0, 20, FONT_SEMIBOLD, PALETTE.indigo, { width: 784, height: 220, align: "CENTER", valign: "CENTER" });
    const shellSection = createFrame(root, "Slide Shell", 72, 1140, 2096, 452, PALETTE.white);
    shellSection.cornerRadius = 20;
    setStroke(shellSection, PALETTE.border, 1);
    createText(shellSection, "16:9 Slide Shell", 28, 24, 24, FONT_SEMIBOLD, PALETTE.black);
    createText(shellSection, "Use this frame as the safest edit target when you want the file to stay clean and manually editable.", 28, 58, 14, FONT_REGULAR, PALETTE.slate, { width: 720 });
    const shell = createFrame(shellSection, "Editable Slide", 28, 104, 1600, 300, PALETTE.frost);
    shell.cornerRadius = 0;
    createText(shell, "STEP 1", 42, 28, 14, FONT_SEMIBOLD, PALETTE.indigo);
    createText(shell, "What Moto Tutor AI Is", 42, 58, 54, FONT_SEMIBOLD, PALETTE.black);
    createText(shell, "A reusable shell for the current board generator. Replace title, body, blocks, and placeholders without having to regenerate the entire document.", 42, 126, 20, FONT_REGULAR, PALETTE.slate, { width: 920 });
    ["CMS-Driven Authoring", "Interactive Learner Experience", "Grounded AI + Analytics"].forEach((label, index) => {
        const card = createFrame(shell, `Shell Card ${index + 1}`, 42 + index * 334, 198, 316, 72, PALETTE.white);
        card.cornerRadius = 12;
        setStroke(card, PALETTE.border, 1);
        createText(card, label, 18, 18, 18, FONT_SEMIBOLD, PALETTE.indigo, { width: 280 });
    });
}
function buildPageSpecs(content) {
    return [
        {
            id: "overview",
            name: content.overview.pageName,
            frames: [
                {
                    id: "overview.whatIs",
                    name: content.overview.whatIs.name,
                    displayTitle: "what moto tutor AI is",
                    subtitle: content.overview.whatIs.subtitle,
                    background: FRAME_BG[0],
                    badge: ["1", content.overview.whatIs.badgeLabel],
                    build(frame, state) {
                        const block = state.content.overview.whatIs;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        let x = 120;
                        for (const card of block.cards.slice(0, 3)) {
                            createInfoCard(frame, { x, y: 274, w: 520, h: 214, title: card.title, body: card.body });
                            x += 560;
                        }
                        createSectionLabel(frame, "Core Actors", 810, 563, state);
                        let cx = 150;
                        for (const actor of block.actors.slice(0, 3)) {
                            createChip(frame, cx, 668, 360, 68, actor, 18, true);
                            cx += 610;
                        }
                        createSimulatedCourseCards(frame, block.courseCardsTitle, block.courseCards);
                    },
                },
                {
                    id: "overview.platformFlow",
                    name: content.overview.platformFlow.name,
                    displayTitle: "how the platform works",
                    subtitle: content.overview.platformFlow.subtitle,
                    background: FRAME_BG[1],
                    badge: ["2", content.overview.platformFlow.badgeLabel],
                    build(frame, state) {
                        const block = state.content.overview.platformFlow;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        const coords = [
                            { x: 96, y: 360, w: 222, h: 108 },
                            { x: 446, y: 362, w: 222, h: 108 },
                            { x: 806, y: 361, w: 222, h: 108 },
                            { x: 1166, y: 360, w: 222, h: 108 },
                        ];
                        block.nodes.slice(0, 4).forEach((label, index) => createFlowNode(frame, { label, ...coords[index], color: PALETTE.indigo }));
                        createFlowArrow(frame, 318, 414, 82);
                        createFlowArrow(frame, 668, 415, 92);
                        createFlowArrow(frame, 1028, 414, 92);
                        createSectionLabel(frame, block.detailLabel, 120, 540, state, 18);
                        let dx = 96;
                        for (const card of block.detailCards.slice(0, 4)) {
                            createDetailCard(frame, { x: dx, y: 584, w: 428, h: 224, title: card.title, body: card.body });
                            dx += 452;
                        }
                        block.screenshots.slice(0, 3).forEach((label, index) => createScreenshotZone(frame, 120 + index * 576, 840, 540, 200, label, state));
                    },
                },
            ],
        },
        {
            id: "content",
            name: content.content.pageName,
            frames: [
                {
                    id: "content.authoring",
                    name: content.content.authoring.name,
                    displayTitle: "authoring in sanity studio",
                    subtitle: content.content.authoring.subtitle,
                    background: FRAME_BG[2],
                    badge: ["3", content.content.authoring.badgeLabel],
                    build(frame, state) {
                        const block = state.content.content.authoring;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        createStudioShell(frame, block.studioTitle, block.studioSidebar);
                        let y = 264;
                        block.steps.slice(0, 5).forEach((step, index) => {
                            createProcessRow(frame, { x: 140, y, w: 680, h: 98, number: String(index + 1), title: step });
                            y += 118;
                        });
                        createNoteBlock(frame, 140, 894, 1012, 114, block.note);
                        createScreenshotZone(frame, 1180, 894, 620, 114, block.screenshot, state);
                    },
                },
                {
                    id: "content.pipeline",
                    name: content.content.pipeline.name,
                    displayTitle: "content upload & indexing pipeline",
                    subtitle: content.content.pipeline.subtitle,
                    background: FRAME_BG[3],
                    badge: ["4", content.content.pipeline.badgeLabel],
                    build(frame, state) {
                        const block = state.content.content.pipeline;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        block.nodes.slice(0, 4).forEach((item, index) => {
                            const x = 120 + index * 320;
                            createFlowNode(frame, { label: item.label, x, y: 280, w: 220, h: 120, color: PALETTE.indigo });
                            if (index < 3)
                                createFlowArrow(frame, x + 220, 340, 70);
                            createLabelValueCard(frame, { x, y: 430, w: 220, h: 138, title: "Stage Detail", body: item.detail || "" });
                        });
                        createSectionLabel(frame, block.keyDetailsLabel, 120, 606, state, 18);
                        createMetricListCard(frame, 120, 638, 840, 238, block.keyDetailsLabel, block.keyDetails.slice(0, 4));
                        block.screenshots.slice(0, 3).forEach((label, index) => createScreenshotZone(frame, 1000 + index * 270, 638 + Math.floor(index / 2) * 262, 250, 238, label, state));
                    },
                },
                {
                    id: "content.lessonGallery",
                    name: content.content.lessonGallery.name,
                    displayTitle: "lesson type gallery",
                    subtitle: content.content.lessonGallery.subtitle,
                    background: FRAME_BG[4],
                    badge: ["5", content.content.lessonGallery.badgeLabel],
                    build(frame, state) {
                        const block = state.content.content.lessonGallery;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        const sx = 120;
                        const sy = 210;
                        const tw = 536;
                        const th = 236;
                        const gap = 28;
                        block.lessons.slice(0, 9).forEach((lesson, index) => {
                            const col = index % 3;
                            const row = Math.floor(index / 3);
                            createLessonTile(frame, { x: sx + col * (tw + gap), y: sy + row * (th + gap), w: tw, h: th, title: lesson.title, body: lesson.body }, state);
                        });
                    },
                },
            ],
        },
        {
            id: "learner",
            name: content.learner.pageName,
            frames: [
                {
                    id: "learner.journey",
                    name: content.learner.journey.name,
                    displayTitle: "frontend screen flow",
                    subtitle: content.learner.journey.subtitle,
                    background: FRAME_BG[0],
                    badge: ["6", content.learner.journey.badgeLabel],
                    build(frame, state) {
                        const block = state.content.learner.journey;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        createSectionLabel(frame, block.authoringLabel, 120, 216, state, 18);
                        const authoringXs = [120, 470, 820];
                        block.authoringScreens.slice(0, 3).forEach((screen, index) => {
                            createScreenFlowCard(frame, { x: authoringXs[index], y: 250, w: 310, h: 310, title: screen.title, route: screen.route, screenshot: screen.screenshot, note: screen.note }, state);
                            if (index < 2)
                                createFlowArrow(frame, authoringXs[index] + 310, 405, 32);
                        });
                        createLabelValueCard(frame, {
                            x: 1180,
                            y: 312,
                            w: 620,
                            h: 162,
                            title: block.transitionLabel,
                            body: block.transitionBody,
                        });
                        createSectionLabel(frame, block.learnerLabel, 120, 596, state, 18);
                        const learnerXs = [120, 424, 728, 1032, 1336];
                        block.learnerScreens.slice(0, 5).forEach((screen, index) => {
                            createScreenFlowCard(frame, { x: learnerXs[index], y: 630, w: 264, h: 280, title: screen.title, route: screen.route, screenshot: screen.screenshot, note: screen.note }, state);
                            if (index < 4)
                                createFlowArrow(frame, learnerXs[index] + 264, 770, 16);
                        });
                        createCompactNotesCard(frame, 120, 930, 1680, 118, block.notesLabel, block.notes.slice(0, 4));
                    },
                },
                {
                    id: "learner.features",
                    name: content.learner.features.name,
                    displayTitle: "interactive features deep dive",
                    subtitle: content.learner.features.subtitle,
                    background: FRAME_BG[1],
                    badge: ["7", content.learner.features.badgeLabel],
                    build(frame, state) {
                        const block = state.content.learner.features;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        createSectionLabel(frame, block.hotspotFlowLabel, 120, 222, state, 18);
                        const flowNodes = [
                            { x: 120, y: 258, w: 324, h: 118 },
                            { x: 512, y: 258, w: 324, h: 118 },
                            { x: 904, y: 258, w: 324, h: 118 },
                            { x: 1296, y: 258, w: 324, h: 118 },
                        ];
                        block.hotspotFlowNodes.slice(0, 4).forEach((label, index) => createFlowNode(frame, { label, ...flowNodes[index], color: PALETTE.indigo }));
                        createFlowArrow(frame, 444, 316, 38);
                        createFlowArrow(frame, 836, 316, 38);
                        createFlowArrow(frame, 1228, 316, 38);
                        createScreenshotZone(frame, 120, 436, 560, 214, block.screenshots[0], state);
                        createScreenshotZone(frame, 704, 436, 560, 214, block.screenshots[1], state);
                        createSupportCard(frame, { x: 1290, y: 436, w: 510, h: 100, title: block.supportCards[0].title, body: block.supportCards[0].body });
                        createSupportCard(frame, { x: 1290, y: 550, w: 510, h: 100, title: block.supportCards[1].title, body: block.supportCards[1].body });
                        createMetricListCard(frame, 120, 706, 820, 264, block.panelLabel, block.panelItems.slice(0, 4));
                        createMetricListCard(frame, 980, 706, 820, 264, block.effectsLabel, block.effects.slice(0, 4));
                    },
                },
                {
                    id: "learner.quiz",
                    name: content.learner.quiz.name,
                    displayTitle: "quiz & adaptive assessment",
                    subtitle: content.learner.quiz.subtitle,
                    background: FRAME_BG[2],
                    badge: ["8", content.learner.quiz.badgeLabel],
                    build(frame, state) {
                        const block = state.content.learner.quiz;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        block.flowNodes.slice(0, 5).forEach((label, index) => {
                            const x = 120 + index * 270;
                            createFlowNode(frame, { label, x, y: 260, w: 194, h: 120, color: PALETTE.indigo });
                            if (index < 4)
                                createFlowArrow(frame, x + 194, 320, 72);
                        });
                        createSectionLabel(frame, block.dataFlowLabel, 120, 460, state, 18);
                        block.dataFlowItems.slice(0, 5).forEach((item, index) => {
                            createText(frame, item, 120 + index * 320, 500, 15, FONT_REGULAR, PALETTE.slate, { width: 320 });
                        });
                        createInfoCard(frame, { x: 120, y: 580, w: 520, h: 180, title: block.storageCards[0].title, body: block.storageCards[0].body });
                        createInfoCard(frame, { x: 700, y: 580, w: 520, h: 180, title: block.storageCards[1].title, body: block.storageCards[1].body });
                        createScreenshotZone(frame, 1280, 580, 520, 180, block.screenshots[0], state);
                        createScreenshotZone(frame, 120, 820, 540, 220, block.screenshots[1], state);
                        createScreenshotZone(frame, 700, 820, 540, 220, block.screenshots[2], state);
                    },
                },
            ],
        },
        {
            id: "ai-analytics",
            name: content.aiAnalytics.pageName,
            frames: [
                {
                    id: "ai-analytics.aiArchitecture",
                    name: content.aiAnalytics.aiArchitecture.name,
                    displayTitle: "AI architecture",
                    subtitle: content.aiAnalytics.aiArchitecture.subtitle,
                    background: FRAME_BG[3],
                    badge: ["9", content.aiAnalytics.aiArchitecture.badgeLabel],
                    build(frame, state) {
                        const block = state.content.aiAnalytics.aiArchitecture;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        const flowCoords = [
                            { x: 120, y: 260, w: 194, h: 120 },
                            { x: 424, y: 260, w: 194, h: 120 },
                            { x: 727, y: 260, w: 194, h: 120 },
                            { x: 1028, y: 259, w: 194, h: 120 },
                            { x: 1332, y: 259, w: 194, h: 120 },
                        ];
                        block.flowNodes.slice(0, 5).forEach((label, index) => createFlowNode(frame, { label, ...flowCoords[index], color: PALETTE.indigo }));
                        createFlowArrow(frame, 314, 320, 82);
                        createFlowArrow(frame, 618, 319, 82);
                        createFlowArrow(frame, 919, 319, 82);
                        createFlowArrow(frame, 1222, 316, 82);
                        let sy = 420;
                        block.steps.slice(0, 5).forEach((step) => {
                            createArchitectureStepRow(frame, { x: 120, y: sy, w: 1680, h: 74, number: step.step, title: step.title, body: step.body });
                            sy += 94;
                        });
                        createScreenshotZone(frame, 120, 890, 820, 150, block.screenshots[0], state);
                        createScreenshotZone(frame, 980, 890, 820, 150, block.screenshots[1], state);
                    },
                },
                {
                    id: "ai-analytics.analytics",
                    name: content.aiAnalytics.analytics.name,
                    displayTitle: "analytics & progress pipeline",
                    subtitle: content.aiAnalytics.analytics.subtitle,
                    background: FRAME_BG[4],
                    badge: ["10", content.aiAnalytics.analytics.badgeLabel],
                    build(frame, state) {
                        const block = state.content.aiAnalytics.analytics;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        const flowCoords = [
                            { x: 120, y: 250, w: 194, h: 100 },
                            { x: 420, y: 250, w: 194, h: 100 },
                            { x: 719, y: 244, w: 194, h: 100 },
                            { x: 1018, y: 247, w: 194, h: 100 },
                            { x: 1317, y: 250, w: 194, h: 100 },
                        ];
                        block.flowNodes.slice(0, 5).forEach((label, index) => createFlowNode(frame, { label, ...flowCoords[index], color: PALETTE.indigo }));
                        createFlowArrow(frame, 314, 300, 82);
                        createFlowArrow(frame, 614, 300, 82);
                        createFlowArrow(frame, 913, 301, 82);
                        createFlowArrow(frame, 1212, 297, 82);
                        let tx = 120;
                        let ty = 420;
                        block.tables.slice(0, 5).forEach((table) => {
                            createLabelValueCard(frame, { x: tx, y: ty, w: 300, h: 86, title: table.label, body: table.detail });
                            tx += 324;
                            if (tx > 1400) {
                                tx = 120;
                                ty += 104;
                            }
                        });
                        createMetricListCard(frame, 120, 662, 420, 294, block.metricsLabel, block.metrics.slice(0, 7));
                        createScreenshotZone(frame, 592, 662, 1208, 294, block.screenshot, state);
                    },
                },
                {
                    id: "ai-analytics.outcomes",
                    name: content.aiAnalytics.outcomes.name,
                    displayTitle: "why this matters",
                    subtitle: content.aiAnalytics.outcomes.subtitle,
                    background: FRAME_BG[5],
                    badge: ["11", content.aiAnalytics.outcomes.badgeLabel],
                    build(frame, state) {
                        const block = state.content.aiAnalytics.outcomes;
                        createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
                        createStepBadge(frame, this.badge[0], this.badge[1]);
                        let ox = 120;
                        block.cards.slice(0, 5).forEach((card) => {
                            createOutcomeCard(frame, { x: ox, y: 282, w: 320, h: 332, title: card.title, body: card.body });
                            ox += 340;
                        });
                        createNoteBlock(frame, 120, 694, 880, 104, block.note);
                        createScreenshotZone(frame, 1040, 694, 760, 104, block.screenshot, state);
                    },
                },
            ],
        },
    ];
}
function countSelectedFrames(config) {
    return buildPageSpecs(DEFAULT_CONTENT).filter((page) => config.selectedPages.includes(page.id)).reduce((sum, page) => sum + page.frames.length, 0);
}
function countSelectedGroups(config) {
    return buildPageSpecs(DEFAULT_CONTENT).filter((page) => config.selectedPages.includes(page.id)).length;
}
async function clearGeneratedPages() {
    await figma.loadAllPagesAsync();
    const generatedPages = figma.root.children.filter((page) => {
        if (typeof page.getPluginData !== "function")
            return false;
        const isGenerated = page.getPluginData(PAGE_KEY) === "generated";
        const isPinnedBackup = /backup/i.test(page.name);
        return isGenerated && !isPinnedBackup;
    });
    if (generatedPages.length === 0)
        return;
    let safePage = figma.root.children.find((page) => typeof page.getPluginData === "function" && page.getPluginData(PAGE_KEY) !== "generated");
    let scratchPage = null;
    if (!safePage) {
        scratchPage = figma.createPage();
        scratchPage.name = "_moto_scratch_";
        safePage = scratchPage;
    }
    await figma.setCurrentPageAsync(safePage);
    for (const page of generatedPages) {
        page.remove();
    }
    if (scratchPage && scratchPage.children.length === 0) {
        scratchPage.remove();
    }
}
async function loadFonts(state) {
    const { fonts } = state.content.style;
    FONT_REGULAR.family = fonts.primaryFamily;
    FONT_REGULAR.style = fonts.regularStyle;
    FONT_SEMIBOLD.family = fonts.primaryFamily;
    FONT_SEMIBOLD.style = fonts.strongStyle;
    let regularSource = "primary";
    try {
        await figma.loadFontAsync(FONT_REGULAR);
    }
    catch {
        FONT_REGULAR.family = fonts.fallbackFamily;
        FONT_REGULAR.style = fonts.fallbackRegularStyle;
        await figma.loadFontAsync(FONT_REGULAR);
        regularSource = "fallback";
    }
    try {
        await figma.loadFontAsync(FONT_SEMIBOLD);
    }
    catch {
        if (regularSource === "primary") {
            FONT_SEMIBOLD.family = fonts.primaryFamily;
            FONT_SEMIBOLD.style = fonts.regularStyle;
            await figma.loadFontAsync(FONT_SEMIBOLD);
        }
        else {
            FONT_SEMIBOLD.family = fonts.fallbackFamily;
            FONT_SEMIBOLD.style = fonts.fallbackStrongStyle;
            try {
                await figma.loadFontAsync(FONT_SEMIBOLD);
            }
            catch {
                FONT_SEMIBOLD.style = fonts.fallbackRegularStyle;
                await figma.loadFontAsync(FONT_SEMIBOLD);
            }
        }
    }
}
function normalizeConfig(input) {
    const selectedPages = Array.isArray(input.selectedPages) ? input.selectedPages.filter(Boolean) : DEFAULT_CONFIG.selectedPages;
    return {
        boardTitle: (input.boardTitle || DEFAULT_CONFIG.boardTitle).trim() || DEFAULT_CONFIG.boardTitle,
        frameWidth: Number(input.frameWidth) || DEFAULT_CONFIG.frameWidth,
        frameHeight: Number(input.frameHeight) || DEFAULT_CONFIG.frameHeight,
        frameGap: Number(input.frameGap) || DEFAULT_CONFIG.frameGap,
        layoutMode: input.layoutMode === "per-page" ? "per-page" : DEFAULT_CONFIG.layoutMode,
        clearExisting: input.clearExisting ?? DEFAULT_CONFIG.clearExisting,
        includeScreenshots: input.includeScreenshots ?? DEFAULT_CONFIG.includeScreenshots,
        includeControlKit: input.includeControlKit ?? DEFAULT_CONFIG.includeControlKit,
        selectedPages: selectedPages.length > 0 ? selectedPages : DEFAULT_CONFIG.selectedPages,
    };
}
function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function deepMerge(base, override) {
    if (Array.isArray(base)) {
        return (Array.isArray(override) ? override : base);
    }
    if (isPlainObject(base)) {
        const source = isPlainObject(override) ? override : {};
        const merged = { ...base };
        for (const key of Object.keys(base)) {
            merged[key] = deepMerge(base[key], source[key]);
        }
        return merged;
    }
    return (override === undefined ? base : override);
}
function normalizeContent(raw) {
    if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        return deepMerge(DEFAULT_CONTENT, parsed);
    }
    return deepMerge(DEFAULT_CONTENT, raw);
}
async function generateBoard(state) {
    await loadFonts(state);
    if (state.config.clearExisting)
        await clearGeneratedPages();
    const createdPages = [];
    if (state.config.includeControlKit) {
        createControlKitPage(state);
        createdPages.push(figma.root.children[figma.root.children.length - 1]);
    }
    const selectedSpecs = buildPageSpecs(state.content).filter((page) => state.config.selectedPages.includes(page.id));
    if (state.config.layoutMode === "inline") {
        const page = figma.createPage();
        page.name = `${state.config.boardTitle} · App Flow Board`;
        page.setPluginData(PAGE_KEY, "generated");
        createdPages.push(page);
        await figma.setCurrentPageAsync(page);
        const marginX = 120;
        let y = 120;
        for (const pageSpec of selectedSpecs) {
            createText(figma.currentPage, pageSpec.name, marginX, y, 44, FONT_SEMIBOLD, PALETTE.black, { width: 960 });
            createText(figma.currentPage, `${pageSpec.frames.length} frame${pageSpec.frames.length === 1 ? "" : "s"}`, marginX, y + 52, 16, FONT_REGULAR, PALETTE.slate, { width: 420 });
            for (let i = 0; i < pageSpec.frames.length; i += 1) {
                const spec = pageSpec.frames[i];
                const x = marginX + i * (state.config.frameWidth + state.config.frameGap);
                const frame = createFrame(figma.currentPage, spec.name, x, y + 96, state.config.frameWidth, state.config.frameHeight, spec.background);
                frame.cornerRadius = 0;
                frame.clipsContent = true;
                frame.setPluginData(BOARD_KEY, "generated");
                spec.build(frame, state);
            }
            y += state.config.frameHeight + 216;
        }
    }
    else {
        for (const pageSpec of selectedSpecs) {
            const page = figma.createPage();
            page.name = `${state.config.boardTitle} · ${pageSpec.name}`;
            page.setPluginData(PAGE_KEY, "generated");
            createdPages.push(page);
            await figma.setCurrentPageAsync(page);
            for (let i = 0; i < pageSpec.frames.length; i += 1) {
                const spec = pageSpec.frames[i];
                const x = i * (state.config.frameWidth + state.config.frameGap);
                const frame = createFrame(figma.currentPage, spec.name, x, 0, state.config.frameWidth, state.config.frameHeight, spec.background);
                frame.cornerRadius = 0;
                frame.clipsContent = true;
                frame.setPluginData(BOARD_KEY, "generated");
                spec.build(frame, state);
            }
        }
    }
    if (createdPages.length > 0) {
        await figma.setCurrentPageAsync(createdPages[0]);
    }
}
figma.showUI(__html__, { width: 520, height: 760 });
figma.ui.onmessage = async (msg) => {
    if (msg?.type === "get-defaults") {
        figma.ui.postMessage({
            type: "defaults",
            defaults: DEFAULT_CONFIG,
            frameCount: countSelectedFrames(DEFAULT_CONFIG),
            contentJson: JSON.stringify(DEFAULT_CONTENT, null, 2),
        });
        return;
    }
    if (msg?.type !== "generate")
        return;
    try {
        const state = {
            config: normalizeConfig(msg.config || {}),
            content: normalizeContent(msg.contentJson || "{}"),
        };
        await generateBoard(state);
        const generatedPages = state.config.layoutMode === "inline" ? 1 : state.config.selectedPages.length;
        figma.ui.postMessage({
            type: "done",
            text: `Generated ${countSelectedFrames(state.config)} frames across ${countSelectedGroups(state.config)} selected groups on ${generatedPages} page${generatedPages === 1 ? "" : "s"}.`,
        });
        figma.closePlugin();
    }
    catch (error) {
        figma.ui.postMessage({
            type: "done",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
};
