import React, { useRef, useState, useCallback } from 'react';
import { StringInputProps, set, useFormValue } from 'sanity';
import { Button, Card, Flex, Text, Box, Stack, Badge } from '@sanity/ui';
import { MAX_UPLOAD_BYTES, UploadResponseSchema } from '@/lib/contracts/upload';

type FileStatus = {
  name: string;
  state: 'pending' | 'uploading' | 'success' | 'error';
  chunks?: number;
};

export function CourseFileUploadInput(props: StringInputProps) {
  const { value, onChange } = props;
  const document = useFormValue([]) as { _id?: string } | undefined;
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const courseId = document?._id?.replace(/^drafts\./, '');

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      // Reset the input so the same files can be re-selected after an error.
      if (inputRef.current) inputRef.current.value = '';
      if (files.length === 0 || !courseId) return;

      const initial: FileStatus[] = files.map((f) => ({ name: f.name, state: 'pending' }));
      setFileStatuses(initial);
      setIsUploading(true);

      const results: FileStatus[] = [...initial];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > MAX_UPLOAD_BYTES) {
          results[i] = { name: file.name, state: 'error' };
          setFileStatuses([...results]);
          continue;
        }

        results[i] = { name: file.name, state: 'uploading' };
        setFileStatuses([...results]);

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
          } else {
            results[i] = { name: file.name, state: 'error' };
          }
        } catch {
          results[i] = { name: file.name, state: 'error' };
        }

        setFileStatuses([...results]);
      }

      setIsUploading(false);

      // Persist a summary string to the Sanity field.
      const succeeded = results.filter((r) => r.state === 'success');
      if (succeeded.length > 0) {
        const detail = succeeded
          .map((r) => `${r.name} (${r.chunks} chunks)`)
          .join(', ');
        onChange(set(`${succeeded.length} file${succeeded.length > 1 ? 's' : ''}: ${detail}`));
      }
    },
    [courseId, onChange],
  );

  return (
    <Card padding={4} radius={2} shadow={1} border>
      <Stack space={4}>
        <Box>
          <Text size={1} weight="medium">
            Upload Course Material (PDF, PPTX, DOCX, XLSX)
          </Text>
          <Text size={1} muted style={{ marginTop: '8px' }}>
            Select one or more files. Each is uploaded and indexed separately.
          </Text>
        </Box>

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
            text={isUploading ? 'Uploading…' : 'Select Files'}
            mode="ghost"
            disabled={isUploading || !courseId}
            style={{ cursor: isUploading || !courseId ? 'not-allowed' : 'pointer' }}
          />
        </Flex>

        {fileStatuses.length > 0 && (
          <Stack space={2}>
            {fileStatuses.map((f, i) => (
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
                        ? 'failed'
                        : 'queued'}
                </Badge>
                <Text size={1} muted style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.name}
                </Text>
              </Flex>
            ))}
          </Stack>
        )}

        {value && (
          <Box padding={3} style={{ backgroundColor: '#f4f5f7', borderRadius: '4px' }}>
            <Text size={1} muted>
              Last upload: {value}
            </Text>
          </Box>
        )}
      </Stack>
    </Card>
  );
}
