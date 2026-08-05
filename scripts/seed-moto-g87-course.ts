import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadEnvConfig } from '@next/env';
import {
  beginCourseSourceRemoval,
  completeCourseSourceRemoval,
  createPendingSource,
  Prisma,
  prisma,
} from '@moto-ai/database';
import type { CourseLessonType } from '@moto-ai/contracts/course-studio';
import { enqueueDocumentIndexJob } from '@moto-ai/jobs';

import { deleteCourseAsset, putCourseAsset } from '../apps/web/src/server/storage/course-assets';

const COURSE_SLUG = 'moto-g87-always-social-ready';
const COURSE_TITLE = 'moto g87: Always Social Ready';
const SOURCE_DIRECTORY = '/Users/josemejias/Downloads/Venice Content';

const veniceSourceDocuments = [
  {
    filename: 'Venice Copy Guide_FINAL.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    filename: 'Venice Product Marketing Brief (PMB)_V3.pptx',
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  {
    filename: 'Venice _ Marketing Specs _FINAL.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
] as const;

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'DATABASE_URL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

const DATABASE_ENVIRONMENT_VARIABLE = 'DATABASE_URL';

const assetSources = {
  hero: '2026_MOTOROLA_VENICE_ROW_CMF HERO_H_V1.png',
  stargazer: '2026_VENICE_BASIC PACK_STARGAZER_PDP HERO.png',
  alaskanBlue: '2026_VENICE_BASIC PACK_ALASKAN BLUE_PDP HERO.png',
  malaga: '2026_VENICE_BASIC PACK_MALAGA_PDP HERO.png',
  smartConnect: '2026_Venice_MarketingScreens_SmartConnect.png',
  gestureMenu: '2026_Venice_MarketingScreens_Gesture Menu.png',
  circleToSearch: '2026_Venice_MarketingScreens_Google_Circle-to-Search.png',
  performance: 'png/2026_Venice_Advanced Pack_Performance.png',
  resistance: 'png/2026_Venice_Advance Pack_Resistance.png',
  portraitSample: 'on-device/rear-cam/portrait-mode/IMG_20250821_115911022_PORTRAIT.jpg',
  ultraWideSample: 'on-device/rear-cam/ultrawide/IMG_20250821_113231215.jpg',
  nightVisionSample: 'on-device/rear-cam/night-vision/IMG_20250821_190421481.jpg',
  photoBoothSample: 'on-device/front-cam/photobooth/IMG_20250821_180026836.jpg',
  slowMotion: 'on-device/rear-cam/slow-motion-video/VID_20250821_140928589.mp4',
  dualCapture: 'on-device/rear-cam/dual-capture-video/VID_20250821_184901989.mp4',
} as const;

type AssetName = keyof typeof assetSources;

interface StoredAsset {
  r2Key: string;
  filename: string;
  contentType: string;
  byteSize: number;
  deliveryUrl: string;
}

interface LessonDefinition {
  lessonType: CourseLessonType;
  headline: string;
  body: string;
  payload: Prisma.InputJsonObject;
}

interface ChapterDefinition {
  title: string;
  estimatedDuration: number;
  lessons: LessonDefinition[];
  quickCheck?: {
    title: string;
    instructions: string;
    payload: Prisma.InputJsonObject;
  };
}

function newId(prefix: string) {
  return `${prefix}.${crypto.randomUUID()}`;
}

function assetRef(asset: StoredAsset): Prisma.InputJsonObject {
  return {
    asset: {
      url: asset.deliveryUrl,
      originalFilename: asset.filename,
    },
  };
}

function feature(_key: string, label: string, summary: string): Prisma.InputJsonObject {
  return { _key, label, summary };
}

function hotspot(
  _key: string,
  label: string,
  topic: string,
  body: string,
  x: number,
  y: number,
  photo?: StoredAsset,
): Prisma.InputJsonObject {
  return {
    _key,
    label,
    topic,
    body,
    x,
    y,
    required: true,
    ...(photo ? { photos: [assetRef(photo)] } : {}),
  };
}

function authoredQuestion(
  key: string,
  questionText: string,
  answers: Array<{ text: string; isCorrect: boolean; feedback?: string }>,
  image?: StoredAsset,
): Prisma.InputJsonObject {
  return {
    _key: key,
    questionText,
    questionType: 'single',
    ...(image ? { image: assetRef(image) } : {}),
    answers: answers.map((answer, index) => ({
      _key: `${key}-answer-${index + 1}`,
      text: answer.text,
      isCorrect: answer.isCorrect,
      ...(answer.feedback ? { feedback: answer.feedback } : {}),
    })),
  };
}

function quickCheck(
  title: string,
  instructions: string,
  questions: Prisma.InputJsonObject[],
): Prisma.InputJsonObject {
  return {
    title,
    instructions,
    questions,
    passingScore: 80,
    allowRetry: true,
    showCorrectAnswers: true,
  };
}

function contentTypeFor(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.mp4':
      return 'video/mp4';
    default:
      throw new Error(`Unsupported selected asset type: ${filename}`);
  }
}

async function assertPreflight(): Promise<void> {
  loadEnvConfig(process.cwd());

  const missingEnvironment = REQUIRED_ENVIRONMENT_VARIABLES.filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missingEnvironment.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvironment.join(', ')}`);
  }

  const missingFiles: string[] = [];
  for (const source of Object.values(assetSources)) {
    try {
      await access(path.join(SOURCE_DIRECTORY, source));
    } catch {
      missingFiles.push(source);
    }
  }
  if (missingFiles.length > 0) {
    throw new Error(`Missing required source files: ${missingFiles.join(', ')}`);
  }
}

function loadDatabaseEnvironment(): void {
  loadEnvConfig(process.cwd());
  if (!process.env[DATABASE_ENVIRONMENT_VARIABLE]?.trim()) {
    throw new Error(`Missing required environment variable: ${DATABASE_ENVIRONMENT_VARIABLE}`);
  }
}

async function assertSourcePreflight(): Promise<void> {
  loadEnvConfig(process.cwd());

  const missingEnvironment = REQUIRED_ENVIRONMENT_VARIABLES.filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missingEnvironment.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvironment.join(', ')}`);
  }

  const missingFiles: string[] = [];
  for (const source of veniceSourceDocuments) {
    try {
      await access(path.join(SOURCE_DIRECTORY, source.filename));
    } catch {
      missingFiles.push(source.filename);
    }
  }
  if (missingFiles.length > 0) {
    throw new Error(`Missing required Venice source files: ${missingFiles.join(', ')}`);
  }
}

