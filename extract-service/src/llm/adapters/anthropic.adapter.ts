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
import { AnthropicPricingService } from '../services/anthropic.pricing';
import { AdapterInterface, SupportedModels } from '../contracts/llm.interface';

// SDK default is 2 retries with exponential backoff on 408/409/429/5xx and
// connection errors; bumped up so a batch isn't kicked back to NEW on a blip.
const MAX_RETRIES = 4;

const MAX_TOKENS = 4096;

@Injectable()
export class AnthropicAdapter implements AdapterInterface {
  private readonly client: Anthropic;

  constructor(
    envService: EnvService,
    private readonly logger: AppLogger,
    private readonly pricingService: AnthropicPricingService,
  ) {
    this.client = new Anthropic({
      apiKey: envService.getAnthropicApiKey(),
      maxRetries: MAX_RETRIES,
    });
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
    const conversationIds = conversations.map((c) => c.conversationId);

    const startedAt = Date.now();
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create(
        this.buildMessageRequest(conversations),
      );
    } catch (error) {
      this.logger.error(
        'AnthropicAdapter.extractBatch: request failed after retries',
        {
          conversationIds,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }

    this.logUsage(conversationIds, response, Date.now() - startedAt);

    if (response.stop_reason === 'refusal') {
      this.logger.warn('AnthropicAdapter.extractBatch: Claude refused', {
        conversationIds,
        category: response.stop_details?.category ?? 'unknown',
      });
      return defaultResult;
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      this.logger.error(
        'AnthropicAdapter.extractBatch: no text block in response',
        { conversationIds },
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
      max_tokens: MAX_TOKENS,
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

  private logUsage(
    conversationIds: string[],
    response: Anthropic.Message,
    latencyMs: number,
  ): void {
    const costUsd = this.pricingService.calculateCostUsd(
      SupportedModels.CLAUDE_SONNET_5,
      response.usage,
    );
    this.logger.log('AnthropicAdapter.extractBatch: usage', {
      conversationIds,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      costUsd: Number(costUsd.toFixed(6)),
      latencyMs,
    });
  }
}
