type FontName = {
  family: string;
  style: string;
};

type TextAlign = "LEFT" | "CENTER" | "RIGHT";

type TextCard = {
  title: string;
  body: string;
};

type LessonFlowStep = {
  label: string;
};

type LessonFlowCard = {
  title: string;
  summary: string;
  steps: LessonFlowStep[];
  result: string;
};

type ScreenCard = {
  title: string;
  route: string;
  screenshot: string;
  note?: string;
};

type LabeledNode = {
  label: string;
  detail?: string;
};

type BoardGenerationConfig = {
  boardTitle: string;
  frameWidth: number;
  frameHeight: number;
  frameGap: number;
  layoutMode: "inline" | "per-page";
  clearExisting: boolean;
  includeScreenshots: boolean;
  includeControlKit: boolean;
  selectedPages: string[];
};

type BoardStyle = {
  fonts: {
    primaryFamily: string;
    regularStyle: string;
    strongStyle: string;
    fallbackFamily: string;
    fallbackRegularStyle: string;
    fallbackStrongStyle: string;
  };
  typeScale: {
    display: number;
    subtitle: number;
    sectionLabel: number;
    cardTitle: number;
    detailTitle: number;
    body: number;
    secondary: number;
    caption: number;
    micro: number;
  };
  frameLayout: Record<
    string,
    {
      headerAlign?: "left" | "center";
      subtitleWidth?: number;
      titleWidth?: number;
    }
  >;
};

type BoardContent = {
  style: BoardStyle;
  overview: {
    pageName: string;
    whatIs: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      cards: TextCard[];
      actors: string[];
      courseCardsTitle: string;
      courseCards: string[];
    };
    platformFlow: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      nodes: string[];
      detailLabel: string;
      detailCards: TextCard[];
      screenshots: string[];
    };
  };
  content: {
    pageName: string;
    authoring: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      steps: string[];
      note: string;
      screenshot: string;
      studioTitle: string;
      studioSidebar: string[];
    };
    pipeline: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      nodes: LabeledNode[];
      keyDetailsLabel: string;
      keyDetails: string[];
      screenshots: string[];
    };
    lessonGallery: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      lessons: LessonFlowCard[];
    };
  };
  learner: {
    pageName: string;
    journey: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      authoringLabel: string;
      authoringScreens: ScreenCard[];
      learnerLabel: string;
      learnerScreens: ScreenCard[];
      transitionLabel: string;
      transitionBody: string;
      notesLabel: string;
      notes: string[];
    };
    features: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      hotspotFlowLabel: string;
      hotspotFlowNodes: string[];
      panelLabel: string;
      panelItems: string[];
      effectsLabel: string;
      effects: string[];
      supportCards: TextCard[];
      screenshots: string[];
    };
    quiz: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      flowNodes: string[];
      dataFlowLabel: string;
      dataFlowItems: string[];
      storageCards: TextCard[];
      screenshots: string[];
    };
  };
  aiAnalytics: {
    pageName: string;
    aiArchitecture: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      flowNodes: string[];
      steps: Array<{ step: string; title: string; body: string }>;
      screenshots: string[];
    };
    analytics: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      flowNodes: string[];
      tables: Array<{ label: string; detail: string }>;
      metricsLabel: string;
      metrics: string[];
      screenshot: string;
    };
    outcomes: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      cards: TextCard[];
      note: string;
      screenshot: string;
    };
  };
};

type BoardState = {
  config: BoardGenerationConfig;
  content: BoardContent;
};

type FrameSpec = {
  id: string;
  name: string;
  displayTitle?: string;
  subtitle: string;
  background: string;
  badge: [string, string];
  build: (frame: any, state: BoardState) => void;
};

type PageSpec = {
  id: string;
  name: string;
  frames: FrameSpec[];
};
