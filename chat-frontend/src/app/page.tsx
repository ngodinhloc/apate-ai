import { Suspense } from 'react';
import ScamChat from '@/components/ScamChat';

export default function ChatPage() {
  return (
    <Suspense>
      <ScamChat />
    </Suspense>
  );
}
