export enum StatusEnum {
  Inprogress = 0,
  Ended = 1,
}

export type ChatSender = 'user' | 'agent';

export type Channel = 'portal' | 'facebook' | 'whatsapp';

export type AgentStatus = 'isThinking' | 'hasReplied';

export interface Message {
  sender: ChatSender;
  text: string;
  timestamp: string;
}

export interface Conversation {
  conversationId: string;
  channel: Channel;
  messages: Message[];
  scamProbability: number;
  status: StatusEnum;
  createdAt: string;
  modifiedAt: string;
  // Present only on the live copy streamed over the WebSocket; never on
  // history/detail responses served from PostgreSQL.
  agentStatus?: AgentStatus;
}

export interface ConversationSummary {
  conversationId: string;
  title: string | null;
  status: StatusEnum;
  createdAt: string;
}

export type ExtractDataType =
  | 'name'
  | 'email'
  | 'phone'
  | 'address'
  | 'bank_account_au'
  | 'bank_account_uk'
  | 'pay_id';

export interface ExtractItem {
  dataType: ExtractDataType;
  value: string;
}

export interface ExtractConversation {
  conversationUuid: string;
  items: ExtractItem[];
}