async function uploadCourseSource({
  courseId,
  filename,
  contentType,
  bytes,
  sha256,
}: {
  courseId: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
  sha256: string;
}) {
  let uploaded: Awaited<ReturnType<typeof putCourseAsset>> | undefined;
  let source: Awaited<ReturnType<typeof createPendingSource>> | undefined;

  try {
    uploaded = await putCourseAsset({
      courseId: `${courseId}/sources`,
      filename,
      contentType,
      bytes,
    });
    source = await createPendingSource({
      courseId,
      r2Key: uploaded.r2Key,
      filename,
      contentType,
      byteSize: bytes.byteLength,
      sha256,
    });
    const job = await enqueueDocumentIndexJob(
      {
        sourceId: source.id,
        courseId,
        sha256,
        filename: source.filename,
        contentType: source.contentType,
      },
      bytes,
    );
    return { source, job };
  } catch (error) {
    if (source) {
      const sourceId = source.id;
      await beginCourseSourceRemoval(courseId, sourceId)
        .then(() => (uploaded ? deleteCourseAsset(uploaded.r2Key) : undefined))
        .then(() => completeCourseSourceRemoval(courseId, sourceId))
        .catch((cleanupError) =>
          console.error('[moto-g87-source-upload] cleanup failed:', cleanupError),
        );
    } else if (uploaded) {
      await deleteCourseAsset(uploaded.r2Key).catch((cleanupError) =>
        console.error('[moto-g87-source-upload] R2 cleanup failed:', cleanupError),
      );
    }
    throw error;
  }
}

