'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import LoadingSkeleton from './LoadingSkeleton';
import ExtractionsPanel from './ExtractionsPanel';
import { newChat, continueChat, getChat } from '@/lib/api';
import { Conversation, Message, StatusEnum } from '@/types/chat';
import { isTextToSpeechSupported, speak, stopSpeaking } from '@/lib/speech';

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
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const statusRef = useRef<StatusEnum | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const spokenIdRef = useRef<string | null>(null);
  const spokenCountRef = useRef(0);
  // chat-service replies synchronously inside POST /api/chat/, so a
  // freshly-created conversation's first setConversation() already carries
  // the agent's reply alongside the user's opening message — set by
  // handleSend right before that call, so the effect below knows to still
  // speak that first reply instead of treating it as pre-existing history.
  const freshConversationRef = useRef(false);

  // Speak new agent replies as they arrive, but never replay a conversation's
  // existing history when it's first loaded/switched to.
  useEffect(() => {
    if (!conversation) return;
    const { conversationId, messages } = conversation;

    if (spokenIdRef.current !== conversationId) {
      spokenIdRef.current = conversationId;
      spokenCountRef.current = freshConversationRef.current
        ? 1
        : messages.length;
      freshConversationRef.current = false;
    }

    const newMessages = messages.slice(spokenCountRef.current);
    spokenCountRef.current = messages.length;
    if (!voiceEnabled) return;

    const lastAgentMessage = [...newMessages]
      .reverse()
      .find((m) => m.sender === 'agent');
    if (lastAgentMessage) speak(lastAgentMessage.text);
  }, [conversation, voiceEnabled]);

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
    stopSpeaking();
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
    stopSpeaking();
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

  useEffect(
    () => () => {
      disconnectWs();
      stopSpeaking();
    },
    [],
  );

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
        freshConversationRef.current = true;
        setConversation(created);
        subscribe(created.conversationId);
      } else {
        // Append optimistically so the user's own message shows up before the
        // isThinking indicator, instead of waiting on the next WS poll tick.
        const userMessage: Message = {
          sender: 'user',
          text,
          timestamp: new Date().toISOString(),
        };
        setConversation((prev) =>
          prev ? { ...prev, messages: [...prev.messages, userMessage] } : prev,
        );
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

  // Voice mode tracks how the user is actually talking to the agent: typing
  // and submitting switches back to text, starting a recording switches into
  // voice — on top of the manual toggle below for an explicit override.
  function disableVoice() {
    stopSpeaking();
    setVoiceEnabled(false);
  }

  function enableVoice() {
    setVoiceEnabled(true);
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center bg-zinc-50 px-4 pt-16 dark:bg-zinc-950">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <ShieldAlert size={28} />
            <span className="text-2xl font-bold tracking-tight">Apate AI</span>
          </div>
          <ChatInput
            onSend={handleSend}
            loading={loading}
            onManualSubmit={disableVoice}
            onRecordStart={enableVoice}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        {isTextToSpeechSupported() && (
          <div className="mx-auto flex w-full max-w-2xl justify-end px-4 pt-4">
            <button
              type="button"
              onClick={() => (voiceEnabled ? disableVoice() : enableVoice())}
              title={voiceEnabled ? 'Mute agent voice' : 'Unmute agent voice'}
              className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {voiceEnabled ? 'Voice on' : 'Voice off'}
            </button>
          </div>
        )}
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
              onManualSubmit={disableVoice}
              onRecordStart={enableVoice}
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
