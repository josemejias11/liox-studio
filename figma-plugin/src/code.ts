declare const figma: any;
declare const __html__: string;

const ACTIVE_FONTS = {
  regular: { family: "MotoSans", style: "Regular" } as FontName,
  strong: { family: "MotoSans", style: "Semi Bold" } as FontName,
};

const FONT_REGULAR = ACTIVE_FONTS.regular;
const FONT_SEMIBOLD = ACTIVE_FONTS.strong;
const DEFAULT_TYPE_SCALE = {
  display: 68,
  subtitle: 40,
  sectionLabel: 50,
  cardTitle: 30,
  detailTitle: 26,
  body: 20,
  secondary: 18,
  caption: 16,
  micro: 15,
};

function regularFont() {
  return ACTIVE_FONTS.regular;
}

function strongFont() {
  return ACTIVE_FONTS.strong;
}

function typeSize(state: BoardState, key: keyof BoardContent["style"]["typeScale"]) {
  return state.content.style.typeScale[key];
}

function typeSizeOrDefault(state: BoardState | undefined, key: keyof BoardContent["style"]["typeScale"]) {
  return state ? typeSize(state, key) : DEFAULT_TYPE_SCALE[key];
}

function getFrameLayout(state: BoardState, frameId: string) {
  return state.content.style.frameLayout[frameId] || {};
}

function hexToRgb(hex: string) {
  const c = hex.replace("#", "");
  return { r: parseInt(c.slice(0, 2), 16) / 255, g: parseInt(c.slice(2, 4), 16) / 255, b: parseInt(c.slice(4, 6), 16) / 255 };
}

function setSolidFill(node: any, color: string) {
  node.fills = [{ type: "SOLID", color: hexToRgb(color) }];
}

function setStroke(node: any, color: string, weight = 1) {
  node.strokes = [{ type: "SOLID", color: hexToRgb(color) }];
  node.strokeWeight = weight;
}

function createFrame(parent: any, name: string, x: number, y: number, w: number, h: number, fill = PALETTE.white) {
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

function createText(
  parent: any,
  text: string,
  x: number,
  y: number,
  size: number,
  font: FontName = regularFont(),
  color = PALETTE.black,
  opts: { width?: number; height?: number; align?: TextAlign; valign?: "TOP" | "CENTER" } = {},
) {
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
  } else {
    node.textAutoResize = "WIDTH_AND_HEIGHT";
  }
  if (opts.align) node.textAlignHorizontal = opts.align;
  if (opts.height) node.resize(opts.width || node.width, Math.max(opts.height, node.height));
  if (opts.valign === "CENTER" && opts.height) {
    node.y = y + Math.round((opts.height - node.height) / 2);
  } else {
    node.y = y;
  }
  node.x = x;
  return node;
}

function createHeader(frame: any, title: string, subtitle: string, state: BoardState, frameId: string) {
  const layout = getFrameLayout(state, frameId);
  const align: TextAlign = layout.headerAlign === "center" ? "CENTER" : "LEFT";
  const titleWidth = layout.titleWidth || (align === "CENTER" ? 1440 : 1280);
  const subtitleWidth = layout.subtitleWidth || (align === "CENTER" ? 1480 : 1220);
  const titleX = align === "CENTER" ? Math.round((state.config.frameWidth - titleWidth) / 2) : 120;
  const subtitleX = align === "CENTER" ? Math.round((state.config.frameWidth - subtitleWidth) / 2) : 120;
  createText(frame, title, titleX, 82, typeSize(state, "display"), strongFont(), PALETTE.black, { width: titleWidth, align });
  createText(frame, subtitle, subtitleX, 162, typeSize(state, "subtitle"), regularFont(), PALETTE.slate, { width: subtitleWidth, align });
  createChip(frame, 1508, 78, 292, 44, state.config.boardTitle, 16, true);
}

function createSectionLabel(frame: any, text: string, x: number, y: number, state: BoardState, size?: number) {
  createText(frame, text, x, y, size || typeSize(state, "sectionLabel"), strongFont(), PALETTE.indigo);
}

function createStepBadge(frame: any, number: string, label: string) {
  const badge = createFrame(frame, `step-${number}`, 120, 24, 88, 34, PALETTE.indigo);
  badge.cornerRadius = 17;
  createText(badge, number, 0, 0, 18, FONT_SEMIBOLD, PALETTE.white, { width: 88, height: 34, align: "CENTER", valign: "CENTER" });
  createText(frame, label, 220, 28, 14, FONT_REGULAR, PALETTE.slate);
}

function createInfoCard(frame: any, card: { x: number; y: number; w: number; h: number; title: string; body: string }, state?: BoardState) {
  const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  setStroke(container, PALETTE.border, 1);
  createText(container, card.title, 30, 26, typeSizeOrDefault(state, "cardTitle"), FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 60 });
  createText(container, card.body, 30, 84, typeSizeOrDefault(state, "body"), FONT_REGULAR, PALETTE.slate, { width: card.w - 60 });
  return container;
}

function createDetailCard(frame: any, card: { x: number; y: number; w: number; h: number; title: string; body: string }, state?: BoardState) {
  const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  setStroke(container, PALETTE.border, 1);
  createText(container, card.title, 28, 22, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 56 });
  createText(container, card.body, 28, 68, typeSizeOrDefault(state, "secondary"), FONT_REGULAR, PALETTE.slate, { width: card.w - 56 });
  return container;
}

function createChip(frame: any, x: number, y: number, w: number, h: number, text: string, size = 18, centered = false) {
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

function createJourneyStop(frame: any, x: number, y: number, number: string, title: string, state?: BoardState) {
  const badge = createFrame(frame, number, x + 74, y, 60, 60, PALETTE.indigo);
  badge.cornerRadius = 30;
  createText(badge, number, 0, 0, 28, FONT_SEMIBOLD, PALETTE.white, { width: 60, height: 60, align: "CENTER", valign: "CENTER" });
  createText(frame, title, x, y + 92, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: 208, align: "CENTER" });
}

function createConnector(frame: any, x: number, y: number, w: number) {
  const line = createFrame(frame, "connector", x, y, w, 4, PALETTE.indigoSoft);
  line.cornerRadius = 2;
}

function createFeaturePill(frame: any, x: number, y: number, w: number, h: number, text: string, state?: BoardState) {
  const pill = createFrame(frame, text, x, y, w, h, PALETTE.white);
  pill.cornerRadius = 16;
  setStroke(pill, PALETTE.border, 1);
  createText(pill, text, 18, 0, typeSizeOrDefault(state, "secondary"), FONT_REGULAR, PALETTE.black, { width: w - 36, height: h, valign: "CENTER" });
}