async function uploadVeniceSources(): Promise<void> {
  await assertSourcePreflight();

  const course = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    select: { id: true },
  });
  if (!course) {
    throw new Error(`Course ${COURSE_SLUG} must be seeded before uploading Venice sources.`);
  }

  for (const document of veniceSourceDocuments) {
    const bytes = await readFile(path.join(SOURCE_DIRECTORY, document.filename));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const existing = await prisma.courseSourceFile.findFirst({
      where: { courseId: course.id, filename: document.filename, sha256 },
      select: { id: true, indexStatus: true },
    });
    if (existing) {
      console.log(
        `source:skipped filename=${document.filename} sourceId=${existing.id} status=${existing.indexStatus}`,
      );
      continue;
    }

    const result = await uploadCourseSource({
      courseId: course.id,
      filename: document.filename,
      contentType: document.contentType,
      bytes,
      sha256,
    });
    console.log(
      `source:uploaded filename=${document.filename} sourceId=${result.source.id} status=${result.source.indexStatus} jobId=${result.job.jobId}`,
    );
  }

  console.log(`/studio/${course.id}`);
}

async function uploadAssets(courseId: string): Promise<Record<AssetName, StoredAsset>> {
  const uploaded: StoredAsset[] = [];
  const assets = {} as Record<AssetName, StoredAsset>;

  try {
    for (const [assetName, relativePath] of Object.entries(assetSources) as Array<
      [AssetName, string]
    >) {
      const sourcePath = path.join(SOURCE_DIRECTORY, relativePath);
      const bytes = new Uint8Array(await readFile(sourcePath));
      const filename = path.basename(relativePath);
      const contentType = contentTypeFor(filename);
      const stored = await putCourseAsset({ courseId, filename, contentType, bytes });
      const asset = {
        r2Key: stored.r2Key,
        filename,
        contentType,
        byteSize: bytes.byteLength,
        deliveryUrl: stored.url,
      };
      assets[assetName] = asset;
      uploaded.push(asset);
    }
    return assets;
  } catch (error) {
    await Promise.all(
      uploaded.map((asset) => deleteCourseAsset(asset.r2Key).catch(() => undefined)),
    );
    throw error;
  }
}

