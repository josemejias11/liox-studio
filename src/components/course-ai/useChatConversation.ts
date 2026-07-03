'use client';

import { useCallback, useRef, useState } from 'react';
import { askCourseChat } from '@/lib/chat-client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseChatConversationOptions {
  courseId?: string;
  onError?: (error: unknown) => void;
}

export interface UseChatConversationReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  send: (query: string) => Promise<void>;
  reset: () => void;
}

const FALLBACK_ERROR =
  "Sorry — I couldn't reach the assistant just now. Please try again in a moment.";

/**
 * Manages chat message lifecycle: message history, loading state,
 * multi-turn conversation context, and abort-on-unmount.
 */
export function useChatConversation({
  courseId,
  onError,
}: UseChatConversationOptions = {}): UseChatConversationReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const conversationRef = useRef<ConversationTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (query: string) => {
      if (!courseId || !query.trim()) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: query.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      conversationRef.current = [
        ...conversationRef.current,
        { role: 'user', content: query.trim() },
      ];

      try {
        const data = await askCourseChat(
          { courseId, query: query.trim() },
          controller.signal,
        );

        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: 'assistant', content: data.answer },
        ]);

        conversationRef.current = [
          ...conversationRef.current,
          { role: 'assistant', content: data.answer },
        ];
      } catch (error: unknown) {
        if ((error as { name?: string }).name === 'AbortError') return;
        console.warn('Chat request failed:', error instanceof Error ? error.message : error);
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: 'assistant', content: FALLBACK_ERROR },
        ]);
        onError?.(error);
      } finally {
        if (abortRef.current === controller) {
          setIsLoading(false);
        }
      }
    },
    [courseId, onError],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
    conversationRef.current = [];
  }, []);

  return { messages, isLoading, send, reset };
}
