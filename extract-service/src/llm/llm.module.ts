import { Module } from '@nestjs/common';
import { AnthropicAdapter } from './adapters/anthropic.adapter';

@Module({
  providers: [AnthropicAdapter],
  exports: [AnthropicAdapter],
})
export class LlmModule {}
