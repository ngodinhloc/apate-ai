import { Module } from '@nestjs/common';
import { ExtractionAgentService } from './services/extraction-agent.service';

@Module({
  providers: [ExtractionAgentService],
  exports: [ExtractionAgentService],
})
export class AnthropicModule {}
