import { Injectable } from '@nestjs/common';
import { EnvService } from '../../common/env/services/env.service';
import { ExtractClient } from './extract.client';
import { EventPublisher } from './event.publisher';
import { Conversation, ExtractAction } from '../contracts/chat.interface';

@Injectable()
export class NotifyService {
  constructor(
    private readonly envService: EnvService,
    private readonly extractClient: ExtractClient,
    private readonly eventPublisher: EventPublisher,
  ) {}

  notify(conversation: Conversation): void {
    if (this.envService.getExtractAction() === ExtractAction.Async) {
      this.eventPublisher.publishConversationEnded(conversation);
      return;
    }
    this.extractClient.send(conversation);
  }
}
