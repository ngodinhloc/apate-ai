import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';
import {
  ExtractConversation,
  ExtractConversationInput,
} from '../../extract/contracts/extract.interface';
import { EXTRACTOR_PERSONA } from '../personas/extractor.persona';
import { EXTRACT_CONVERSATION_SCHEMA } from '../schemas/extract-output.schema';

const MODEL = 'claude-opus-5';

@Injectable()
export class ExtractionAgentService {
  private readonly client: Anthropic;

  constructor(
    private readonly logger: AppLogger,
    envService: EnvService,
  ) {
    this.client = new Anthropic({ apiKey: envService.getAnthropicApiKey() });
  }

  async extract(
    conversation: ExtractConversationInput,
  ): Promise<ExtractConversation> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: EXTRACTOR_PERSONA,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: EXTRACT_CONVERSATION_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            conversationUuid: conversation.conversationId,
            messages: conversation.messages,
          }),
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      this.logger.warn('ExtractionAgentService.extract: Claude refused', {
        conversationId: conversation.conversationId,
        category: response.stop_details?.category ?? 'unknown',
      });
      return { conversationUuid: conversation.conversationId, items: [] };
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      this.logger.error(
        'ExtractionAgentService.extract: no text block in response',
        {
          conversationId: conversation.conversationId,
        },
      );
      return { conversationUuid: conversation.conversationId, items: [] };
    }

    // output_config.format guarantees schema-valid JSON — no retry/parse loop needed.
    return JSON.parse(textBlock.text) as ExtractConversation;
  }
}