function chapterDefinitions(assets: Record<AssetName, StoredAsset>): ChapterDefinition[] {
  const cameraFeatures = [
    feature(
      'camera-main',
      '50MP Sony LYTIA 600',
      'Quad Pixel technology combines four pixels for 12.5MP effective photos.',
    ),
    feature(
      'camera-ultrawide',
      '8MP ultra-wide',
      'A true 119.5° field of view helps include more of the scene.',
    ),
    feature(
      'camera-selfie',
      '32MP selfie camera',
      'Quad Pixel technology supports 1.4μm pixels for social-ready selfies.',
    ),
  ];

  const everydayFeatures = [
    feature(
      'battery',
      '7000mAh battery',
      'Typical capacity; LATAM battery life is up to 56 hours under the stated mixed-use test conditions.',
    ),
    feature(
      'display',
      '6.72-inch FHD+ 120Hz display',
      'LCD display with up to 1050 nits high brightness mode and Water Touch.',
    ),
    feature(
      'performance',
      'Snapdragon 6s Gen 4',
      '4nm mobile platform with UFS 3.1 storage options; memory availability varies by market.',
    ),
  ];

  const cameraQuiz = quickCheck(
    'Capture and create check',
    'Choose the shopper-ready camera answer based on the moto g87 LATAM specification.',
    [
      authoredQuestion(
        'capture-q1',
        'Which rear camera combination is correct for moto g87?',
        [
          {
            text: '50MP Sony LYTIA 600 main camera plus 8MP 119.5° ultra-wide',
            isCorrect: true,
            feedback: 'Correct: this is the specified rear-camera pairing.',
          },
          { text: '50MP main camera plus 2MP monochrome camera', isCorrect: false },
          { text: '108MP main camera plus 5MP macro camera', isCorrect: false },
        ],
        assets.ultraWideSample,
      ),
      authoredQuestion(
        'capture-q2',
        'Which front-camera claim is accurate?',
        [
          {
            text: '32MP with Quad Pixel technology for 1.4μm pixels',
            isCorrect: true,
            feedback: 'Correct: this is the supplied specification.',
          },
          { text: '16MP with optical image stabilization', isCorrect: false },
          { text: '50MP with autofocus', isCorrect: false },
        ],
        assets.photoBoothSample,
      ),
    ],
  );

  const chapters: ChapterDefinition[] = [
    {
      title: 'Capture and create',
      estimatedDuration: 12,
      quickCheck: {
        title: 'Capture and create check',
        instructions:
          'Choose the shopper-ready camera answer based on the moto g87 LATAM specification.',
        payload: cameraQuiz,
      },
      lessons: [
        {
          lessonType: 'content',
          headline: 'Start with the social-creation story',
          body: 'For shoppers who create and share every day, lead with a balanced camera system: a 50MP Sony LYTIA 600 main camera, a true 8MP ultra-wide camera, and a 32MP Quad Pixel selfie camera.',
          payload: { media: assetRef(assets.hero), coveredFeatures: cameraFeatures },
        },
        {
          lessonType: 'stage',
          headline: 'Explore the camera system',
          body: 'Invite the shopper to connect each camera component to a real capture need instead of leading with megapixels alone.',
          payload: {
            media: assetRef(assets.alaskanBlue),
            stageBackground: assetRef(assets.hero),
            enableCompletionAnimation: true,
            completionTransition: 'rise',
            hotspots: [
              hotspot(
                'stage-main',
                '50MP Sony LYTIA 600',
                'Main camera',
                'The 50MP sensor uses Quad Pixel technology for 12.5MP effective photos and PDAF.',
                47,
                45,
                assets.portraitSample,
              ),
              hotspot(
                'stage-ultrawide',
                '8MP ultra-wide',
                'More in frame',
                'The true 8MP ultra-wide camera has a 119.5° field of view.',
                25,
                58,
                assets.ultraWideSample,
              ),
              hotspot(
                'stage-selfie',
                '32MP selfie camera',
                'Social-ready selfies',
                'The 32MP front camera uses Quad Pixel technology for 1.4μm pixels.',
                70,
                30,
                assets.photoBoothSample,
              ),
            ],
          },
        },
        {
          lessonType: 'interaction',
          headline: 'Match the mode to the moment',
          body: 'Use the supplied camera samples to ask what the shopper wants to capture, then connect the need to a relevant mode or lens.',
          payload: {
            media: assetRef(assets.portraitSample),
            coveredFeatures: [
              feature(
                'portrait',
                'Portrait',
                'Use portrait mode when a subject should stand out with a more deliberate look.',
              ),
              feature(
                'night-vision',
                'Night Vision',
                'Night Vision is a supplied shooting mode; availability is specified for the 8GB RAM build only.',
              ),
              feature(
                'ultrawide',
                'Ultra-wide',
                'Use the 119.5° ultra-wide lens when the story needs more of the scene.',
              ),
            ],
            hotspots: [
              hotspot(
                'interaction-night',
                'Night Vision sample',
                'Low light',
                'Frame Night Vision as a mode for challenging light, not a promise that every scene looks identical.',
                66,
                42,
                assets.nightVisionSample,
              ),
            ],
          },
        },
        {
          lessonType: 'splitScreen',
          headline: 'From image to share',
          body: 'Pair a camera sample with a concise retail explanation: the hardware helps capture, while Google Photos editing tools help refine a story after the shot.',
          payload: {
            media: assetRef(assets.portraitSample),
            splitReverseLayout: true,
            coveredFeatures: [
              feature(
                'magic-eraser',
                'Magic Eraser',
                'Google Photos editing includes Magic Eraser among the listed tools.',
              ),
              feature(
                'photo-unblur',
                'Photo Unblur',
                'Google Photos editing lists Photo Unblur; outcomes depend on the image and software experience.',
              ),
            ],
          },
        },
      ],
    },
    {
      title: 'Keep up with every day',
      estimatedDuration: 11,
      lessons: [
        {
          lessonType: 'scrollStory',
          headline: 'The day keeps moving',
          body: 'Build the recommendation around everyday confidence: battery capacity, a smooth display, and capable performance all work together.',
          payload: {
            media: assetRef(assets.performance),
            coveredFeatures: everydayFeatures,
            scrollChapters: [
              {
                heading: 'Power through the plan',
                body: 'The typical battery capacity is 7000mAh. In LATAM, the battery-life claim is up to 56 hours under the specified mixed-use test conditions; actual results vary.',
                image: assetRef(assets.hero),
                targetScale: 1,
                targetRotation: 0,
                targetX: 0,
                targetY: 0,
              },
              {
                heading: 'See more clearly outdoors',
                body: 'The 6.72-inch FHD+ LCD display supports up to a 120Hz refresh rate, Water Touch, and up to 1050 nits high brightness mode.',
                image: assetRef(assets.performance),
                targetScale: 1.08,
                targetRotation: -2,
                targetX: 4,
                targetY: -3,
              },
              {
                heading: 'Stay in the flow',
                body: 'The Qualcomm Snapdragon 6s Gen 4 mobile platform is built on 4nm. Storage, memory, and RAM Boost options vary by market and configuration.',
                image: assetRef(assets.gestureMenu),
                targetScale: 1.12,
                targetRotation: 2,
                targetX: -3,
                targetY: 2,
              },
            ],
          },
        },
        {
          lessonType: 'canvas',
          headline: 'Inspect the display and power story',
          body: 'Tap each labelled area to connect the benefit to its specification and limitation.',
          payload: {
            media: assetRef(assets.alaskanBlue),
            hotspots: [
              hotspot(
                'canvas-display',
                '120Hz display',
                'Smooth viewing',
                'Actual refresh rate may be less and varies by app, content, device mode settings, and requirements.',
                50,
                24,
                assets.performance,
              ),
              hotspot(
                'canvas-battery',
                '7000mAh battery',
                'Longer between charges',
                'The 7000mAh figure is typical capacity; the rated capacity is 6790mAh.',
                47,
                68,
                assets.hero,
              ),
              hotspot(
                'canvas-water-touch',
                'Water Touch',
                'Everyday usability',
                'Water Touch is part of the listed display experience; do not confuse it with waterproofing.',
                72,
                43,
                assets.resistance,
              ),
            ],
          },
        },
        {
          lessonType: 'dragDrop',
          headline: 'Match the proof point',
          body: 'Drag each proof point to the value it supports. Keep market and use-case limits part of the final explanation.',
          payload: {
            media: assetRef(assets.performance),
            chips: [
              { id: 'chip-battery', text: 'Up to 56 hours in LATAM' },
              { id: 'chip-display', text: '6.72-inch FHD+ LCD, up to 120Hz' },
              { id: 'chip-performance', text: 'Snapdragon 6s Gen 4 on 4nm' },
            ],
            dropZones: [
              {
                id: 'zone-battery',
                label: 'Battery confidence',
                correctChipId: 'chip-battery',
                xPositionPct: 27,
                yPositionPct: 30,
              },
              {
                id: 'zone-display',
                label: 'Smooth display story',
                correctChipId: 'chip-display',
                xPositionPct: 64,
                yPositionPct: 46,
              },
              {
                id: 'zone-performance',
                label: 'Everyday responsiveness',
                correctChipId: 'chip-performance',
                xPositionPct: 42,
                yPositionPct: 74,
              },
            ],
          },
        },
      ],
    },
    {
      title: 'Recommend with confidence',
      estimatedDuration: 12,
      lessons: [
        {
          lessonType: 'colorSwitcher',
          headline: 'Find the finish that fits',
          body: 'Let the shopper compare the supplied product renders before returning to the feature story.',
          payload: {
            colorVariants: [
              { label: 'Stargazer', colorHex: '#2d2d35', image: assetRef(assets.stargazer) },
              { label: 'Alaskan Blue', colorHex: '#7798ad', image: assetRef(assets.alaskanBlue) },
              { label: 'Malaga', colorHex: '#76575c', image: assetRef(assets.malaga) },
            ],
          },
        },
        {
          lessonType: 'video',
          headline: 'Show motion in the moment',
          body: 'Use the supplied slow-motion sample to introduce HD slow motion at 120fps as one of the listed video capabilities.',
          payload: { videoFile: assetRef(assets.slowMotion), videoAspectRatio: '16:9' },
        },
      ],
    },
  ];

  assertMotoG87Structure(chapters);
  return chapters;
}

