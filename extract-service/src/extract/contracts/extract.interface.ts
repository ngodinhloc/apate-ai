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

export interface ExtractMessage {
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

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

export const EXCHANGE_APATE = 'apapte';
export const EVENT_CONVERSATION_ENDED = 'apate.conversation.ended';
export const EXTRACT_SERVICE_QUEUE = 'extract-service.queue';

export interface ConversationEvent {
  eventName: typeof EVENT_CONVERSATION_ENDED;
  data: ExtractConversationInput;
}
