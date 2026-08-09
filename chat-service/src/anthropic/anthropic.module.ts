import { Module } from '@nestjs/common';
import { ChatAgentService } from './services/chat-agent.service';

@Module({
  providers: [ChatAgentService],
  exports: [ChatAgentService],
})
export class AnthropicModule {}
