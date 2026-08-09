export enum ExtractDataTypeEnum {
  NAME = 'name',
  EMAIL = 'email',
  PHONE = 'phone',
  ADDRESS = 'address',
  BANK_ACCOUNT_AU = 'bank_account_au',
  BANK_ACCOUNT_UK = 'bank_account_uk',
  PAYID = 'pay_id',
}

export enum ExtractStatusEnum {
  NEW = 0,
  PROCESSED = 1,
  PROCESSING = 2,
}

/** Mirrors chat-service's Message shape — the only fields extraction needs. */
export interface ExtractMessage {
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

/** Mirrors chat-service's Conversation shape — the payload chat-service posts here (HTTP) or publishes as event data (RabbitMQ). */
export interface ExtractConversationInput {
  conversationId: string;
  messages: ExtractMessage[];
  scamProbability: number;
  status: number;
  createdAt: Date;
  modifiedAt: Date;
}

export interface ExtractInput {
  conversations: ExtractConversationInput[];
}

export interface ExtractItem {
  dataType: ExtractDataTypeEnum;
  value: string;
}

export interface ExtractConversation {
  conversationUuid: string;
  items: ExtractItem[];
}

export interface ExtractOutput {
  conversations: ExtractConversation[];
}

/** Mirrors chat-service's EXCHANGE_APATE / EVENT_CONVERSATION_ENDED — kept in sync by hand. */
export const EXCHANGE_APATE = 'apapte';
export const EVENT_CONVERSATION_ENDED = 'apate.conversation.ended';
export const QUEUE_CONVERSATION_ENDED =
  'extract-service.conversation.ended.queue';

/** Received on EXCHANGE_APATE under EVENT_CONVERSATION_ENDED when chat-service's EXTRACT_ACTION is Async. */
export interface ConversationEvent {
  eventName: typeof EVENT_CONVERSATION_ENDED;
  data: ExtractConversationInput;
}
