import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/services/app-logger';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import {
  Conversation,
  ConversationEvent,
  EVENT_CONVERSATION_ENDED,
  EXCHANGE_APATE,
} from '../contracts/chat.interface';

@Injectable()
export class EventPublisher {
  constructor(
    private readonly logger: AppLogger,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  publishConversationEnded(conversation: Conversation): void {
    const event: ConversationEvent = {
      eventName: EVENT_CONVERSATION_ENDED,
      data: conversation,
    };
    this.rabbitMQService
      .publish(EXCHANGE_APATE, EVENT_CONVERSATION_ENDED, event)
      .catch((err) => {
        this.logger.error(
          'EventPublisher.publishConversationEnded: publish failed',
          {
            conversationId: conversation.conversationId,
            error: String(err),
          },
        );
      });
  }
}
