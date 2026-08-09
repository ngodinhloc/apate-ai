import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';
import { Conversation } from '../contracts/chat.interface';

@Injectable()
export class ExtractClient {
  private readonly baseUrl: string;

  constructor(
    private readonly logger: AppLogger,
    envService: EnvService,
  ) {
    this.baseUrl = envService.getExtractServiceUrl();
  }

  send(conversation: Conversation): void {
    fetch(`${this.baseUrl}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversations: [conversation] }),
    })
      .then((res) => {
        if (!res.ok) {
          this.logger.error('ExtractClient.send: non-2xx response', {
            conversationId: conversation.conversationId,
            status: res.status,
          });
        }
      })
      .catch((err) => {
        this.logger.error('ExtractClient.send: request failed', {
          conversationId: conversation.conversationId,
          error: String(err),
        });
      });
  }
}