function createMiniFlowNode(frame: any, card: { x: number; y: number; w: number; h: number; label: string }, state?: BoardState) {
  const node = createFrame(frame, card.label, card.x, card.y, card.w, card.h, PALETTE.white);
  node.cornerRadius = 14;
  setStroke(node, PALETTE.indigo, 1);
  createText(node, card.label, 10, 0, typeSizeOrDefault(state, "micro"), FONT_SEMIBOLD, PALETTE.indigo, {
    width: card.w - 20,
    height: card.h,
    align: "CENTER",
    valign: "CENTER",
  });
  return node;
}

function createLessonScreenCard(
  frame: any,
  card: { x: number; y: number; w: number; h: number; label: string; accent?: string; tone?: string; dense?: boolean },
  state?: BoardState,
) {
  const shell = createFrame(frame, `${card.label} screen`, card.x, card.y, card.w, card.h, PALETTE.white);
  shell.cornerRadius = 16;
  setStroke(shell, PALETTE.border, 1);

  const topBar = createFrame(shell, "top-bar", 0, 0, card.w, 14, card.tone || PALETTE.frost);
  topBar.cornerRadius = 0;
  const avatar = createFrame(shell, "avatar", 16, 28, 34, 34, PALETTE.indigoSoft);
  avatar.cornerRadius = 17;
  const titleBar = createFrame(shell, "title-bar", 62, 34, card.w - 84, 10, card.accent || PALETTE.indigoSoft);
  titleBar.cornerRadius = 5;
  const detailBar = createFrame(shell, "detail-bar", 62, 52, Math.max(54, card.w - 114), 8, PALETTE.frost);
  detailBar.cornerRadius = 4;
  const bottomBar = createFrame(shell, "bottom-bar", 18, card.h - 18, card.w - 36, 6, card.accent || PALETTE.indigoSoft);
  bottomBar.cornerRadius = 3;
  if (card.dense) {
    for (let index = 0; index < 3; index += 1) {
      const row = createFrame(shell, `row-${index}`, 16, 80 + index * 28, card.w - 32, 18, PALETTE.white);
      row.cornerRadius = 9;
      setStroke(row, PALETTE.border, 1);
    }
  }

  createText(shell, card.label, 14, card.dense ? card.h - 54 : card.h - 46, typeSizeOrDefault(state, "micro"), FONT_SEMIBOLD, PALETTE.indigo, {
    width: card.w - 28,
    height: 24,
    align: "CENTER",
  });

  return shell;
}

function createLessonConnector(frame: any, fromX: number, fromY: number, toX: number, toY: number) {
  if (fromY === toY) {
    const width = Math.max(12, toX - fromX);
    const line = createFrame(frame, "lesson-connector", fromX, fromY, width, 3, PALETTE.indigo);
    line.cornerRadius = 2;
    createText(frame, "→", fromX + width - 4, fromY - 10, 20, FONT_SEMIBOLD, PALETTE.indigo);
    return;
  }

  const elbowX = Math.round((fromX + toX) / 2);
  const topY = Math.min(fromY, toY);
  const leftX = Math.min(fromX, elbowX);
  const horizontalA = createFrame(frame, "lesson-connector-a", leftX, fromY, Math.abs(elbowX - fromX), 3, PALETTE.indigo);
  horizontalA.cornerRadius = 2;
  const vertical = createFrame(frame, "lesson-connector-b", elbowX, topY, 3, Math.abs(toY - fromY), PALETTE.indigo);
  vertical.cornerRadius = 2;
  const horizontalB = createFrame(frame, "lesson-connector-c", Math.min(elbowX, toX), toY, Math.abs(toX - elbowX), 3, PALETTE.indigo);
  horizontalB.cornerRadius = 2;
  createText(frame, "→", toX - 4, toY - 10, 20, FONT_SEMIBOLD, PALETTE.indigo);
}

function createLessonFlowCluster(
  frame: any,
  card: { x: number; y: number; w: number; h: number; title: string; summary: string; steps: { label: string }[]; result: string; number: string },
  state: BoardState,
) {
  const cluster = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  cluster.cornerRadius = 22;
  setStroke(cluster, PALETTE.border, 1);

  const badge = createFrame(cluster, `${card.number}`, 18, 18, 46, 46, PALETTE.indigo);
  badge.cornerRadius = 23;
  createText(badge, card.number, 0, 0, 22, FONT_SEMIBOLD, PALETTE.white, { width: 46, height: 46, align: "CENTER", valign: "CENTER" });
  createText(cluster, card.title, 78, 18, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: card.w - 96 });
  createText(cluster, card.summary, 78, 52, typeSizeOrDefault(state, "micro"), FONT_REGULAR, PALETTE.slate, { width: card.w - 104 });

  const screens = [
    { x: 22, y: 120, w: 128, h: 188, label: card.steps[0]?.label || "Start", accent: PALETTE.indigo, tone: PALETTE.indigoSoft },
    { x: 190, y: 84, w: 144, h: 218, label: card.steps[1]?.label || "Explore", accent: PALETTE.indigo, tone: PALETTE.pearl, dense: true },
    { x: 366, y: 130, w: 128, h: 188, label: card.steps[2]?.label || "Complete", accent: PALETTE.indigo, tone: PALETTE.indigoSoft },
    { x: 186, y: 350, w: 152, h: 204, label: "Outcome", accent: PALETTE.indigo, tone: PALETTE.pearl, dense: true },
  ];

  createLessonScreenCard(cluster, screens[0], state);
  createLessonScreenCard(cluster, screens[1], state);
  createLessonScreenCard(cluster, screens[2], state);
  createLessonScreenCard(cluster, screens[3], state);

  createLessonConnector(cluster, screens[0].x + screens[0].w, screens[0].y + 82, screens[1].x, screens[1].y + 82);
  createLessonConnector(cluster, screens[1].x + screens[1].w, screens[1].y + 100, screens[2].x, screens[2].y + 100);
  createLessonConnector(cluster, screens[1].x + 72, screens[1].y + screens[1].h, screens[3].x + 72, screens[3].y);
  createLessonConnector(cluster, screens[2].x + 64, screens[2].y + screens[2].h, screens[3].x + 112, screens[3].y + 24);

  const note = createFrame(cluster, "result-note", 24, 574, card.w - 48, 72, PALETTE.indigoSoft);
  note.cornerRadius = 16;
  setStroke(note, PALETTE.indigo, 1);
  createText(note, card.result, 18, 12, typeSizeOrDefault(state, "caption"), FONT_REGULAR, PALETTE.slate, { width: card.w - 84 });

  return cluster;
}

function createJourneyScreenNode(
  frame: any,
  card: { x: number; y: number; w: number; h: number; title: string; route: string; accent?: string; tone?: string; dense?: boolean },
  state: BoardState,
) {
  const shell = createLessonScreenCard(
    frame,
    { x: card.x, y: card.y, w: card.w, h: card.h, label: card.title, accent: card.accent, tone: card.tone, dense: card.dense },
    state,
  );
  createText(shell, card.route, 12, 18, 11, FONT_SEMIBOLD, PALETTE.slate, { width: card.w - 24, align: "CENTER" });
  return shell;
}

