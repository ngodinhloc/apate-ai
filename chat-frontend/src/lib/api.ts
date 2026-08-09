import {
  Conversation,
  ConversationSummary,
  ExtractConversation,
} from '@/types/chat';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, cache: 'no-store' });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function newChat(text: string): Promise<Conversation> {
  return request('/api/chat/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function continueChat(
  conversationId: string,
  text: string,
): Promise<Conversation> {
  return request(`/api/chat/${conversationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function endChat(conversationId: string): Promise<void> {
  await request(`/api/chat/${conversationId}/end`, { method: 'POST' });
}

export async function getChat(conversationId: string): Promise<Conversation> {
  return request(`/api/chat/${conversationId}`);
}

export async function getHistory(): Promise<ConversationSummary[]> {
  return request('/api/chat/');
}

export async function getExtractions(
  conversationId: string,
): Promise<ExtractConversation> {
  return request(`/api/extract/${conversationId}`);
}
