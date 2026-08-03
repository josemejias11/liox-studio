import { prisma } from '@moto-ai/database';

type LessonProgressRow = {
  lessonId: string;
  completed: boolean;
};

type HotspotVisitRow = {
  lessonId: string;
  label: string;
};

type LessonProgressUpsertArgs = {
  where: { sessionId_lessonId: { sessionId: string; lessonId: string } };
  update: {
    completed?: boolean;
    courseId?: string;
    viewCount?: { increment: number };
  };
  create: {
    sessionId: string;
    lessonId: string;
    courseId: string;
    completed?: boolean;
  };
};

type HotspotVisitUpsertArgs = {
  where: {
    sessionId_lessonId_layerId_label: {
      sessionId: string;
      lessonId: string;
      layerId: string;
      label: string;
    };
  };
  update: Record<string, never>;
  create: {
    sessionId: string;
    lessonId: string;
    layerId: string;
    label: string;
  };
};

type SessionUpsertArgs = {
  where: { id: string };
  update: { updatedAt: Date };
  create: { id: string };
};

type ProgressStoreTx = {
  session: { upsert(args: SessionUpsertArgs): Promise<unknown> };
  lessonProgress: { upsert(args: LessonProgressUpsertArgs): Promise<unknown> };
  hotspotVisit: { upsert(args: HotspotVisitUpsertArgs): Promise<unknown> };
};

export type ProgressStoreDb = {
  lessonProgress: {
    findMany(args: { where: { sessionId: string } }): Promise<LessonProgressRow[]>;
  };
  hotspotVisit: {
    findMany(args: { where: { sessionId: string; layerId: string } }): Promise<HotspotVisitRow[]>;
  };
  $transaction<T>(callback: (tx: ProgressStoreTx) => Promise<T>): Promise<T>;
};

type LessonProgressState = {
  visitedHotspots: string[];
  completed: boolean;
};

type LessonProgressMap = Record<string, LessonProgressState>;

type RecordLessonViewInput = {
  sessionId: string;
  lessonId: string;
  courseId?: string;
};

type RecordHotspotsInput = {
  sessionId: string;
  lessonId: string;
  courseId?: string;
  visitedHotspots?: string[];
  completed?: boolean;
  recordView?: boolean;
};

const defaultDb: ProgressStoreDb = prisma;

export async function loadSessionProgress(sessionId: string, db: ProgressStoreDb = defaultDb) {
  const [progressRecords, hotspotRecords] = await Promise.all([
    db.lessonProgress.findMany({ where: { sessionId } }),
    db.hotspotVisit.findMany({ where: { sessionId, layerId: '' } }),
  ]);

  const lessons: LessonProgressMap = {};

  for (const record of progressRecords) {
    lessons[record.lessonId] = { visitedHotspots: [], completed: record.completed };
  }

  for (const record of hotspotRecords) {
    if (!lessons[record.lessonId]) {
      lessons[record.lessonId] = { visitedHotspots: [], completed: false };
    }

    if (!lessons[record.lessonId].visitedHotspots.includes(record.label)) {
      lessons[record.lessonId].visitedHotspots.push(record.label);
    }
  }

  return { lessons };
}

export async function recordLessonView(
  input: RecordLessonViewInput,
  db: ProgressStoreDb = defaultDb,
) {
  await db.$transaction(async (tx) => {
    await upsertSession(tx, input.sessionId);
    await tx.lessonProgress.upsert({
      where: { sessionId_lessonId: { sessionId: input.sessionId, lessonId: input.lessonId } },
      update: {
        courseId: input.courseId ?? '',
        viewCount: { increment: 1 },
      },
      create: {
        sessionId: input.sessionId,
        lessonId: input.lessonId,
        courseId: input.courseId ?? '',
      },
    });
  });
}

export async function recordHotspots(
  input: RecordHotspotsInput,
  db: ProgressStoreDb = defaultDb,
) {
  await db.$transaction(async (tx) => {
    await upsertSession(tx, input.sessionId);

    await tx.lessonProgress.upsert({
      where: { sessionId_lessonId: { sessionId: input.sessionId, lessonId: input.lessonId } },
      update: {
        completed: input.completed ?? false,
        ...(input.courseId ? { courseId: input.courseId } : {}),
        ...(input.recordView ? { viewCount: { increment: 1 } } : {}),
      },
      create: {
        sessionId: input.sessionId,
        lessonId: input.lessonId,
        courseId: input.courseId ?? '',
        completed: input.completed ?? false,
      },
    });

    for (const label of input.visitedHotspots ?? []) {
      await tx.hotspotVisit.upsert({
        where: {
          sessionId_lessonId_layerId_label: {
            sessionId: input.sessionId,
            lessonId: input.lessonId,
            layerId: '',
            label,
          },
        },
        update: {},
        create: {
          sessionId: input.sessionId,
          lessonId: input.lessonId,
          layerId: '',
          label,
        },
      });
    }
  });
}

async function upsertSession(tx: ProgressStoreTx, sessionId: string) {
  await tx.session.upsert({
    where: { id: sessionId },
    update: { updatedAt: new Date() },
    create: { id: sessionId },
  });
}