function assertMotoG87Structure(chapters: ChapterDefinition[]) {
  const types = chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.lessonType));
  const expectedTypes: CourseLessonType[] = [
    'content',
    'stage',
    'interaction',
    'splitScreen',
    'scrollStory',
    'canvas',
    'dragDrop',
    'colorSwitcher',
    'video',
  ];

  if (chapters.length !== 3 || types.length !== 9 || new Set(types).size !== 9) {
    throw new Error('Expected three chapters and each non-quiz type exactly once');
  }
  if (!chapters[0]?.quickCheck || chapters.slice(1).some((chapter) => chapter.quickCheck)) {
    throw new Error('Expected only Chapter 1 to have an authored checkpoint');
  }
  if (types.some((type, index) => type !== expectedTypes[index])) {
    throw new Error('Expected the approved moto g87 learner flow order');
  }
}

function assertMotoG87SeedStructure(): void {
  const placeholderAsset: StoredAsset = {
    r2Key: 'structure-validation',
    filename: 'structure-validation',
    contentType: 'application/octet-stream',
    byteSize: 0,
    deliveryUrl: 'https://validation.invalid/structure-validation',
  };
  const placeholderAssets = {} as Record<AssetName, StoredAsset>;
  for (const assetName of Object.keys(assetSources) as AssetName[]) {
    placeholderAssets[assetName] = placeholderAsset;
  }

  assertMotoG87Structure(chapterDefinitions(placeholderAssets));
}