function createJourneyMapCluster(
  frame: any,
  card: { x: number; y: number; w: number; h: number; title: string; summary: string; screens: ScreenCard[]; number: string; tone?: string },
  state: BoardState,
) {
  const cluster = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  cluster.cornerRadius = 22;
  setStroke(cluster, PALETTE.border, 1);

  const badge = createFrame(cluster, `${card.number}`, 18, 18, 46, 46, PALETTE.indigo);
  badge.cornerRadius = 23;
  createText(badge, card.number, 0, 0, 22, FONT_SEMIBOLD, PALETTE.white, { width: 46, height: 46, align: "CENTER", valign: "CENTER" });
  createText(cluster, card.title, 78, 18, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: card.w - 96 });
  createText(cluster, card.summary, 78, 52, typeSizeOrDefault(state, "micro"), FONT_REGULAR, PALETTE.slate, { width: card.w - 100 });

  const coords = [
    { x: 24, y: 132, w: 132, h: 194 },
    { x: 190, y: 88, w: 148, h: 224 },
    { x: 370, y: 132, w: 132, h: 194 },
    { x: 196, y: 368, w: 148, h: 208 },
  ];

  card.screens.slice(0, 4).forEach((screen, index) => {
    const slot = coords[index];
    if (!slot) return;
    createJourneyScreenNode(
      cluster,
      {
        ...slot,
        title: screen.title,
        route: screen.route,
        accent: PALETTE.indigo,
        tone: index === 1 ? PALETTE.pearl : card.tone || PALETTE.indigoSoft,
        dense: index !== 0,
      },
      state,
    );
  });

  if (card.screens.length > 1) {
    createLessonConnector(cluster, coords[0].x + coords[0].w, coords[0].y + 84, coords[1].x, coords[1].y + 84);
    createLessonConnector(cluster, coords[1].x + coords[1].w, coords[1].y + 104, coords[2].x, coords[2].y + 104);
  }
  if (card.screens.length > 3) {
    createLessonConnector(cluster, coords[1].x + 74, coords[1].y + coords[1].h, coords[3].x + 74, coords[3].y);
    createLessonConnector(cluster, coords[2].x + 66, coords[2].y + coords[2].h, coords[3].x + 114, coords[3].y + 22);
  }

  const lastScreen = card.screens[Math.min(3, card.screens.length - 1)];
  if (lastScreen?.note) {
    const note = createFrame(cluster, "journey-note", 24, 600, card.w - 48, 64, PALETTE.indigoSoft);
    note.cornerRadius = 16;
    setStroke(note, PALETTE.indigo, 1);
    createText(note, lastScreen.note, 18, 12, typeSizeOrDefault(state, "caption"), FONT_REGULAR, PALETTE.slate, { width: card.w - 84 });
  }

  return cluster;
}

function createSystemFlowCluster(
  frame: any,
  card: { x: number; y: number; w: number; h: number; title: string; summary: string; nodes: string[]; note: string; number: string; tone?: string },
  state: BoardState,
) {
  const cluster = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  cluster.cornerRadius = 22;
  setStroke(cluster, PALETTE.border, 1);

  const badge = createFrame(cluster, `${card.number}`, 18, 18, 46, 46, PALETTE.indigo);
  badge.cornerRadius = 23;
  createText(badge, card.number, 0, 0, 22, FONT_SEMIBOLD, PALETTE.white, { width: 46, height: 46, align: "CENTER", valign: "CENTER" });
  createText(cluster, card.title, 78, 18, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: card.w - 96 });
  createText(cluster, card.summary, 78, 52, typeSizeOrDefault(state, "micro"), FONT_REGULAR, PALETTE.slate, { width: card.w - 100 });

  const coords = [
    { x: 22, y: 126, w: 124, h: 182 },
    { x: 178, y: 86, w: 144, h: 214 },
    { x: 354, y: 126, w: 124, h: 182 },
    { x: 178, y: 342, w: 144, h: 196 },
  ];

  card.nodes.slice(0, 4).forEach((node, index) => {
    const slot = coords[index];
    if (!slot) return;
    createLessonScreenCard(
      cluster,
      {
        ...slot,
        label: node,
        accent: PALETTE.indigo,
        tone: index === 1 ? PALETTE.pearl : card.tone || PALETTE.indigoSoft,
        dense: index > 0,
      },
      state,
    );
  });

  if (card.nodes.length > 1) {
    createLessonConnector(cluster, coords[0].x + coords[0].w, coords[0].y + 84, coords[1].x, coords[1].y + 84);
    createLessonConnector(cluster, coords[1].x + coords[1].w, coords[1].y + 98, coords[2].x, coords[2].y + 98);
  }
  if (card.nodes.length > 3) {
    createLessonConnector(cluster, coords[1].x + 72, coords[1].y + coords[1].h, coords[3].x + 72, coords[3].y);
    createLessonConnector(cluster, coords[2].x + 62, coords[2].y + coords[2].h, coords[3].x + 108, coords[3].y + 18);
  }

  const note = createFrame(cluster, "system-note", 24, 570, card.w - 48, 72, PALETTE.indigoSoft);
  note.cornerRadius = 16;
  setStroke(note, PALETTE.indigo, 1);
  createText(note, card.note, 18, 12, typeSizeOrDefault(state, "caption"), FONT_REGULAR, PALETTE.slate, { width: card.w - 84 });

  return cluster;
}

function createOutcomePillar(
  frame: any,
  card: { x: number; y: number; w: number; h: number; title: string; body: string; number: string; tone?: string },
  state: BoardState,
) {
  const pillar = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  pillar.cornerRadius = 20;
  setStroke(pillar, PALETTE.border, 1);

  const badge = createFrame(pillar, `${card.number}`, 22, 22, 42, 42, card.tone || PALETTE.indigoSoft);
  badge.cornerRadius = 21;
  createText(badge, card.number, 0, 0, 20, FONT_SEMIBOLD, PALETTE.indigo, { width: 42, height: 42, align: "CENTER", valign: "CENTER" });
  createText(pillar, card.title, 22, 86, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: card.w - 44 });
  createText(pillar, card.body, 22, 130, typeSizeOrDefault(state, "secondary"), FONT_REGULAR, PALETTE.slate, { width: card.w - 44 });
  const base = createFrame(pillar, "pillar-base", 22, card.h - 20, card.w - 44, 6, PALETTE.indigoSoft);
  base.cornerRadius = 3;
  return pillar;
}

function createProcessRow(frame: any, row: { x: number; y: number; w: number; h: number; number: string; title: string; body?: string }, state?: BoardState) {
  const container = createFrame(frame, row.title, row.x, row.y, row.w, row.h, PALETTE.white);
  setStroke(container, PALETTE.border, 1);
  const badge = createFrame(container, row.number, 26, 22, 58, 58, PALETTE.indigo);
  badge.cornerRadius = 29;
  createText(badge, row.number, 0, 0, 28, FONT_SEMIBOLD, PALETTE.white, { width: 58, height: 58, align: "CENTER", valign: "CENTER" });
  if (row.body) {
    createText(container, row.title, 112, 14, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: row.w - 140 });
    createText(container, row.body, 112, 42, typeSizeOrDefault(state, "secondary"), FONT_REGULAR, PALETTE.slate, { width: row.w - 140 });
  } else {
    createText(container, row.title, 112, 0, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: row.w - 140, height: row.h, valign: "CENTER" });
  }
}

