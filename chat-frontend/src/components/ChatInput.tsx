'use client';

import { useCallback, useState, FormEvent } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';

interface ChatInputProps {
  onSend: (text: string) => void;
  loading: boolean;
  placeholder?: string;
  // Typing a message and submitting it switches back to text mode; starting
  // a recording switches into voice mode — these let ScamChat's "Voice on"
  // toggle track how the user is actually interacting.
  onManualSubmit?: () => void;
  onRecordStart?: () => void;
}

export default function ChatInput({
  onSend,
  loading,
  placeholder = "Paste the scammer's message…",
  onManualSubmit,
  onRecordStart,
}: ChatInputProps) {
  const [value, setValue] = useState('');

  // Recording is push-to-talk: click to start, click again to stop — the
  // stop is what triggers the send, with whatever transcript was captured.
  const handleFinalTranscript = useCallback(
    (transcript: string) => {
      const combined = value
        ? `${value} ${transcript}`.trim()
        : transcript.trim();
      if (combined) {
        onSend(combined);
        setValue('');
      }
    },
    [value, onSend],
  );

  const { listening, supported, start, stop } = useSpeechToText(
    handleFinalTranscript,
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim()) {
      onManualSubmit?.();
      onSend(value.trim());
      setValue('');
    }
  }

  function handleRecordClick() {
    if (listening) {
      stop();
    } else {
      onRecordStart?.();
      start();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={listening ? 'Listening…' : placeholder}
        disabled={loading}
        className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {supported && (
        <button
          type="button"
          onClick={handleRecordClick}
          disabled={loading}
          title={listening ? 'Stop recording' : 'Speak your message'}
          className={
            listening
              ? 'flex items-center justify-center rounded-full bg-red-600 p-3 text-white shadow-sm animate-pulse disabled:opacity-50'
              : 'flex items-center justify-center rounded-full border border-zinc-300 bg-white p-3 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
          }
        >
          {listening ? <Square size={15} /> : <Mic size={15} />}
        </button>
      )}
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        <Send size={15} />
        {loading ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
