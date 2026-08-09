import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';
import { ChatSender, Message } from '../../chat/contracts/chat.interface';
import { SCAM_BAITER_PERSONA } from '../personas/scam-baiter.persona';

const MODEL = 'claude-haiku-4-5-20251001';
const FALLBACK_REPLY =
  "Sorry, my phone's playing up — can you send that again in a sec?";

/** What Claude returns per turn; chat-service fills in conversationId to build the full ChatResponse. */
export interface AgentReply {
  text: string;
  scamProbability: number;
}

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: "The agent's in-character reply to send to the scammer.",
    },
    scamProbability: {
      type: 'number',
      description:
        'Likelihood, from 0 to 1, that the other party is a scammer, based on the full conversation so far.',
    },
  },
  required: ['text', 'scamProbability'],
  additionalProperties: false,
} as const;

@Injectable()
export class ChatAgentService {
  private readonly client: Anthropic;

  constructor(
    private readonly logger: AppLogger,
    envService: EnvService,
  ) {
    this.client = new Anthropic({ apiKey: envService.getAnthropicApiKey() });
  }

  async reply(history: Message[]): Promise<AgentReply> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SCAM_BAITER_PERSONA,
      output_config: {
        format: { type: 'json_schema', schema: REPLY_SCHEMA },
      },
      messages: history.map((m) => ({
        role: m.sender === ChatSender.user ? 'user' : 'assistant',
        content: m.text,
      })),
    });

    if (response.stop_reason === 'refusal') {
      this.logger.warn('ChatAgentService.reply: Claude refused', {
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
        'ChatAgentService.reply: failed to parse structured output',
        {
          error: error instanceof Error ? error.message : String(error),
          rawText: textBlock.text,
        },
      );
      return { text: FALLBACK_REPLY, scamProbability: 0 };
    }
  }
}