function createArchitectureStepRow(frame: any, row: { x: number; y: number; w: number; h: number; number: string; title: string; body: string }, state?: BoardState) {
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

  createText(container, row.title, 96, 14, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: row.w - 124 });
  createText(container, row.body, 96, 42, typeSizeOrDefault(state, "secondary"), FONT_REGULAR, PALETTE.slate, { width: row.w - 124 });
}

function createOutcomeCard(frame: any, card: { x: number; y: number; w: number; h: number; title: string; body: string }, state?: BoardState) {
  const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  setStroke(container, PALETTE.border, 1);
  const icon = createFrame(container, "icon", 28, 28, 52, 52, PALETTE.indigoSoft);
  icon.cornerRadius = 16;
  createText(icon, "★", 0, 0, 24, FONT_REGULAR, PALETTE.indigo, { width: 52, height: 52, align: "CENTER", valign: "CENTER" });
  createText(container, card.title, 28, 104, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.black, { width: card.w - 56 });
  createText(container, card.body, 28, 150, typeSizeOrDefault(state, "secondary"), FONT_REGULAR, PALETTE.slate, { width: card.w - 56 });
}

function createNoteBlock(frame: any, x: number, y: number, w: number, h: number, text: string) {
  const note = createFrame(frame, "note", x, y, w, h, PALETTE.white);
  note.cornerRadius = 14;
  setStroke(note, PALETTE.indigo, 1);
  createText(note, text, 28, 0, 19, FONT_SEMIBOLD, PALETTE.indigo, {
    width: w - 56,
    height: h - 8,
    valign: "CENTER",
  });
}

function createScreenshotZone(frame: any, x: number, y: number, w: number, h: number, label: string, state: BoardState) {
  if (!state.config.includeScreenshots) return;
  const zone = createFrame(frame, `[screenshot] ${label}`, x, y, w, h, PALETTE.indigoSoft);
  zone.cornerRadius = 16;
  setStroke(zone, PALETTE.border, 1);
  const topBar = createFrame(zone, "screenshot-top-bar", 0, 0, w, 18, PALETTE.pearl);
  topBar.cornerRadius = 0;
  const stage = createFrame(zone, "screenshot-stage", 18, 36, w - 36, Math.max(48, h - 90), PALETTE.white);
  stage.cornerRadius = 12;
  setStroke(stage, PALETTE.border, 1);
  const hero = createFrame(stage, "screenshot-hero", 14, 16, stage.width - 28, Math.max(18, Math.round((stage.height - 58) * 0.42)), PALETTE.frost);
  hero.cornerRadius = 10;
  const rowWidth = stage.width - 42;
  [0, 1, 2].forEach((index) => {
    const line = createFrame(stage, `screenshot-line-${index}`, 14, hero.y + hero.height + 14 + index * 18, Math.max(48, rowWidth - index * 18), 8, PALETTE.indigoSoft);
    line.cornerRadius = 4;
  });
  createText(zone, label, 18, h - 34, 13, FONT_SEMIBOLD, PALETTE.indigo, {
    width: w - 36,
    align: "CENTER",
  });
}

function createFlowNode(frame: any, node: { label: string; x: number; y: number; w: number; h: number; color?: string }) {
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

function createFlowArrow(frame: any, x: number, y: number, w: number) {
  const line = createFrame(frame, "flow-arrow", x, y, w, 3, PALETTE.indigo);
  line.cornerRadius = 2;
  createText(frame, "→", x + w, y - 8, 22, FONT_SEMIBOLD, PALETTE.indigo);
}

function createPlayerShell(frame: any, title: string, progressLabel: string) {
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

function createStudioShell(frame: any, layoutTitle: string, sidebarItems: string[]) {
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

function createSimulatedCourseCards(frame: any, title: string, items: string[]) {
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

function createBulletList(frame: any, items: string[], x: number, y: number, width: number, size: number, gap: number, color = PALETTE.slate) {
  let cy = y;
  items.forEach((item) => {
    createText(frame, `• ${item}`, x, cy, size, FONT_REGULAR, color, { width });
    cy += gap;
  });
}

function createLabelValueCard(frame: any, card: { x: number; y: number; w: number; h: number; title: string; body: string }, state?: BoardState) {
  const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.indigoSoft);
  container.cornerRadius = 12;
  setStroke(container, PALETTE.indigo, 1);
  createText(container, card.title, 18, 10, typeSizeOrDefault(state, "secondary"), FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 36 });
  createText(container, card.body, 18, 38, typeSizeOrDefault(state, "caption"), FONT_REGULAR, PALETTE.slate, { width: card.w - 36 });
  return container;
}

function createMetricListCard(frame: any, x: number, y: number, w: number, h: number, title: string, items: string[], state?: BoardState) {
  const card = createFrame(frame, title, x, y, w, h, PALETTE.white);
  card.cornerRadius = 16;
  setStroke(card, PALETTE.border, 1);
  createText(card, title, 24, 22, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.indigo, { width: w - 48 });
  let cy = 64;
  items.forEach((item) => {
    createText(card, `• ${item}`, 24, cy, typeSizeOrDefault(state, "secondary"), FONT_REGULAR, PALETTE.slate, { width: w - 48 });
    cy += 34;
  });
  return card;
}

function createSupportCard(frame: any, card: { x: number; y: number; w: number; h: number; title: string; body: string }, state?: BoardState) {
  const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  container.cornerRadius = 16;
  setStroke(container, PALETTE.border, 1);
  createText(container, card.title, 24, 20, typeSizeOrDefault(state, "detailTitle"), FONT_SEMIBOLD, PALETTE.indigo, { width: card.w - 48 });
  createText(container, card.body, 24, 52, typeSizeOrDefault(state, "caption"), FONT_REGULAR, PALETTE.slate, { width: card.w - 48 });
  return container;
}

function createScreenFlowCard(
  frame: any,
  card: { x: number; y: number; w: number; h: number; title: string; route: string; screenshot: string; note?: string },
  state: BoardState,
) {
  const container = createFrame(frame, card.title, card.x, card.y, card.w, card.h, PALETTE.white);
  container.cornerRadius = 18;
  setStroke(container, PALETTE.border, 1);

  const bar = createFrame(container, `${card.title}-bar`, 0, 0, card.w, 34, PALETTE.frost);
  bar.cornerRadius = 0;
  createText(bar, card.route, 16, 9, typeSizeOrDefault(state, "micro"), FONT_SEMIBOLD, PALETTE.slate, { width: card.w - 32 });

  createText(container, card.title, 18, 48, typeSizeOrDefault(state, "secondary"), FONT_SEMIBOLD, PALETTE.black, { width: card.w - 36 });
  createScreenshotZone(container, 18, 82, card.w - 36, 114, card.screenshot, state);
  if (card.note) {
    createText(container, card.note, 18, 210, typeSizeOrDefault(state, "micro"), FONT_REGULAR, PALETTE.slate, { width: card.w - 36 });
  }

  return container;
}

function createCompactNotesCard(frame: any, x: number, y: number, w: number, h: number, title: string, items: string[], state?: BoardState) {
  const card = createFrame(frame, title, x, y, w, h, PALETTE.white);
  card.cornerRadius = 16;
  setStroke(card, PALETTE.border, 1);
  createText(card, title, 24, 20, typeSizeOrDefault(state, "secondary"), FONT_SEMIBOLD, PALETTE.indigo, { width: w - 48 });
  const columnWidth = Math.floor((w - 72) / 2);
  items.slice(0, 4).forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    createText(card, `• ${item}`, 24 + col * (columnWidth + 24), 54 + row * 28, typeSizeOrDefault(state, "micro"), FONT_REGULAR, PALETTE.slate, {
      width: columnWidth,
    });
  });
  return card;
}

