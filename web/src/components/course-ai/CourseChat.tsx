'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatResponseSchema } from '@/lib/contracts/chat';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const USER_SAFE_ERROR =
  "Sorry — I couldn't reach the assistant just now. Please try again in a moment.";

export function CourseChat({ courseId }: { courseId?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm your AI course assistant. Feel free to ask me any questions about the uploaded materials.",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      if (!courseId) throw new Error('Missing courseId');

      // Proxied through the Next.js route handler — the browser never calls
      // the parser service directly.
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          query: userMsg.content,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat request failed (${res.status})`);
      }

      const parsed = ChatResponseSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error('Chat response failed validation');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: parsed.data.answer,
        },
      ]);
    } catch (error: unknown) {
      console.warn('Chat request failed:', error instanceof Error ? error.message : error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: USER_SAFE_ERROR,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/50 bg-white/70 shadow-xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/70">
      {/* Header */}
      <div className="flex items-center border-b border-slate-200/50 bg-white/50 px-6 py-4 dark:border-slate-800/50 dark:bg-slate-900/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="ml-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Course AI Assistant
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ask questions about your materials
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full shadow-sm ${
                    msg.role === 'user'
                      ? 'ml-3 bg-slate-800 text-white'
                      : 'mr-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'
                  }`}
                >
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={`rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-slate-800 text-white'
                      : 'rounded-tl-sm border border-slate-100 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex max-w-[80%] flex-row">
                <div className="mt-1 mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 shadow-sm dark:bg-indigo-900/50 dark:text-indigo-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    className="h-2 w-2 rounded-full bg-indigo-400"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="h-2 w-2 rounded-full bg-indigo-400"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="h-2 w-2 rounded-full bg-indigo-400"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200/50 bg-slate-50/50 p-4 dark:border-slate-800/50 dark:bg-slate-900/80">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about the course material..."
            className="flex-1 bg-transparent px-6 py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="mr-2 flex items-center justify-center rounded-full bg-indigo-600 p-2.5 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="ml-0.5 h-4 w-4" />
            )}
          </button>
        </form>
        <div className="mt-2 text-center">
          <span className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
            AI can make mistakes. Verify important info.
          </span>
        </div>
      </div>
    </div>
  );
}
