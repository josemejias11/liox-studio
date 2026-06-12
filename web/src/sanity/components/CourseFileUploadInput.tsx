import React, { useState, useCallback } from 'react';
import { StringInputProps, set, useFormValue } from 'sanity';
import { Button, Card, Flex, Text, Box, Stack, Badge } from '@sanity/ui';
import { MAX_UPLOAD_BYTES, UploadResponseSchema } from '@/lib/contracts/upload';

export function CourseFileUploadInput(props: StringInputProps) {
  const { value, onChange } = props;
  const document = useFormValue([]) as { _id?: string } | undefined;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const courseId = document?._id?.replace(/^drafts\./, '');

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !courseId) return;

      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadStatus('error');
        return;
      }

      setIsUploading(true);
      setUploadStatus('idle');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('course_id', courseId);

      try {
        // Proxied through the Next.js route handler — the Studio never calls
        // the parser service directly.
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const parsed = response.ok
          ? UploadResponseSchema.safeParse(await response.json())
          : undefined;

        if (parsed?.success) {
          setUploadStatus('success');
          onChange(set(`Uploaded: ${parsed.data.filename} (${parsed.data.chunks_stored} chunks)`));
        } else {
          setUploadStatus('error');
        }
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadStatus('error');
      } finally {
        setIsUploading(false);
      }
    },
    [courseId, onChange],
  );

  return (
    <Card padding={4} radius={2} shadow={1} border>
      <Stack space={4}>
        <Box>
          <Text size={1} weight="medium">Upload Course Material (PDF, PPTX, DOCX)</Text>
          <Text size={1} muted style={{ marginTop: '8px' }}>
            Upload files directly to the AI backend for processing.
          </Text>
        </Box>

        <Flex align="center" gap={3}>
          <input
            type="file"
            accept=".pdf,.pptx,.docx"
            onChange={handleFileChange}
            disabled={isUploading || !courseId}
            style={{ display: 'none' }}
            id="course-file-upload"
          />
          <Button
            as="label"
            htmlFor="course-file-upload"
            text={isUploading ? 'Uploading...' : 'Select File'}
            mode="ghost"
            disabled={isUploading || !courseId}
            style={{ cursor: isUploading || !courseId ? 'not-allowed' : 'pointer' }}
          />

          {uploadStatus === 'success' && <Badge tone="positive">Upload Successful</Badge>}
          {uploadStatus === 'error' && <Badge tone="critical">Upload Failed</Badge>}
        </Flex>

        {value && (
          <Box padding={3} style={{ backgroundColor: '#f4f5f7', borderRadius: '4px' }}>
            <Text size={1} muted>Current Status: {value}</Text>
          </Box>
        )}
      </Stack>
    </Card>
  );
}
