import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import {
  askCourseQuestion,
  generateCourseQuiz,
  uploadCourseDocument,
  deleteCourseDocument,
  RagServiceError,
} from './parser-service';

describe('Parser Service Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('PARSER_SERVICE_URL', 'http://mock-service:8000');
    vi.stubEnv('PARSER_SERVICE_TOKEN', 'mock-token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  test('askCourseQuestion calls /api/chat and returns validated data', async () => {
    const mockResponse = {
      answer: 'Mocked answer',
      sources: ['doc1.pdf'],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await askCourseQuestion('course-1', 'What is AI?');
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-service:8000/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'X-Internal-Token': 'mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ course_id: 'course-1', query: 'What is AI?' }),
      }),
    );
  });

  test('askCourseQuestion handles fetch error by throwing RagServiceError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    await expect(askCourseQuestion('course-1', 'query')).rejects.toThrow(
      RagServiceError,
    );
    await expect(askCourseQuestion('course-1', 'query')).rejects.toThrow(
      'The AI assistant is temporarily unavailable. Please try again in a moment.',
    );
  });

  test('askCourseQuestion handles malformed JSON response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ malformed: 'structure' }),
    } as Response);

    await expect(askCourseQuestion('course-1', 'query')).rejects.toThrow(
      RagServiceError,
    );
  });

  test('generateCourseQuiz calls /api/generate-quiz and parses questions correctly', async () => {
    const mockResponse = {
      questions: [
        {
          question: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          correct_answer_index: 2,
        },
        {
          question: 'Q2',
          options: ['A', 'B', 'C', 'D'],
          correct_answer_index: 0,
        },
        {
          question: 'Q3',
          options: ['A', 'B', 'C', 'D'],
          correct_answer_index: 1,
        },
        {
          question: 'Q4',
          options: ['A', 'B', 'C', 'D'],
          correct_answer_index: 3,
        },
        {
          question: 'Q5',
          options: ['A', 'B', 'C', 'D'],
          correct_answer_index: 1,
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await generateCourseQuiz('course-1', ['topic1']);
    expect(result.questions).toHaveLength(5);
    expect(result.questions[0]).toEqual({
      question: 'Q1',
      options: ['A', 'B', 'C', 'D'],
      correctAnswerIndex: 2,
    });
  });

  test('uploadCourseDocument uploads file via FormData and returns response', async () => {
    const mockResponse = {
      status: 'success',
      filename: 'file.pdf',
      chunks_stored: 42,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const file = new File(['hello'], 'file.pdf', { type: 'application/pdf' });
    const result = await uploadCourseDocument('course-1', file);

    expect(result).toEqual({
      status: 'success',
      filename: 'file.pdf',
      chunksStored: 42,
    });
  });

  test('deleteCourseDocument calls DELETE /api/document and returns response', async () => {
    const mockResponse = {
      status: 'deleted',
      filename: 'file.pdf',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await deleteCourseDocument('course-1', 'file.pdf');
    expect(result).toEqual(mockResponse);
  });
});
