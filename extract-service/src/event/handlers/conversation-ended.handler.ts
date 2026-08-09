import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EventHandler } from '../contracts/event.interfaces';
import { ExtractService } from '../../extract/services/extract.service';
import { ConversationEvent } from '../../extract/contracts/extract.interface';

@Injectable()
export class ConversationEndedHandler implements EventHandler {
  constructor(
    private readonly logger: AppLogger,
    private readonly extractService: ExtractService,
  ) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const event = payload as unknown as ConversationEvent;
    const conversation = event.data;
    if (!conversation?.conversationId || !conversation.messages) {
      this.logger.warn('ConversationEndedHandler.handle: malformed event', {
        payload,
      });
      return;
    }

    await this.extractService.persistConversation(conversation);
    this.logger.log('ConversationEndedHandler.handle: conversation persisted', {
      conversationId: conversation.conversationId,
    });
  }
}
