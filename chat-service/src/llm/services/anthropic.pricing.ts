import { Injectable } from '@nestjs/common';
import { SupportedModels } from '../contracts/llm.interface';

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

// Standard (non-intro) list pricing, USD per 1M tokens.
// Source: https://platform.claude.com/docs/en/pricing — verify against this page when
// updating, as rates and model lineup change over time. Note: Claude Sonnet 5 has an
// introductory rate of $2.00/$10.00 per 1M tokens through 2026-08-31; this table uses
// the standard $3.00/$15.00 rate that applies after that date.
const USD_PER_MILLION_TOKENS: Record<
  SupportedModels,
  { input: number; output: number }
> = {
  [SupportedModels.CLAUDE_HAIKU_4_5]: { input: 1, output: 5 },
  [SupportedModels.CLAUDE_SONNET_5]: { input: 3, output: 15 },
  [SupportedModels.CLAUDE_OPUS_5]: { input: 5, output: 25 },
};

// 5-minute TTL cache pricing (the default `cache_control: { type: 'ephemeral' }`).
// See https://platform.claude.com/docs/en/build-with-claude/prompt-caching for the
// cache write (~1.25x input) / cache read (~0.1x input) cost multipliers.
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

@Injectable()
export class AnthropicPricingService {
  calculateCostUsd(model: SupportedModels, usage: TokenUsage): number {
    const pricing = USD_PER_MILLION_TOKENS[model];
    const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
    const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
    const cacheWriteCost =
      ((usage.cache_creation_input_tokens ?? 0) / 1_000_000) *
      pricing.input *
      CACHE_WRITE_MULTIPLIER;
    const cacheReadCost =
      ((usage.cache_read_input_tokens ?? 0) / 1_000_000) *
      pricing.input *
      CACHE_READ_MULTIPLIER;
    return inputCost + outputCost + cacheWriteCost + cacheReadCost;
  }
}
