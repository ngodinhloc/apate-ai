import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';
import { ChatSender, Message } from '../../chat/contracts/chat.interface';
import { SCAM_BAITER_PERSONA } from '../templates/scam-baiter.persona';
import { AGENT_REPLY_SCHEMA } from '../templates/scam-baiter.schema';
import {
  AdapterInterface,
  AgentReply,
  SupportedModels,
} from '../contracts/llm.interface';

const FALLBACK_REPLY =
  "Sorry, my phone's playing up — can you send that again in a sec?";

@Injectable()
export class AnthropicAdapter implements AdapterInterface {
  private readonly client: Anthropic;

  constructor(
    envService: EnvService,
    private readonly logger: AppLogger,
  ) {
    this.client = new Anthropic({ apiKey: envService.getAnthropicApiKey() });
  }

  async reply(conversationId: string, history: Message[]): Promise<AgentReply> {
    const response = await this.client.messages.create({
      model: SupportedModels.CLAUDE_HAIKU_4_5,
      system: SCAM_BAITER_PERSONA,
      max_tokens: 1024,
      messages: this.buildMessages(history),
      output_config: {
        format: { type: 'json_schema', schema: AGENT_REPLY_SCHEMA },
      },
    });

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
}
