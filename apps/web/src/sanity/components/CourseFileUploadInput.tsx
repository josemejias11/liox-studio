import React, { useRef, useState, useCallback, useMemo } from 'react';
import { ArrayOfObjectsInputProps, PatchEvent, unset, useFormValue } from 'sanity';
import { Button, Card, Flex, Text, Box, Stack, Badge } from '@sanity/ui';
import { MAX_UPLOAD_BYTES, UploadResponseSchema } from '@/lib/contracts/api';
import {
  DocumentIndexResultSchema,
  JobStatusResponseSchema,
  type JobStatusResponse,
} from '@moto-ai/contracts/jobs';

type UploadedFile = {
  _key: string;
  _type: 'uploadedFile';
  filename: string;
  chunks: number;
  uploadedAt: string;
};

type SessionFileStatus = {
  name: string;
  state: 'pending' | 'uploading' | 'success' | 'error';
  chunks?: number;
  errorReason?: string;
  progress?: string;
};

function uploadErrorReason(status: number): string {
  if (status === 401) return 'Not logged in — visit /analytics/login first';
  if (status === 413) return 'File too large (50 MB limit)';
  if (status === 502) return 'Upload service unavailable';
  return `Upload failed (HTTP ${status})`;
}

function deleteErrorReason(status: number): string {
  if (status === 401) return 'Not authorized to remove this file';
  if (status === 502) return 'Document removal service unavailable';
  return `Could not remove document (HTTP ${status})`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForJob(jobId: string): Promise<JobStatusResponse> {
  for (let attempt = 0; attempt < 300; attempt++) {
    const response = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Job status request failed (${response.status})`);
    const parsed = JobStatusResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Job status response failed validation');
    if (parsed.data.status === 'succeeded' || parsed.data.status === 'failed') return parsed.data;
    await sleep(1_000);
  }
  throw new Error('Document indexing timed out');
}

export function CourseFileUploadInput(props: ArrayOfObjectsInputProps) {
  const { value, onChange } = props;
  const indexedFiles = useMemo(() => (value ?? []) as UploadedFile[], [value]);

  const document = useFormValue([]) as { _id?: string } | undefined;
  const courseId = document?._id?.replace(/^drafts\./, '');

  const [sessionStatuses, setSessionStatuses] = useState<SessionFileStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (inputRef.current) inputRef.current.value = '';
      if (files.length === 0 || !courseId) return;

      const initial: SessionFileStatus[] = files.map((f) => ({ name: f.name, state: 'pending' }));
      setSessionStatuses(initial);
      setIsUploading(true);

      const results: SessionFileStatus[] = [...initial];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > MAX_UPLOAD_BYTES) {
          results[i] = {
            name: file.name,
            state: 'error',
            errorReason: 'File too large (50 MB limit)',
          };
          setSessionStatuses([...results]);
          continue;
        }

        results[i] = { name: file.name, state: 'uploading', progress: 'queueing' };
        setSessionStatuses([...results]);

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('course_id', courseId);

          const response = await fetch('/api/upload', { method: 'POST', body: formData });
          const parsed = response.ok
            ? UploadResponseSchema.safeParse(await response.json())
            : undefined;

          if (parsed?.success) {
            results[i] = { name: file.name, state: 'uploading', progress: 'queued' };
            setSessionStatuses([...results]);
            const job = await waitForJob(parsed.data.jobId);
            if (job.status === 'failed') {
              results[i] = {
                name: file.name,
                state: 'error',
                errorReason: job.errorMessage ?? 'Document indexing failed',
              };
              setSessionStatuses([...results]);
              continue;
            }
            const indexed = DocumentIndexResultSchema.safeParse(job.result);
            if (!indexed.success) throw new Error('Document indexing result failed validation');
            results[i] = { name: file.name, state: 'success', chunks: indexed.data.chunksStored };
            // The worker writes the durable course-material row to Sanity before
            // the job succeeds. The Studio only reports its status, so closing
            // this tab cannot lose the indexed-file metadata.
          } else {
            results[i] = {
              name: file.name,
              state: 'error',
              errorReason: uploadErrorReason(response.status),
            };
          }
        } catch {
          results[i] = { name: file.name, state: 'error', errorReason: 'Network error' };
        }

        setSessionStatuses([...results]);
      }

      setIsUploading(false);
    },
    [courseId],
  );

  const handleRemove = useCallback(
    async (file: UploadedFile) => {
      if (!courseId) {
        setSessionStatuses([
          { name: file.filename, state: 'error', errorReason: 'Course is not ready for removal' },
        ]);
        return;
      }

      try {
        const response = await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ course_id: courseId, filename: file.filename }),
        });
        if (!response.ok) throw new Error(deleteErrorReason(response.status));
      } catch (error: unknown) {
        setSessionStatuses([
          {
            name: file.filename,
            state: 'error',
            errorReason: error instanceof Error ? error.message : 'Could not remove document',
          },
        ]);
        return;
      }

      onChange(PatchEvent.from(unset([{ _key: file._key }])));
    },
    [courseId, onChange],
  );

  return (
    <Card padding={4} radius={2} shadow={1} border>
      <Stack space={4}>
        {/* Header */}
        <Box>
          <Text size={1} weight="medium">
            Course Material (PDF, PPTX, DOCX, XLSX)
          </Text>
          <Text size={1} muted style={{ marginTop: '8px' }}>
            All indexed files are listed below. Uploading again replaces that file&apos;s chunks.
          </Text>
        </Box>

        {/* Upload button */}
        <Flex align="center" gap={3}>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.pptx,.docx,.xlsx"
            multiple
            onChange={handleFileChange}
            disabled={isUploading || !courseId}
            style={{ display: 'none' }}
            id="course-file-upload"
          />
          <Button
            as="label"
            htmlFor="course-file-upload"
            text={isUploading ? 'Uploading…' : 'Add Files'}
            mode="ghost"
            aria-disabled={isUploading || !courseId}
            style={{ cursor: isUploading || !courseId ? 'not-allowed' : 'pointer' }}
          />
        </Flex>

        {/* In-progress session status */}
        {sessionStatuses.length > 0 && (
          <Stack space={2}>
            {sessionStatuses.map((f, i) => (
              <Flex key={i} align="center" gap={2}>
                <Badge
                  tone={
                    f.state === 'success'
                      ? 'positive'
                      : f.state === 'error'
                        ? 'critical'
                        : 'caution'
                  }
                >
                  {f.state === 'uploading'
                    ? (f.progress ?? 'processing')
                    : f.state === 'success'
                      ? `✓ ${f.chunks} chunks`
                      : f.state === 'error'
                        ? (f.errorReason ?? 'failed')
                        : 'queued'}
                </Badge>
                <Text size={1} muted textOverflow="ellipsis">
                  {f.name}
                </Text>
              </Flex>
            ))}
          </Stack>
        )}

        {/* Persistent indexed file library */}
        {indexedFiles.length > 0 && (
          <Stack space={1}>
            <Text
              size={0}
              weight="semibold"
              muted
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 0' }}
            >
              Indexed files ({indexedFiles.length})
            </Text>
            {indexedFiles.map((f) => (
              <Flex key={f._key} align="center" gap={2} style={{ paddingTop: '6px' }}>
                <Flex direction="column" gap={2} flex={1} style={{ minWidth: 0 }}>
                  <Text size={1} textOverflow="ellipsis">
                    {f.filename}
                  </Text>
                  <Text size={0} muted>
                    {f.chunks} chunks · {new Date(f.uploadedAt).toLocaleDateString()}
                  </Text>
                </Flex>
                <Button
                  text="✕"
                  mode="bleed"
                  tone="critical"
                  padding={2}
                  fontSize={1}
                  onClick={() => handleRemove(f)}
                  title={`Remove ${f.filename}`}
                  style={{ flexShrink: 0 }}
                />
              </Flex>
            ))}
          </Stack>
        )}

        {indexedFiles.length === 0 && sessionStatuses.length === 0 && (
          <Text size={1} muted>
            No files indexed yet. Add files above to populate the AI knowledge base.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
