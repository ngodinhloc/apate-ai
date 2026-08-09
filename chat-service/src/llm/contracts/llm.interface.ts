import { Message } from '../../chat/contracts/chat.interface';

export enum SupportedModels {
  CLAUDE_HAIKU_4_5 = 'claude-haiku-4-5-20251001',
  CLAUDE_SONNET_5 = 'claude-sonnet-5',
  CLAUDE_OPUS_5 = 'claude-opus-5',
}

export interface AgentReply {
  text: string;
  scamProbability: number;
}

export interface AdapterInterface {
  reply(conversationId: string, history: Message[]): Promise<AgentReply>;
}
