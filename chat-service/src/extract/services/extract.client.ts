import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import {
  Conversation,
  ConversationEvent,
  EVENT_CONVERSATION_ENDED,
  EXCHANGE_APATE,
  ExtractAction,
} from '../../chat/contracts/chat.interface';

@Injectable()
export class ExtractClient {
  private readonly baseUrl: string;

  constructor(
    private readonly logger: AppLogger,
    private readonly envService: EnvService,
    private readonly rabbitMQService: RabbitMQService,
  ) {
    this.baseUrl = envService.getExtractServiceUrl();
  }

  /** Fire-and-forget: the caller (chat end) has already responded to the user. */
  notify(conversation: Conversation): void {
    if (this.envService.getExtractAction() === ExtractAction.Async) {
      this.publishEvent(conversation);
      return;
    }
    this.sendHttpRequest(conversation);
  }

  private publishEvent(conversation: Conversation): void {
    const event: ConversationEvent = {
      eventName: EVENT_CONVERSATION_ENDED,
      data: conversation,
    };
    this.rabbitMQService
      .publish(EXCHANGE_APATE, EVENT_CONVERSATION_ENDED, event)
      .catch((err) => {
        this.logger.error('ExtractClient.publishEvent: publish failed', {
          conversationId: conversation.conversationId,
          error: String(err),
        });
      });
  }

  private sendHttpRequest(conversation: Conversation): void {
    fetch(`${this.baseUrl}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversations: [conversation] }),
    })
      .then((res) => {
        if (!res.ok) {
          this.logger.error('ExtractClient.sendHttpRequest: non-2xx response', {
            conversationId: conversation.conversationId,
            status: res.status,
          });
        }
      })
      .catch((err) => {
        this.logger.error('ExtractClient.sendHttpRequest: request failed', {
          conversationId: conversation.conversationId,
          error: String(err),
        });
      });
  }
}
