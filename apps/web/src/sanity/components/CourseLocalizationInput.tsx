import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Box, Button, Card, Flex, Stack, Text, TextInput } from '@sanity/ui';
import {
  insert,
  PatchEvent,
  setIfMissing,
  useClient,
  useFormValue,
  type ArrayOfObjectsInputProps,
} from 'sanity';
import { IntentLink } from 'sanity/router';
import { buildLocalizationInventory } from '../lib/localization-inventory';
import { COURSE_LOCALIZATION_SOURCE_QUERY } from '../lib/localization-query';

const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;

const STATUS_LABELS = {
  draft: 'Draft',
  readyForExport: 'Ready for export',
  exported: 'Exported',
  returned: 'Returned',
  qa: 'Lionbridge QA',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
  outdated: 'Outdated — English master changed',
} as const;

type LocaleReleaseStatus = keyof typeof STATUS_LABELS;

interface LocaleReleaseIndexItem {
  _id: string;
  _createdAt: string;
  locale: string;
  status: LocaleReleaseStatus;
  sourceRevision: string;
  unitCount: number;
}

interface CourseFormValue {
  _id?: string;
}

type ResolvedCourseSource = Parameters<typeof buildLocalizationInventory>[0];

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not create the localization release.';
}

async function releaseIdFor(
  courseId: string,
  locale: string,
  sourceRevision: string,
): Promise<string> {
  const identity = `${courseId}:${locale}:${sourceRevision}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `courseLocaleRelease.${hash}`;
}

export function CourseLocalizationInput(props: ArrayOfObjectsInputProps) {
  const { onChange, value = [] } = props;
  const client = useClient({ apiVersion: '2025-07-27' });
  const course = useFormValue([]) as CourseFormValue | undefined;
  const courseId = course?._id?.replace(/^drafts\./, '');
  const referencedReleaseKey = useMemo(
    () =>
      (value as Array<{ _ref?: string }>)
        .map((release) => release._ref)
        .filter((releaseId): releaseId is string => Boolean(releaseId))
        .join(','),
    [value],
  );
  const releaseQueryKey = `${courseId ?? ''}:${referencedReleaseKey}`;
  const [targetLocale, setTargetLocale] = useState('');
  const [releases, setReleases] = useState<LocaleReleaseIndexItem[]>([]);
  const [loadedReleaseQueryKey, setLoadedReleaseQueryKey] = useState<string>();
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'critical' | 'positive'; text: string }>();

  const fetchReleases = useCallback(async () => {
    if (!courseId) return [];

    return client.fetch<LocaleReleaseIndexItem[]>(
        `*[_type == "courseLocaleRelease" && masterCourse._ref == $courseId] | order(_createdAt desc) {
          _id,
          _createdAt,
          locale,
          status,
          sourceRevision,
          unitCount
        }`,
        { courseId },
      );
  }, [client, courseId]);

  useEffect(() => {
    if (!courseId) return;

    let isCurrent = true;
    void fetchReleases()
      .then((nextReleases) => {
        if (!isCurrent) return;
        setReleases(nextReleases);
        setLoadedReleaseQueryKey(releaseQueryKey);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setFeedback({ tone: 'critical', text: messageFrom(error) });
        setLoadedReleaseQueryKey(releaseQueryKey);
      });

    return () => {
      isCurrent = false;
    };
  }, [courseId, fetchReleases, releaseQueryKey]);

  const createRelease = useCallback(async () => {
    const locale = targetLocale.trim();
    setFeedback(undefined);

    if (!courseId) return;

    if (!LOCALE_PATTERN.test(locale)) {
      setFeedback({ tone: 'critical', text: 'Enter a valid target locale, for example es-MX.' });
      return;
    }

    setIsCreating(true);
    try {
      const source = await client.fetch<ResolvedCourseSource | null>(
        COURSE_LOCALIZATION_SOURCE_QUERY,
        { courseId },
      );
      if (!source) {
        throw new Error('The published English Course could not be resolved.');
      }

      const inventory = await buildLocalizationInventory(source);
      const existingRelease = await client.fetch<{ _id: string } | null>(
        `*[
          _type == "courseLocaleRelease" &&
          masterCourse._ref == $courseId &&
          locale == $locale &&
          sourceRevision == $sourceRevision
        ][0]{_id}`,
        { courseId, locale, sourceRevision: inventory.sourceRevision },
      );

      if (existingRelease) {
        setFeedback({
          tone: 'critical',
          text: 'A release for this locale and source revision already exists.',
        });
        return;
      }

      const releaseId = await releaseIdFor(courseId, locale, inventory.sourceRevision);

      try {
        await client.create({
          _id: releaseId,
          _type: 'courseLocaleRelease',
          masterCourse: { _type: 'reference', _ref: courseId },
          locale,
          status: 'draft',
          sourceRevision: inventory.sourceRevision,
          sourceFingerprint: inventory.fingerprint,
          sourceTitle: inventory.sourceTitle,
          unitCount: inventory.units.length,
          localizationUnits: inventory.units.map((unit, index) => ({
            _key: `unit-${index}`,
            _type: 'localizationUnit',
            ...unit,
          })),
        });
      } catch (error: unknown) {
        if (messageFrom(error).includes('already exists')) {
          setFeedback({
            tone: 'critical',
            text: 'A release for this locale and source revision already exists.',
          });
          return;
        }
        throw error;
      }

      const reference = { _key: `release-${releaseId}`, _ref: releaseId, _type: 'reference' };
      onChange(PatchEvent.from([setIfMissing([]), insert([reference], 'after', [-1])]));

      setTargetLocale('');
      setFeedback({
        tone: 'positive',
        text: `Draft release created for ${locale} with ${inventory.units.length} localization units.`,
      });
      setReleases(await fetchReleases());
      setLoadedReleaseQueryKey(releaseQueryKey);
    } catch (error: unknown) {
      setFeedback({ tone: 'critical', text: messageFrom(error) });
    } finally {
      setIsCreating(false);
    }
  }, [client, courseId, fetchReleases, onChange, releaseQueryKey, targetLocale]);

  const releaseCreationDisabled = !courseId || isCreating;
  const isLoadingReleases = Boolean(courseId && loadedReleaseQueryKey !== releaseQueryKey);
  const visibleReleases = courseId ? releases : [];

  return (
    <Stack space={4}>
      <Card border radius={3} padding={4} tone="transparent">
        <Stack space={4}>
          <Stack space={2}>
            <Text size={1} weight="semibold">
              New localization release
            </Text>
            <Text muted size={1}>
              Freeze the resolved English source into a traceable, translation-ready snapshot.
            </Text>
          </Stack>

          <Flex align="flex-end" gap={3} wrap="wrap">
            <Box style={{ minWidth: 260, flex: '1 1 320px' }}>
              <Text as="label" size={1} weight="medium">
                Target locale
              </Text>
              <Box marginTop={2}>
                <TextInput
                  aria-describedby="localization-release-help"
                  disabled={releaseCreationDisabled}
                  onChange={(event) => setTargetLocale(event.currentTarget.value)}
                  placeholder="es-MX"
                  value={targetLocale}
                />
              </Box>
            </Box>
            <Button
              disabled={releaseCreationDisabled}
              loading={isCreating}
              onClick={() => void createRelease()}
              text="Create localization release"
              tone="primary"
            />
          </Flex>

          <Text id="localization-release-help" muted size={0}>
            Use a language or language-region code, such as es or es-MX.
          </Text>

          {!courseId && (
            <Card padding={3} radius={2} tone="critical">
              <Text size={1}>Publish this Course once before creating a localization release.</Text>
            </Card>
          )}

          {feedback && (
            <Card aria-live="polite" padding={3} radius={2} tone={feedback.tone}>
              <Text size={1}>{feedback.text}</Text>
            </Card>
          )}
        </Stack>
      </Card>

      <Card border radius={3} padding={4} tone="transparent">
        <Stack space={4}>
          <Flex align="center" justify="space-between">
            <Text size={1} weight="semibold">
              Release index
            </Text>
            {isLoadingReleases && <Text muted size={0}>Loading releases…</Text>}
          </Flex>

          {!isLoadingReleases && visibleReleases.length === 0 && (
            <Text muted size={1}>No localization releases yet.</Text>
          )}

          {visibleReleases.map((release) => (
            <Card key={release._id} borderBottom paddingBottom={3} paddingTop={3} tone="transparent">
              <Flex align="center" gap={3} justify="space-between" wrap="wrap">
                <Flex align="center" gap={2}>
                  <Text size={1} weight="semibold">
                    {release.locale}
                  </Text>
                  <Badge tone={release.status === 'outdated' ? 'caution' : 'default'}>
                    {STATUS_LABELS[release.status] ?? release.status}
                  </Badge>
                </Flex>
                <Flex align="center" gap={3} wrap="wrap">
                  <Text muted size={0}>
                    Rev {release.sourceRevision.slice(0, 12)}
                  </Text>
                  <Text muted size={0}>
                    {release.unitCount} {release.unitCount === 1 ? 'unit' : 'units'}
                  </Text>
                  <IntentLink
                    intent="edit"
                    params={{ id: release._id.replace(/^drafts\./, ''), type: 'courseLocaleRelease' }}
                  >
                    Open release
                  </IntentLink>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