function courseSettings(assets: Record<AssetName, StoredAsset>) {
  const specifications: Prisma.InputJsonObject[] = [
    {
      _key: 'spec-moto-g87',
      title: 'moto g87 specifications',
      subtitle: 'Camera, everyday performance, and connected confidence for LATAM',
      heroImage: assetRef(assets.portraitSample),
      specGroups: [
        {
          groupName: 'Camera',
          specs: [
            {
              label: 'Main',
              value: '50MP Sony LYTIA 600, f/1.8, Quad Pixel, PDAF',
              highlight: true,
            },
            { label: 'Ultra-wide', value: '8MP, 119.5° FOV, f/2.2', highlight: true },
            { label: 'Selfie', value: '32MP, f/2.2, Quad Pixel', highlight: true },
          ],
        },
        {
          groupName: 'Battery and charging',
          specs: [
            { label: 'Battery', value: '7000mAh typical; 6790mAh rated', highlight: true },
            { label: 'LATAM battery life', value: 'Up to 56 hours*', highlight: true },
            { label: 'Charging', value: '30W TurboPower™' },
          ],
        },
        {
          groupName: 'Display and platform',
          specs: [
            {
              label: 'Display',
              value: '6.72-inch FHD+ LCD, up to 120Hz, up to 1050 nits HBM',
              highlight: true,
            },
            { label: 'Platform', value: 'Qualcomm Snapdragon 6s Gen 4 (4nm)' },
          ],
        },
        {
          groupName: 'Protection and connectivity',
          specs: [
            {
              label: 'Protection',
              value: 'IP64 water-resistant design and Corning® Gorilla® Glass 7i',
            },
            {
              label: 'NFC',
              value:
                'Available in LATAM where compatible terminals, apps, and local conditions are present',
            },
            {
              label: 'Connected experience',
              value: 'Smart Connect and Android 16 availability varies by market and configuration',
            },
          ],
        },
      ],
      footnotes: [
        'Some camera modes and features vary by RAM configuration, software, and market. *Battery life is approximate and varies with network, settings, temperature, condition, and use. Refresh rate varies by app, content, mode, and settings.',
      ],
    },
  ];

  const disclaimer: Prisma.InputJsonObject = {
    _key: 'latam-disclaimer',
    title: 'LATAM availability and claim limits',
    category: 'legal',
    body: 'Features, software, network bands, memory/storage configurations, accessories, colors, and availability vary by market, carrier, retailer, software version, and device configuration. Confirm local availability before recommending.',
    disclaimers: [
      'Battery life claim: up to 56 hours in LATAM under the stated mixed-use test conditions; actual battery performance varies.',
      'IP64 is a water-resistant design for spills, splashes, or light rain. The phone is not waterproof, not designed for submersion, and resistance decreases with normal wear.',
      'NFC payments require a supported payment terminal and app, and PIN authorization for purchase.',
    ],
    acknowledgementRequired: true,
    acknowledgementLabel: 'I understand the LATAM availability and claim limitations.',
  };

  return {
    title: COURSE_TITLE,
    description:
      'A retail-learning course for making accurate, shopper-led moto g87 recommendations in LATAM—from social creation through all-day value and legal-safe close.',
    learningObjectives: [
      'Match shopper needs to the moto g87 camera and social-creation features.',
      'Explain the LATAM battery, performance, display, and connected-experience value accurately.',
      'Deliver a concise, legal-safe moto g87 retail recommendation.',
    ],
    cover: {
      thumbnail: assetRef(assets.hero),
      coverImage: assetRef(assets.hero),
      coverHeadline: 'Create, connect, and recommend with confidence.',
      coverButtonText: 'Start learning',
      coverButtonColor: '#685bc7',
    },
    specifications,
    disclaimer,
  };
}

