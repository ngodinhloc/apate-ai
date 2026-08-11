import { AnthropicAdapter } from '../../../src/llm/adapters/anthropic.adapter';
import { AppLogger } from '../../../src/common/logger/services/app-logger';
import { EnvService } from '../../../src/common/env/services/env.service';
import { AnthropicPricingService } from '../../../src/llm/services/anthropic.pricing';
import {
  ChannelEnum,
  ExtractConversationInput,
  ExtractStatusEnum,
} from '../../../src/extract/contracts/extract.interface';

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  const ctor = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  return { __esModule: true, default: ctor };
});

describe('AnthropicAdapter', () => {
  let logger: jest.Mocked<Pick<AppLogger, 'log' | 'warn' | 'error'>>;
  let envService: jest.Mocked<Pick<EnvService, 'getAnthropicApiKey'>>;
  let adapter: AnthropicAdapter;

  const conversation: ExtractConversationInput = {
    conversationId: 'conv-1',
    channel: ChannelEnum.Portal,
    messages: [{ sender: 'user', text: 'hi', timestamp: new Date() }],
    scamProbability: 0.5,
    status: ExtractStatusEnum.NEW,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  beforeEach(() => {
    mockCreate.mockReset();
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    envService = {
      getAnthropicApiKey: jest.fn().mockReturnValue('test-key'),
    };
    adapter = new AnthropicAdapter(
      envService as unknown as EnvService,
      logger as unknown as AppLogger,
      new AnthropicPricingService(),
    );
  });

  it('configures the Anthropic client with retries', () => {
    const AnthropicMock = jest.requireMock('@anthropic-ai/sdk')
      .default as jest.Mock;
    expect(AnthropicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        maxRetries: expect.any(Number),
      }),
    );
  });

  it('returns extracted conversations and logs usage on success', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      model: 'claude-sonnet-5',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 0,
      },
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            conversations: [{ conversationUuid: 'conv-1', items: [] }],
          }),
        },
      ],
    });

    const result = await adapter.extractBatch([conversation]);

    expect(result).toEqual([{ conversationUuid: 'conv-1', items: [] }]);
    expect(logger.log).toHaveBeenCalledWith(
      'AnthropicAdapter.extractBatch: usage',
      expect.objectContaining({
        conversationIds: ['conv-1'],
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 20,
        cacheReadInputTokens: 0,
        costUsd: expect.any(Number),
      }),
    );
  });

  it('returns empty items and logs a warning on refusal', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'refusal',
      stop_details: { category: 'cyber' },
      model: 'claude-sonnet-5',
      usage: { input_tokens: 10, output_tokens: 0 },
      content: [],
    });

    const result = await adapter.extractBatch([conversation]);

    expect(result).toEqual([{ conversationUuid: 'conv-1', items: [] }]);
    expect(logger.warn).toHaveBeenCalledWith(
      'AnthropicAdapter.extractBatch: Claude refused',
      expect.objectContaining({
        conversationIds: ['conv-1'],
        category: 'cyber',
      }),
    );
  });

  it('logs and rethrows when the request fails after retries are exhausted', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));

    await expect(adapter.extractBatch([conversation])).rejects.toThrow(
      'rate limited',
    );

    expect(logger.error).toHaveBeenCalledWith(
      'AnthropicAdapter.extractBatch: request failed after retries',
      expect.objectContaining({
        conversationIds: ['conv-1'],
        error: 'rate limited',
      }),
    );
  });
});
