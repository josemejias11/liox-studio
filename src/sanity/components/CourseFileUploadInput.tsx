import React, { useRef, useState, useCallback, useMemo } from 'react';
import { ArrayOfObjectsInputProps, PatchEvent, insert, set, setIfMissing, unset, useFormValue } from 'sanity';
import { randomKey } from '@sanity/util/content';
import { Button, Card, Flex, Text, Box, Stack, Badge } from '@sanity/ui';
import { MAX_UPLOAD_BYTES, UploadResponseSchema } from '@/lib/contracts/api';

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
};

function uploadErrorReason(status: number): string {
  if (status === 401) return 'Not logged in — visit /analytics/login first';
  if (status === 413) return 'File too large (50 MB limit)';
  if (status === 502) return 'Upload service unavailable';
  return `Upload failed (HTTP ${status})`;
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

      // props.value does not re-render mid-loop, so track rows added/updated in
      // this batch locally to keep same-filename dedup correct within it.
      const knownFiles = new Map(indexedFiles.map((f) => [f.filename, f]));

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > MAX_UPLOAD_BYTES) {
          results[i] = { name: file.name, state: 'error', errorReason: 'File too large (50 MB limit)' };
          setSessionStatuses([...results]);
          continue;
        }

        results[i] = { name: file.name, state: 'uploading' };
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
            results[i] = { name: file.name, state: 'success', chunks: parsed.data.chunks_stored };
            const existing = knownFiles.get(file.name);
            if (existing) {
              // Same filename re-uploaded — update the existing row in-place.
              const updated: UploadedFile = {
                ...existing,
                chunks: parsed.data.chunks_stored,
                uploadedAt: new Date().toISOString(),
              };
              onChange(PatchEvent.from(set(updated, [{ _key: existing._key }])));
              knownFiles.set(file.name, updated);
            } else {
              // New file — append to the persistent array. setIfMissing makes the
              // first-ever insert persist (insert into a missing array is a no-op).
              const added: UploadedFile = {
                _key: randomKey(12),
                _type: 'uploadedFile',
                filename: file.name,
                chunks: parsed.data.chunks_stored,
                uploadedAt: new Date().toISOString(),
              };
              onChange(PatchEvent.from([setIfMissing([]), insert([added], 'after', [-1])]));
              knownFiles.set(file.name, added);
            }
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
    [courseId, onChange, indexedFiles],
  );

  const handleRemove = useCallback(
    async (file: UploadedFile) => {
      if (courseId) {
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course_id: courseId, filename: file.filename }),
          });
        } catch {
          // Non-blocking: remove the Sanity record even if the API call fails.
        }
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
                    ? 'uploading'
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
            <Text size={0} weight="semibold" muted style={{ textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 0' }}>
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
          <Text size={1} muted>No files indexed yet. Add files above to populate the AI knowledge base.</Text>
        )}
      </Stack>
    </Card>
  );
}
