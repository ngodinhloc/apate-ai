import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';
import { ChatSender, Message } from '../../chat/contracts/chat.interface';
import { SCAM_BAITER_PERSONA } from '../templates/system.prompts';
import { AGENT_REPLY_SCHEMA } from '../templates/output.schemas';
import { AnthropicPricingService } from '../services/anthropic.pricing';
import {
  AdapterInterface,
  AgentReply,
  SupportedModels,
} from '../contracts/llm.interface';

const FALLBACK_REPLY =
  "Sorry, my phone's playing up — can you send that again in a sec?";

// SDK default is 2 retries with exponential backoff on 408/409/429/5xx and
// connection errors; bumped up since a dropped turn is a visible product failure.
const MAX_RETRIES = 4;

const MAX_TOKENS = 1024;

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

  async reply(conversationId: string, history: Message[]): Promise<AgentReply> {
    const startedAt = Date.now();
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: SupportedModels.CLAUDE_HAIKU_4_5,
        system: SCAM_BAITER_PERSONA,
        max_tokens: MAX_TOKENS,
        messages: this.buildMessages(history),
        output_config: {
          format: { type: 'json_schema', schema: AGENT_REPLY_SCHEMA },
        },
      });
    } catch (error) {
      this.logger.error(
        'AnthropicAdapter.reply: request failed after retries',
        {
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }

    this.logUsage(conversationId, response, Date.now() - startedAt);

    if (response.stop_reason === 'refusal') {
      this.logger.warn('AnthropicAdapter.reply: Claude refused', {
        conversationId,
        category: response.stop_details?.category ?? 'unknown',
      });
      return { text: FALLBACK_REPLY, scamProbability: 0 };
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { text: FALLBACK_REPLY, scamProbability: 0 };
    }

    try {
      return JSON.parse(textBlock.text) as AgentReply;
    } catch (error) {
      this.logger.error(
        'AnthropicAdapter.reply: failed to parse structured output',
        {
          conversationId,
          error: error instanceof Error ? error.message : String(error),
          rawText: textBlock.text,
        },
      );
      return { text: FALLBACK_REPLY, scamProbability: 0 };
    }
  }

  private buildMessages(history: Message[]): Anthropic.MessageParam[] {
    return history.map((m) => ({
      role: m.sender === ChatSender.user ? 'user' : 'assistant',
      content: m.text,
    }));
  }

  private logUsage(
    conversationId: string,
    response: Anthropic.Message,
    latencyMs: number,
  ): void {
    const costUsd = this.pricingService.calculateCostUsd(
      SupportedModels.CLAUDE_HAIKU_4_5,
      response.usage,
    );
    this.logger.log('AnthropicAdapter.reply: usage', {
      conversationId,
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
