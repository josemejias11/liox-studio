export type FontName = {
  family: string;
  style: string;
};

export type TextCard = {
  title: string;
  body: string;
};

export type LabeledNode = {
  label: string;
  detail?: string;
};

export type BoardGenerationConfig = {
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

export type BoardContent = {
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
      lessons: TextCard[];
    };
  };
  learner: {
    pageName: string;
    journey: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      playerTitle: string;
      playerProgress: string;
      stops: string[];
      featureLabel: string;
      features: string[];
      screenshots: string[];
    };
    features: {
      name: string;
      subtitle: string;
      badgeLabel: string;
      cards: TextCard[];
      screenshot: string;
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

export type BoardState = {
  config: BoardGenerationConfig;
  content: BoardContent;
};

export type FrameSpec = {
  name: string;
  displayTitle?: string;
  subtitle: string;
  background: string;
  badge: [string, string];
  build: (frame: any, state: BoardState) => void;
};

export type PageSpec = {
  id: string;
  name: string;
  frames: FrameSpec[];
};
