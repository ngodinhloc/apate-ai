export enum StatusEnum {
  Inprogress = 0,
  Ended = 1,
}

export enum ChannelEnum {
  Portal = 'portal',
  Facebook = 'facebook',
  Whatsapp = 'whatsapp',
}

export enum ChatSender {
  user = 'user',
  agent = 'agent',
}

export interface Message {
  sender: ChatSender;
  text: string;
  timestamp: Date;
}

export interface Conversation {
  conversationId: string;
  channel: ChannelEnum;
  messages: Message[];
  scamProbability: number;
  status: StatusEnum;
  createdAt: Date;
  modifiedAt: Date;
}

/** Structured output Claude returns for each agent turn. */
export interface ChatResponse {
  conversationId: string;
  text: string;
  scamProbability: number;
}

export enum AgentStatus {
  isThinking = 'isThinking',
  hasReplied = 'hasReplied',
}

/** Live-only shape held in Redis while a conversation is in progress; never persisted as-is. */
export interface LiveConversation extends Conversation {
  agentStatus: AgentStatus;
}

/** Auto-generated title + createdAt, as returned by the history list endpoint. */
export interface ConversationSummary {
  conversationId: string;
  title: string | null;
  status: StatusEnum;
  createdAt: Date;
}

/** How chat-service hands off an ended conversation to extract-service. */
export enum ExtractAction {
  Sync = 1,
  Async = 2,
}

export const EXCHANGE_APATE = 'apapte';
export const EVENT_CONVERSATION_ENDED = 'apate.conversation.ended';

/** Published to EXCHANGE_APATE under EVENT_CONVERSATION_ENDED when EXTRACT_ACTION is Async. */
export interface ConversationEvent {
  eventName: typeof EVENT_CONVERSATION_ENDED;
  data: Conversation;
}