function createControlKitPage(state: BoardState) {
  const page = figma.createPage();
  page.name = `${state.config.boardTitle} · Moto Control Kit`;
  page.setPluginData(PAGE_KEY, "generated");

  const root = createFrame(page, "Moto Control Kit", 120, 120, 2240, 1680, "#F7F5F1");
  root.cornerRadius = 24;
  setStroke(root, PALETTE.border, 1);

  createText(root, "MOTO BOARD SYSTEM", 72, 64, 13, FONT_SEMIBOLD, PALETTE.indigo);
  createText(root, "Moto Control Kit", 72, 92, 44, FONT_SEMIBOLD, PALETTE.black);
  createText(
    root,
    "Editable board primitives for the Moto Tutor AI presentation flow. Duplicate these blocks or use them as the MCP write target instead of rebuilding full pages every time.",
    72,
    152,
    18,
    FONT_REGULAR,
    PALETTE.slate,
    { width: 920 },
  );

  const palette = createFrame(root, "Palette", 72, 260, 1008, 288, PALETTE.white);
  palette.cornerRadius = 20;
  setStroke(palette, PALETTE.border, 1);
  createText(palette, "Core Palette", 28, 24, 24, FONT_SEMIBOLD, PALETTE.black);
  createText(
    palette,
    "These colors match the current Moto presentation generator and give you a stable edit surface in Figma.",
    28,
    58,
    14,
    FONT_REGULAR,
    PALETTE.slate,
    { width: 520 },
  );

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
    if (hex !== PALETTE.black) setStroke(swatch, PALETTE.border, 1);
    createText(swatch, String(label), 16, 11, 14, FONT_SEMIBOLD, hex === PALETTE.black ? PALETTE.white : PALETTE.black);
    createText(swatch, String(hex), 16, 29, 12, FONT_REGULAR, hex === PALETTE.black ? PALETTE.white : PALETTE.slate);
  });

  const typography = createFrame(root, "Typography", 1112, 260, 1056, 288, PALETTE.white);
  typography.cornerRadius = 20;
  setStroke(typography, PALETTE.border, 1);
  createText(typography, "Typography", 28, 24, 24, FONT_SEMIBOLD, PALETTE.black);
  createText(
    typography,
    `${state.content.style.fonts.primaryFamily} is the preferred board face. ${state.content.style.fonts.fallbackFamily} is only used as the editable fallback when the primary font is unavailable in Figma.`,
    28,
    58,
    14,
    FONT_REGULAR,
    PALETTE.slate,
    { width: 540 },
  );
  createText(typography, `Display / ${state.content.style.typeScale.display} ${state.content.style.fonts.strongStyle}`, 28, 116, 44, FONT_SEMIBOLD, PALETTE.black);
  createText(typography, `Heading / ${state.content.style.typeScale.detailTitle} ${state.content.style.fonts.strongStyle}`, 28, 184, 24, FONT_SEMIBOLD, PALETTE.black);
  createText(
    typography,
    `Body / ${state.content.style.typeScale.secondary} ${state.content.style.fonts.regularStyle}. Use this for operational descriptions, architecture callouts, and slide support copy.`,
    28,
    226,
    16,
    FONT_REGULAR,
    PALETTE.slate,
    { width: 760 },
  );

  const blocks = createFrame(root, "Reusable Blocks", 72, 588, 2096, 520, PALETTE.white);
  blocks.cornerRadius = 20;
  setStroke(blocks, PALETTE.border, 1);
  createText(blocks, "Reusable Blocks", 28, 24, 24, FONT_SEMIBOLD, PALETTE.black);
  createText(
    blocks,
    "These are intentionally simple editable primitives rather than locked components, so Codex and Figma edits stay frictionless.",
    28,
    58,
    14,
    FONT_REGULAR,
    PALETTE.slate,
    { width: 780 },
  );

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
  createText(
    infoCard,
    "Use this block for architecture explanations, feature summaries, or business outcomes. Duplicate and rewrite instead of redrawing.",
    24,
    72,
    16,
    FONT_REGULAR,
    PALETTE.slate,
    { width: 472 },
  );

  const flowCard = createFrame(blocks, "Flow Node", 972, 116, 280, 160, PALETTE.white);
  flowCard.cornerRadius = 16;
  setStroke(flowCard, PALETTE.indigo, 2);
  createText(flowCard, "Deliver", 92, 46, 24, FONT_SEMIBOLD, PALETTE.indigo);
  createText(flowCard, "Interactive Learning", 36, 82, 20, FONT_SEMIBOLD, PALETTE.indigo, { width: 208 });

  const screenshotCard = createFrame(blocks, "Screenshot Placeholder", 1284, 116, 784, 220, PALETTE.indigoSoft);
  screenshotCard.cornerRadius = 16;
  screenshotCard.dashPattern = [10, 6];
  setStroke(screenshotCard, PALETTE.indigo, 2);
  createText(
    screenshotCard,
    "[Screenshot: Learner Player - Hotspot Lesson]",
    0,
    0,
    20,
    FONT_SEMIBOLD,
    PALETTE.indigo,
    { width: 784, height: 220, align: "CENTER", valign: "CENTER" },
  );

  const shellSection = createFrame(root, "Slide Shell", 72, 1140, 2096, 452, PALETTE.white);
  shellSection.cornerRadius = 20;
  setStroke(shellSection, PALETTE.border, 1);
  createText(shellSection, "16:9 Slide Shell", 28, 24, 24, FONT_SEMIBOLD, PALETTE.black);
  createText(
    shellSection,
    "Use this frame as the safest edit target when you want the file to stay clean and manually editable.",
    28,
    58,
    14,
    FONT_REGULAR,
    PALETTE.slate,
    { width: 720 },
  );

  const shell = createFrame(shellSection, "Editable Slide", 28, 104, 1600, 300, PALETTE.frost);
  shell.cornerRadius = 0;
  createText(shell, "STEP 1", 42, 28, 14, FONT_SEMIBOLD, PALETTE.indigo);
  createText(shell, "What Moto Tutor AI Is", 42, 58, 54, FONT_SEMIBOLD, PALETTE.black);
  createText(
    shell,
    "A reusable shell for the current board generator. Replace title, body, blocks, and placeholders without having to regenerate the entire document.",
    42,
    126,
    20,
    FONT_REGULAR,
    PALETTE.slate,
    { width: 920 },
  );

  ["CMS-Driven Authoring", "Interactive Learner Experience", "Grounded AI + Analytics"].forEach((label, index) => {
    const card = createFrame(shell, `Shell Card ${index + 1}`, 42 + index * 334, 198, 316, 72, PALETTE.white);
    card.cornerRadius = 12;
    setStroke(card, PALETTE.border, 1);
    createText(card, label, 18, 18, 18, FONT_SEMIBOLD, PALETTE.indigo, { width: 280 });
  });
}