async function createCourseChapters(
  tx: Prisma.TransactionClient,
  courseId: string,
  chapters: ChapterDefinition[],
): Promise<void> {
  for (const [chapterPosition, chapter] of chapters.entries()) {
    const quickCheckId = chapter.quickCheck ? newId('quiz') : undefined;
    if (chapter.quickCheck && quickCheckId) {
      await tx.courseQuiz.create({
        data: {
          id: quickCheckId,
          courseId,
          title: chapter.quickCheck.title,
          instructions: chapter.quickCheck.instructions,
          payload: chapter.quickCheck.payload,
        },
      });
    }
    await tx.courseChapter.create({
      data: {
        id: newId('chapter'),
        courseId,
        title: chapter.title,
        position: chapterPosition,
        estimatedDuration: chapter.estimatedDuration,
        ...(quickCheckId ? { quickCheckId } : {}),
        lessons: {
          create: chapter.lessons.map((lesson, lessonPosition) => ({
            id: newId('lesson'),
            position: lessonPosition,
            lessonType: lesson.lessonType,
            headline: lesson.headline,
            body: lesson.body,
            payload: lesson.payload,
          })),
        },
      },
    });
  }
}

async function loadExistingAssets(courseId: string): Promise<Record<AssetName, StoredAsset>> {
  const filenames = Object.values(assetSources).map((source) => path.basename(source));
  const records = await prisma.courseAsset.findMany({
    where: {
      filename: { in: filenames },
      r2Key: { startsWith: `courses/${courseId}/` },
    },
    select: {
      r2Key: true,
      filename: true,
      contentType: true,
      byteSize: true,
      deliveryUrl: true,
    },
  });
  if (records.length !== filenames.length) {
    throw new Error('Cannot replace course without its existing asset inventory');
  }

  const recordsByFilename = new Map(records.map((record) => [record.filename, record]));
  const assets = {} as Record<AssetName, StoredAsset>;
  for (const [assetName, source] of Object.entries(assetSources) as Array<[AssetName, string]>) {
    const record = recordsByFilename.get(path.basename(source));
    if (!record) {
      throw new Error('Cannot replace course without its existing asset inventory');
    }
    assets[assetName] = {
      r2Key: record.r2Key,
      filename: record.filename,
      contentType: record.contentType ?? contentTypeFor(record.filename),
      byteSize: record.byteSize ?? 0,
      deliveryUrl: record.deliveryUrl,
    };
  }
  return assets;
}

