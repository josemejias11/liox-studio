'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { askCourseChat } from '@/learning/course-ai/chat-client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

export interface UseChatConversationOptions {
  courseId?: string;
  revisionId?: string;
  reviewToken?: string;
  onError?: (error: unknown) => void;
  onAssistantMessage?: (message: string) => void;
}

export interface SendChatOptions {
  displayUserMessage?: boolean;
  displayPendingAssistant?: boolean;
  queryOverride?: string;
  fallbackMessage?: string;
}

export interface UseChatConversationReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  send: (query: string, options?: SendChatOptions) => Promise<string | undefined>;
  abort: () => void;
  reset: () => void;
}

const FALLBACK_ERROR =
  "Sorry — I couldn't reach the assistant just now. Please try again in a moment.";


export function useChatConversation({
  courseId,
  revisionId,
  reviewToken,
  onError,
  onAssistantMessage,
}: UseChatConversationOptions = {}): UseChatConversationReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messageIdRef = useRef(0);

  const nextMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `chat-${messageIdRef.current}`;
  }, []);

  const send = useCallback(
    async (query: string, options: SendChatOptions = {}) => {
      if (!courseId || !query.trim()) return;
      if (Boolean(revisionId) === Boolean(reviewToken)) return;

      const {
        displayUserMessage = true,
        displayPendingAssistant = false,
        queryOverride,
        fallbackMessage = FALLBACK_ERROR,
      } = options;
      const visibleQuery = query.trim();
      const requestQuery = queryOverride?.trim() || visibleQuery;
      const pendingMessageId = displayPendingAssistant ? nextMessageId() : undefined;

      if (displayUserMessage) {
        setMessages((prev) => [
          ...prev,
          { id: nextMessageId(), role: 'user', content: visibleQuery },
        ]);
      }
      if (pendingMessageId) {
        setMessages((prev) => [
          ...prev,
          { id: pendingMessageId, role: 'assistant', content: '', pending: true },
        ]);
      }
      setIsLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await askCourseChat(
          revisionId
            ? { courseId, query: requestQuery, revisionId }
            : { courseId, query: requestQuery, reviewToken: reviewToken! },
          controller.signal,
        );

        setMessages((prev) =>
          pendingMessageId
            ? prev.map((message) =>
                message.id === pendingMessageId
                  ? { ...message, content: data.answer, pending: false }
                  : message,
              )
            : [...prev, { id: nextMessageId(), role: 'assistant', content: data.answer }],
        );
        onAssistantMessage?.(data.answer);
        return data.answer;
      } catch (error: unknown) {
        if ((error as { name?: string }).name === 'AbortError') return;
        console.warn('Chat request failed:', error instanceof Error ? error.message : error);
        setMessages((prev) =>
          pendingMessageId
            ? prev.map((message) =>
                message.id === pendingMessageId
                  ? { ...message, content: fallbackMessage, pending: false }
                  : message,
              )
            : [...prev, { id: nextMessageId(), role: 'assistant', content: fallbackMessage }],
        );
        onError?.(error);
        return undefined;
      } finally {
        if (abortRef.current === controller) {
          setIsLoading(false);
          abortRef.current = null;
        }
      }
    },
    [courseId, nextMessageId, onAssistantMessage, onError, reviewToken, revisionId],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    abort();
    setMessages([]);
  }, [abort]);

  useEffect(() => abort, [abort]);

  return { messages, isLoading, send, abort, reset };
}