function buildLessonGalleryFrames(content: BoardContent["content"]["lessonGallery"]): FrameSpec[] {
  const lessonGroups = [
    content.lessons.slice(0, 3),
    content.lessons.slice(3, 6),
    content.lessons.slice(6, 9),
  ].filter((group) => group.length > 0);

  return lessonGroups.map((lessons, groupIndex) => ({
    id: `content.lessonGallery.${groupIndex + 1}`,
    name: groupIndex === 0 ? content.name : `${content.name} ${groupIndex + 1}`,
    displayTitle: "lesson type flow map",
    subtitle: groupIndex === 0 ? content.subtitle : "Repeatable screen-map format applied across every lesson type",
    background: FRAME_BG[4],
    badge: ["5", content.badgeLabel],
    build(frame, state) {
      createHeader(frame, this.displayTitle || this.name, this.subtitle, state, this.id);
      createStepBadge(frame, this.badge[0], this.badge[1]);
      createSectionLabel(frame, `Set ${groupIndex + 1}`, 120, 212, state, 18);
      lessons.forEach((lesson, lessonIndex) => {
        createLessonFlowCluster(
          frame,
          {
            x: 120 + lessonIndex * 560,
            y: 244,
            w: 520,
            h: 674,
            title: lesson.title,
            summary: lesson.summary,
            steps: lesson.steps,
            result: lesson.result,
            number: String(groupIndex * 3 + lessonIndex + 1),
          },
          state,
        );
      });
    },
  }));
}