async function createCourse(
  courseId: string,
  assets: Record<AssetName, StoredAsset>,
): Promise<void> {
  const chapters = chapterDefinitions(assets);
  const settings = courseSettings(assets);

  await prisma.$transaction(async (tx) => {
    await tx.course.create({
      data: {
        id: courseId,
        slug: COURSE_SLUG,
        ...settings,
      },
    });

    for (const asset of Object.values(assets)) {
      await tx.courseAsset.create({
        data: {
          r2Key: asset.r2Key,
          filename: asset.filename,
          contentType: asset.contentType,
          byteSize: asset.byteSize,
          deliveryUrl: asset.deliveryUrl,
        },
      });
    }

    await createCourseChapters(tx, courseId, chapters);
  });
}

async function replaceCourse(): Promise<void> {
  loadDatabaseEnvironment();

  const course = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    select: { id: true },
  });
  if (!course) {
    throw new Error(`Course ${COURSE_SLUG} must be seeded before it can be replaced.`);
  }

  const assets = await loadExistingAssets(course.id);
  const chapters = chapterDefinitions(assets);
  const settings = courseSettings(assets);

  await prisma.$transaction(async (tx) => {
    await tx.courseLessonTrash.deleteMany({ where: { courseId: course.id } });
    await tx.courseChapter.deleteMany({ where: { courseId: course.id } });
    await tx.courseQuiz.deleteMany({ where: { courseId: course.id } });
    await tx.course.update({ where: { id: course.id }, data: settings });
    await createCourseChapters(tx, course.id, chapters);
  });

  console.log(`/studio/${course.id}`);
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  if (
    arguments_.length > 1 ||
    (arguments_.length === 1 && arguments_[0] !== '--sources' && arguments_[0] !== '--replace')
  ) {
    throw new Error('Usage: tsx scripts/seed-moto-g87-course.ts [--sources|--replace]');
  }

  assertMotoG87SeedStructure();

  if (arguments_.includes('--sources')) {
    await uploadVeniceSources();
    return;
  }

  if (arguments_.includes('--replace')) {
    await replaceCourse();
    return;
  }

  loadDatabaseEnvironment();

  const existing = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    select: { id: true },
  });
  if (existing) {
    console.log(`/studio/${existing.id}`);
    return;
  }

  await assertPreflight();

  const courseId = newId('course');
  let uploadedAssets: Record<AssetName, StoredAsset> | undefined;
  try {
    uploadedAssets = await uploadAssets(courseId);
    await createCourse(courseId, uploadedAssets);
  } catch (error) {
    if (uploadedAssets) {
      await Promise.all(
        Object.values(uploadedAssets).map((asset) =>
          deleteCourseAsset(asset.r2Key).catch(() => undefined),
        ),
      );
    }
    throw error;
  }

  console.log(`/studio/${courseId}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
