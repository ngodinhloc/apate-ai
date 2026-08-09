import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ConversationManager } from './services/conversation.manager';
import { ExtractClient } from './services/extract.client';
import { NotifyService } from './services/notify.service';
import { EventPublisher } from './services/event.publisher';
import { ChatGateway } from './gateways/chat.gateway';

@Module({
  imports: [DatabaseModule, LlmModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ConversationManager,
    ExtractClient,
    NotifyService,
    EventPublisher,
    ChatGateway,
  ],
})
export class ChatModule {}
