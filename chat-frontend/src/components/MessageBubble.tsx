import { Volume2 } from 'lucide-react';
import { Message } from '@/types/chat';
import { isTextToSpeechSupported, speak } from '@/lib/speech';

export default function MessageBubble({ message }: { message: Message }) {
  const isScammer = message.sender === 'user';

  return (
    <div
      className={`flex items-end gap-1.5 ${isScammer ? 'justify-start' : 'justify-end'}`}
    >
      {!isScammer && isTextToSpeechSupported() && (
        <button
          type="button"
          onClick={() => speak(message.text)}
          title="Play aloud"
          className="mb-1 shrink-0 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <Volume2 size={13} />
        </button>
      )}
      <div
        className={
          isScammer
            ? 'max-w-xl rounded-2xl rounded-tl-none bg-zinc-200 px-4 py-3 text-sm text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
            : 'max-w-xl rounded-2xl rounded-tr-none bg-indigo-600 px-4 py-3 text-sm text-white shadow-sm'
        }
      >
        {message.text}
      </div>
    </div>
  );
}
