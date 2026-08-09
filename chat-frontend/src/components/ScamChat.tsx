'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import LoadingSkeleton from './LoadingSkeleton';
import ExtractionsPanel from './ExtractionsPanel';
import { newChat, continueChat, getChat } from '@/lib/api';
import { Conversation, StatusEnum } from '@/types/chat';

function buildWsUrl(): string {
  const base = process.env.NEXT_PUBLIC_WS_URL;
  if (base) return `${base}/ws`;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.hostname}:8000/ws`;
  }
  return 'ws://localhost:8000/ws';
}

export default function ScamChat() {
  const searchParams = useSearchParams();
  const session = searchParams.get('session');
  const chatId = searchParams.get('chat');

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const statusRef = useRef<StatusEnum | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  function disconnectWs() {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  // New chat — full reset. Does not end the conversation being left — only a
  // real tab close/refresh does that (below) — so it stays live in Redis and
  // can be resumed without a DB round-trip if the user switches back to it.
  useEffect(() => {
    disconnectWs();
    conversationIdRef.current = null;
    statusRef.current = null;
    setConversation(null);
    setError(null);
    setLoading(false);
  }, [session]);

  // Load a past conversation from history — read-only, no reconnect to Claude
  useEffect(() => {
    if (!chatId) return;
    disconnectWs();
    conversationIdRef.current = chatId;
    setError(null);
    setLoading(true);

    getChat(chatId)
      .then((c) => {
        statusRef.current = c.status;
        setConversation(c);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Failed to load conversation.',
        ),
      )
      .finally(() => setLoading(false));
  }, [chatId]);

  useEffect(() => () => disconnectWs(), []);

  // The only trigger for ending an in-progress conversation: a real tab
  // close/refresh. sendBeacon is the reliable way to get the request out
  // during unload — a regular fetch can get cancelled mid-flight.
  useEffect(() => {
    function handleUnload() {
      const id = conversationIdRef.current;
      if (id && statusRef.current === StatusEnum.Inprogress) {
        navigator.sendBeacon(`/api/chat/${id}/end`);
      }
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  function subscribe(conversationId: string) {
    disconnectWs();
    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () =>
      ws.send(JSON.stringify({ event: 'subscribe', data: conversationId }));

    ws.onmessage = (evt) => {
      try {
        const { event: type, data } = JSON.parse(evt.data as string) as {
          event: string;
          data: Conversation | string;
        };

        if (type === 'error') {
          setLoading(false);
          setError(typeof data === 'string' ? data : 'Agent error.');
          return;
        }
        if (type !== 'chat-update') return;

        const updated = data as Conversation;
        statusRef.current = updated.status;
        setConversation(updated);

        if (updated.agentStatus === 'hasReplied') {
          setLoading(false);
          disconnectWs();
        }
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onerror = () => {
      setLoading(false);
      setError('Connection error. Please try again.');
    };
  }

  async function handleSend(text: string) {
    setError(null);
    setLoading(true);

    try {
      if (!conversationIdRef.current) {
        const created = await newChat(text);
        conversationIdRef.current = created.conversationId;
        statusRef.current = created.status;
        setConversation(created);
        subscribe(created.conversationId);
      } else {
        subscribe(conversationIdRef.current);
        await continueChat(conversationIdRef.current, text);
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center bg-zinc-50 px-4 pt-16 dark:bg-zinc-950">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <ShieldAlert size={28} />
            <span className="text-2xl font-bold tracking-tight">Apate AI</span>
          </div>
          <ChatInput onSend={handleSend} loading={loading} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto max-w-2xl space-y-4">
            {conversation.messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {loading && <LoadingSkeleton />}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}
            <div ref={conversationEndRef} />
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <ChatInput
              onSend={handleSend}
              loading={loading}
              placeholder="Reply as the scammer…"
            />
          </div>
        </div>
      </div>

      <ExtractionsPanel
        conversationId={conversation.conversationId}
        scamProbability={conversation.scamProbability}
      />
    </div>
  );
}
