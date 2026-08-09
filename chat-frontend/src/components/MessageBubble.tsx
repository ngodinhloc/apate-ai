import { Message } from '@/types/chat';

export default function MessageBubble({ message }: { message: Message }) {
  const isScammer = message.sender === 'user';

  return (
    <div className={`flex ${isScammer ? 'justify-start' : 'justify-end'}`}>
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
