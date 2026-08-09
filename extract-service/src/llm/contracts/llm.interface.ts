import {
  ExtractConversation,
  ExtractConversationInput,
} from '../../extract/contracts/extract.interface';

export enum SupportedModels {
  CLAUDE_HAIKU_4_5 = 'claude-haiku-4-5-20251001',
  CLAUDE_SONNET_5 = 'claude-sonnet-5',
  CLAUDE_OPUS_5 = 'claude-opus-5',
}

export interface AdapterInterface {
  extractBatch(
    conversations: ExtractConversationInput[],
  ): Promise<ExtractConversation[]>;
}
