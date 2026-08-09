import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';
import {
  ExtractConversation,
  ExtractConversationInput,
  ExtractOutput,
} from '../../extract/contracts/extract.interface';
import { EXTRACTOR_SYSTEM_PROMT } from '../templates/system.prompts';
import { EXTRACT_OUTPUT_SCHEMA } from '../templates/output.schemas';
import { AdapterInterface, SupportedModels } from '../contracts/llm.interface';

@Injectable()
export class AnthropicAdapter implements AdapterInterface {
  private readonly client: Anthropic;

  constructor(
    envService: EnvService,
    private readonly logger: AppLogger,
  ) {
    this.client = new Anthropic({ apiKey: envService.getAnthropicApiKey() });
  }

  async extractBatch(
    conversations: ExtractConversationInput[],
  ): Promise<ExtractConversation[]> {
    const defaultResult: ExtractConversation[] = conversations.map(
      (conversation) => ({
        conversationUuid: conversation.conversationId,
        items: [],
      }),
    );

    const response = await this.client.messages.create(
      this.buildMessageRequest(conversations),
    );

    if (response.stop_reason === 'refusal') {
      this.logger.warn('AnthropicAdapter.extractBatch: Claude refused', {
        conversationIds: conversations.map((c) => c.conversationId),
        category: response.stop_details?.category ?? 'unknown',
      });
      return defaultResult;
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      this.logger.error(
        'AnthropicAdapter.extractBatch: no text block in response',
        { conversationIds: conversations.map((c) => c.conversationId) },
      );
      return defaultResult;
    }

    // output_config.format guarantees schema-valid JSON — no retry/parse loop needed.
    return (JSON.parse(textBlock.text) as ExtractOutput).conversations;
  }

  private buildMessageRequest(
    conversations: ExtractConversationInput[],
  ): Anthropic.MessageCreateParamsNonStreaming {
    return {
      model: SupportedModels.CLAUDE_SONNET_5,
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: EXTRACTOR_SYSTEM_PROMT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: JSON.stringify(
            conversations.map((conversation) => ({
              conversationUuid: conversation.conversationId,
              messages: conversation.messages,
            })),
          ),
        },
      ],
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: EXTRACT_OUTPUT_SCHEMA },
      },
    };
  }
}
