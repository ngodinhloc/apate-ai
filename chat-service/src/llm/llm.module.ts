import { Module } from '@nestjs/common';
import { AnthropicAdapter } from './adapters/anthropic.adapter';
import { AnthropicPricingService } from './services/anthropic.pricing';

@Module({
  providers: [AnthropicAdapter, AnthropicPricingService],
  exports: [AnthropicAdapter],
})
export class LlmModule {}
