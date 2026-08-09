import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AnthropicModule } from '../anthropic/anthropic.module';
import { ExtractModule } from '../extract/extract.module';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatGateway } from './gateways/chat.gateway';

@Module({
  imports: [DatabaseModule, AnthropicModule, ExtractModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