function buildPageSpecs(content: BoardContent): PageSpec[] {
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
              createInfoCard(frame, { x, y: 274, w: 520, h: 214, title: card.title, body: card.body }, state);
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
              createDetailCard(frame, { x: dx, y: 584, w: 428, h: 224, title: card.title, body: card.body }, state);
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
              createProcessRow(frame, { x: 140, y, w: 680, h: 98, number: String(index + 1), title: step }, state);
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
              if (index < 3) createFlowArrow(frame, x + 220, 340, 70);
              createLabelValueCard(frame, { x, y: 430, w: 220, h: 138, title: "Stage Detail", body: item.detail || "" }, state);
            });
            createSectionLabel(frame, block.keyDetailsLabel, 120, 606, state, 18);
            createMetricListCard(frame, 120, 638, 840, 238, block.keyDetailsLabel, block.keyDetails.slice(0, 4), state);
            block.screenshots.slice(0, 3).forEach((label, index) => createScreenshotZone(frame, 1000 + index * 270, 638 + Math.floor(index / 2) * 262, 250, 238, label, state));
          },
        },
        ...buildLessonGalleryFrames(content.content.lessonGallery),
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
            createSectionLabel(frame, block.authoringLabel, 120, 214, state, 18);
            createJourneyMapCluster(
              frame,
              {
                x: 120,
                y: 244,
                w: 520,
                h: 682,
                title: block.authoringLabel,
                summary: "Studio states that define and publish the learner experience.",
                screens: block.authoringScreens.slice(0, 3),
                number: "1",
                tone: PALETTE.indigoSoft,
              },
              state,
            );

            createLabelValueCard(frame, {
              x: 700,
              y: 450,
              w: 520,
              h: 166,
              title: block.transitionLabel,
              body: block.transitionBody,
            }, state);
            createFlowArrow(frame, 640, 536, 40);
            createFlowArrow(frame, 1220, 536, 40);

            createSectionLabel(frame, block.learnerLabel, 1280, 214, state, 18);
            createJourneyMapCluster(
              frame,
              {
                x: 1280,
                y: 244,
                w: 520,
                h: 682,
                title: block.learnerLabel,
                summary: "Player states that the learner actually experiences in sequence.",
                screens: [block.learnerScreens[0], block.learnerScreens[1], block.learnerScreens[2], block.learnerScreens[4]].filter(Boolean),
                number: "2",
                tone: PALETTE.pearl,
              },
              state,
            );

            createCompactNotesCard(frame, 120, 948, 1680, 92, block.notesLabel, block.notes.slice(0, 4), state);
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

            createSupportCard(frame, { x: 1290, y: 436, w: 510, h: 100, title: block.supportCards[0].title, body: block.supportCards[0].body }, state);
            createSupportCard(frame, { x: 1290, y: 550, w: 510, h: 100, title: block.supportCards[1].title, body: block.supportCards[1].body }, state);

            createMetricListCard(frame, 120, 706, 820, 264, block.panelLabel, block.panelItems.slice(0, 4), state);
            createMetricListCard(frame, 980, 706, 820, 264, block.effectsLabel, block.effects.slice(0, 4), state);
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
            createSectionLabel(frame, "Learner + weak-topic trigger", 120, 214, state, 18);
            createSystemFlowCluster(
              frame,
              {
                x: 120,
                y: 244,
                w: 520,
                h: 666,
                title: "Learner Quiz Path",
                summary: "Signals from explored and missed content determine when a knowledge check should appear.",
                nodes: block.flowNodes.slice(0, 4),
                note: block.dataFlowItems[0],
                number: "1",
                tone: PALETTE.indigoSoft,
              },
              state,
            );

            createLabelValueCard(frame, {
              x: 700,
              y: 450,
              w: 520,
              h: 166,
              title: block.dataFlowLabel,
              body: block.dataFlowItems.slice(1, 4).join(" • "),
            }, state);
            createFlowArrow(frame, 640, 536, 40);
            createFlowArrow(frame, 1220, 536, 40);

            createSectionLabel(frame, "Protected grading + storage", 1280, 214, state, 18);
            createSystemFlowCluster(
              frame,
              {
                x: 1280,
                y: 244,
                w: 520,
                h: 666,
                title: "Server Quiz Path",
                summary: "Quiz payloads, submissions, and grading stay server-side so analytics and answer keys remain protected.",
                nodes: [block.flowNodes[2], block.flowNodes[3], block.flowNodes[4], "Analytics + review"],
                note: block.dataFlowItems[4],
                number: "2",
                tone: PALETTE.pearl,
              },
              state,
            );

            createInfoCard(frame, { x: 120, y: 930, w: 520, h: 110, title: block.storageCards[0].title, body: block.storageCards[0].body }, state);
            createInfoCard(frame, { x: 700, y: 930, w: 520, h: 110, title: block.storageCards[1].title, body: block.storageCards[1].body }, state);
            createScreenshotZone(frame, 1280, 930, 520, 110, block.screenshots[0], state);
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
            createSectionLabel(frame, "Question enters the stack", 120, 214, state, 18);
            createSystemFlowCluster(
              frame,
              {
                x: 120,
                y: 244,
                w: 520,
                h: 666,
                title: "Request Path",
                summary: "The learner asks inside the course shell and the request is forwarded through the internal app boundary.",
                nodes: block.flowNodes.slice(0, 4),
                note: block.steps[1].body,
                number: "1",
                tone: PALETTE.indigoSoft,
              },
              state,
            );

            createLabelValueCard(frame, {
              x: 700,
              y: 450,
              w: 520,
              h: 166,
              title: block.steps[2].title,
              body: `${block.steps[2].body} ${block.steps[3].body}`,
            }, state);
            createFlowArrow(frame, 640, 536, 40);
            createFlowArrow(frame, 1220, 536, 40);

            createSectionLabel(frame, "Grounded answer returns", 1280, 214, state, 18);
            createSystemFlowCluster(
              frame,
              {
                x: 1280,
                y: 244,
                w: 520,
                h: 666,
                title: "Response Path",
                summary: "Retrieved course context grounds the model answer before the learner sees the reply.",
                nodes: [block.flowNodes[2], block.flowNodes[3], block.flowNodes[4], "answer returns"],
                note: block.steps[4].body,
                number: "2",
                tone: PALETTE.pearl,
              },
              state,
            );

            createInfoCard(frame, { x: 120, y: 930, w: 820, h: 110, title: block.steps[0].title, body: block.steps[0].body }, state);
            createScreenshotZone(frame, 980, 930, 400, 110, block.screenshots[0], state);
            createScreenshotZone(frame, 1400, 930, 400, 110, block.screenshots[1], state);
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
            createSectionLabel(frame, "Tracked learner signals", 120, 214, state, 18);
            createSystemFlowCluster(
              frame,
              {
                x: 120,
                y: 244,
                w: 520,
                h: 666,
                title: "Player Event Path",
                summary: "What the learner does in the player becomes structured progress events before it reaches reporting.",
                nodes: block.flowNodes.slice(0, 4),
                note: block.tables[1].detail,
                number: "1",
                tone: PALETTE.indigoSoft,
              },
              state,
            );

            createLabelValueCard(frame, {
              x: 700,
              y: 450,
              w: 520,
              h: 166,
              title: "Storage handoff",
              body: `${block.tables[0].label}, ${block.tables[2].label}, and ${block.tables[4].label} become queryable reporting records through Prisma and PostgreSQL.`,
            }, state);
            createFlowArrow(frame, 640, 536, 40);
            createFlowArrow(frame, 1220, 536, 40);

            createSectionLabel(frame, "Dashboard visibility", 1280, 214, state, 18);
            createSystemFlowCluster(
              frame,
              {
                x: 1280,
                y: 244,
                w: 520,
                h: 666,
                title: "Reporting Path",
                summary: "Stored learner events become metrics, recent sessions, and insight views for instructors and stakeholders.",
                nodes: [block.flowNodes[2], block.flowNodes[3], block.flowNodes[4], "insight views"],
                note: block.tables[3].detail,
                number: "2",
                tone: PALETTE.pearl,
              },
              state,
            );

            createMetricListCard(frame, 120, 930, 520, 110, block.metricsLabel, block.metrics.slice(0, 7), state);
            createLabelValueCard(frame, { x: 700, y: 930, w: 520, h: 110, title: block.tables[2].label, body: block.tables[2].detail }, state);
            createScreenshotZone(frame, 1280, 930, 520, 110, block.screenshot, state);
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
            createSectionLabel(frame, "Platform value path", 120, 214, state, 18);
            createSystemFlowCluster(
              frame,
              {
                x: 120,
                y: 244,
                w: 520,
                h: 666,
                title: "Moto Tutor AI Loop",
                summary: "Authoring control, interactive delivery, grounded AI, and measurement reinforce each other as one training system.",
                nodes: ["Author in CMS", "Deliver interactive lessons", "Ground answers with AI", "Measure + improve"],
                note: block.note,
                number: "1",
                tone: PALETTE.indigoSoft,
              },
              state,
            );

            createSectionLabel(frame, "Business outcomes", 700, 214, state, 18);
            createOutcomePillar(frame, { x: 700, y: 244, w: 330, h: 258, title: block.cards[0].title, body: block.cards[0].body, number: "2" }, state);
            createOutcomePillar(frame, { x: 1060, y: 244, w: 330, h: 258, title: block.cards[1].title, body: block.cards[1].body, number: "3", tone: PALETTE.pearl }, state);
            createOutcomePillar(frame, { x: 1420, y: 244, w: 330, h: 258, title: block.cards[2].title, body: block.cards[2].body, number: "4" }, state);

            createOutcomePillar(frame, { x: 700, y: 534, w: 330, h: 230, title: block.cards[3].title, body: block.cards[3].body, number: "5", tone: PALETTE.pearl }, state);
            createOutcomePillar(frame, { x: 1060, y: 534, w: 330, h: 230, title: block.cards[4].title, body: block.cards[4].body, number: "6" }, state);
            createLabelValueCard(frame, { x: 1420, y: 534, w: 330, h: 108, title: "Why teams care", body: "The platform shifts from static publishing to an adaptive loop of authoring, interaction, support, and measurement." }, state);
            createScreenshotZone(frame, 1420, 656, 330, 108, block.screenshot, state);

            createNoteBlock(frame, 700, 820, 1050, 120, block.note);
          },
        },
      ],
    },
  ];
}

function countSelectedFrames(config: BoardGenerationConfig) {
  return buildPageSpecs(DEFAULT_CONTENT).filter((page) => config.selectedPages.includes(page.id)).reduce((sum, page) => sum + page.frames.length, 0);
}

function countSelectedGroups(config: BoardGenerationConfig) {
  return buildPageSpecs(DEFAULT_CONTENT).filter((page) => config.selectedPages.includes(page.id)).length;
}

