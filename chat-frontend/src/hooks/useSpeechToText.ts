'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechRecognitionCtor } from '@/lib/speech';

// Records continuously (does not auto-stop on a pause) and delivers the full
// transcript once, when the caller explicitly stops the recording.
export function useSpeechToText(
  onFinalTranscript: (transcript: string) => void,
) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    transcriptRef.current = '';

    recognition.onresult = (event) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          combined += (combined ? ' ' : '') + result[0].transcript;
        }
      }
      transcriptRef.current = combined.trim();
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      if (transcriptRef.current) onFinalTranscript(transcriptRef.current);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [onFinalTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { listening, supported, start, stop };
}