async function clearGeneratedPages() {
  await figma.loadAllPagesAsync();
  const generatedPages = figma.root.children.filter((page: any) => {
    if (typeof page.getPluginData !== "function") return false;
    const isGenerated = page.getPluginData(PAGE_KEY) === "generated";
    const isPinnedBackup = /backup/i.test(page.name);
    return isGenerated && !isPinnedBackup;
  });
  if (generatedPages.length === 0) return;

  let safePage = figma.root.children.find((page: any) => typeof page.getPluginData === "function" && page.getPluginData(PAGE_KEY) !== "generated");
  let scratchPage: any = null;

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

async function loadFonts(state: BoardState) {
  const { fonts } = state.content.style;
  FONT_REGULAR.family = fonts.primaryFamily;
  FONT_REGULAR.style = fonts.regularStyle;
  FONT_SEMIBOLD.family = fonts.primaryFamily;
  FONT_SEMIBOLD.style = fonts.strongStyle;

  let regularSource: "primary" | "fallback" = "primary";
  try {
    await figma.loadFontAsync(FONT_REGULAR);
  } catch {
    FONT_REGULAR.family = fonts.fallbackFamily;
    FONT_REGULAR.style = fonts.fallbackRegularStyle;
    await figma.loadFontAsync(FONT_REGULAR);
    regularSource = "fallback";
  }
  try {
    await figma.loadFontAsync(FONT_SEMIBOLD);
  } catch {
    if (regularSource === "primary") {
      FONT_SEMIBOLD.family = fonts.primaryFamily;
      FONT_SEMIBOLD.style = fonts.regularStyle;
      await figma.loadFontAsync(FONT_SEMIBOLD);
    } else {
      FONT_SEMIBOLD.family = fonts.fallbackFamily;
      FONT_SEMIBOLD.style = fonts.fallbackStrongStyle;
      try {
        await figma.loadFontAsync(FONT_SEMIBOLD);
      } catch {
        FONT_SEMIBOLD.style = fonts.fallbackRegularStyle;
        await figma.loadFontAsync(FONT_SEMIBOLD);
      }
    }
  }
}

function normalizeConfig(input: Partial<BoardGenerationConfig>): BoardGenerationConfig {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }
  if (isPlainObject(base)) {
    const source = isPlainObject(override) ? override : {};
    const merged: Record<string, unknown> = { ...base };
    for (const key of Object.keys(base as Record<string, unknown>)) {
      merged[key] = deepMerge((base as Record<string, unknown>)[key], source[key]);
    }
    return merged as T;
  }
  return (override === undefined ? base : override) as T;
}

function normalizeContent(raw: unknown): BoardContent {
  if (typeof raw === "string") {
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULT_CONTENT, parsed);
  }
  return deepMerge(DEFAULT_CONTENT, raw);
}

function snapshotPaint(paint: LiveSnapshotPaint) {
  const [hex, opacity] = Array.isArray(paint) ? paint : [paint, 1];
  return { type: "SOLID", color: hexToRgb(hex), opacity };
}

function collectSnapshotFonts(node: LiveSnapshotNode, fonts: Map<string, FontName>) {
  if (node.font) {
    const font = { family: node.font[0], style: node.font[1] };
    fonts.set(`${font.family}\u0000${font.style}`, font);
  }
  for (const child of node.c || []) collectSnapshotFonts(child, fonts);
}

async function loadSnapshotFonts() {
  const fonts = new Map<string, FontName>();
  for (const node of LIVE_BOARD_SNAPSHOT.page.c) collectSnapshotFonts(node, fonts);
  for (const font of fonts.values()) await figma.loadFontAsync(font);
}

function applySnapshotGeometry(node: any, spec: LiveSnapshotNode) {
  node.name = spec.n;
  node.resize(spec.w, spec.h);
  node.x = spec.x;
  node.y = spec.y;
  node.visible = spec.v !== false;
  node.locked = spec.l === true;
  node.opacity = spec.o ?? 1;
  node.rotation = spec.r ?? 0;
  node.fills = (spec.f || []).map(snapshotPaint);
  node.strokes = (spec.s || []).map(snapshotPaint);
  node.strokeWeight = spec.sw ?? 1;
  if (typeof spec.cr === "number") node.cornerRadius = spec.cr;
}

function createSnapshotNode(parent: any, spec: LiveSnapshotNode) {
  if (spec.t === "TEXT") {
    const node = figma.createText();
    parent.appendChild(node);
    node.fontName = spec.font ? { family: spec.font[0], style: spec.font[1] } : FONT_REGULAR;
    node.textAutoResize = "NONE";
    node.characters = spec.text || "";
    if (typeof spec.fs === "number") node.fontSize = spec.fs;
    if (spec.lh === "AUTO") node.lineHeight = { unit: "AUTO" };
    else if (spec.lh) node.lineHeight = { value: spec.lh[0], unit: spec.lh[1] };
    if (spec.ls) node.letterSpacing = { value: spec.ls[0], unit: spec.ls[1] };
    if (spec.ah) node.textAlignHorizontal = spec.ah;
    if (spec.av) node.textAlignVertical = spec.av;
    if (typeof spec.ps === "number") node.paragraphSpacing = spec.ps;
    if (spec.tc) node.textCase = spec.tc;
    if (spec.td) node.textDecoration = spec.td;
    applySnapshotGeometry(node, spec);
    if (spec.ar) node.textAutoResize = spec.ar;
    return node;
  }

  const node = figma.createFrame();
  parent.appendChild(node);
  node.clipsContent = spec.cl === true;
  applySnapshotGeometry(node, spec);
  for (const child of spec.c || []) createSnapshotNode(node, child);
  return node;
}

async function restoreLiveSnapshot() {
  await loadSnapshotFonts();
  const page = figma.createPage();
  page.name = `${LIVE_BOARD_SNAPSHOT.page.name} · Pulled Snapshot ${LIVE_BOARD_SNAPSHOT.source.capturedAt}`;
  page.setPluginData(PAGE_KEY, "live-snapshot");
  await figma.setCurrentPageAsync(page);
  for (const child of LIVE_BOARD_SNAPSHOT.page.c) createSnapshotNode(page, child);
  return page;
}

async function generateBoard(state: BoardState) {
  await loadFonts(state);
  if (state.config.clearExisting) await clearGeneratedPages();

  const createdPages: any[] = [];
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
  } else {
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

figma.ui.onmessage = async (msg: any) => {
  if (msg?.type === "get-defaults") {
    figma.ui.postMessage({
      type: "defaults",
      defaults: DEFAULT_CONFIG,
      frameCount: countSelectedFrames(DEFAULT_CONFIG),
      contentJson: JSON.stringify(DEFAULT_CONTENT, null, 2),
    });
    return;
  }
  if (msg?.type === "restore-live-snapshot") {
    try {
      await restoreLiveSnapshot();
      figma.ui.postMessage({
        type: "done",
        text: `Created a safe copy of the ${LIVE_BOARD_SNAPSHOT.source.capturedAt} live snapshot with 13 frames. The original live page was not changed.`,
      });
      figma.closePlugin();
    } catch (error) {
      figma.ui.postMessage({
        type: "done",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    return;
  }
  if (msg?.type !== "generate") return;

  try {
    const state: BoardState = {
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
  } catch (error) {
    figma.ui.postMessage({
      type: "done",
      text: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
};
