import { AnthropicAdapter } from '../../../src/llm/adapters/anthropic.adapter';
import { AppLogger } from '../../../src/common/logger/services/app-logger';
import { EnvService } from '../../../src/common/env/services/env.service';
import { AnthropicPricingService } from '../../../src/llm/services/anthropic.pricing';
import {
  ChatSender,
  Message,
} from '../../../src/chat/contracts/chat.interface';

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

  const history: Message[] = [
    { sender: ChatSender.user, text: 'hi', timestamp: new Date() },
  ];

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

  it('returns the parsed reply and logs usage on success', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      model: 'claude-haiku-4-5',
      usage: {
        input_tokens: 200,
        output_tokens: 40,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 150,
      },
      content: [
        {
          type: 'text',
          text: JSON.stringify({ text: 'sure, go on', scamProbability: 0.7 }),
        },
      ],
    });

    const result = await adapter.reply('conv-1', history);

    expect(result).toEqual({ text: 'sure, go on', scamProbability: 0.7 });
    expect(logger.log).toHaveBeenCalledWith(
      'AnthropicAdapter.reply: usage',
      expect.objectContaining({
        conversationId: 'conv-1',
        inputTokens: 200,
        outputTokens: 40,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 150,
        costUsd: expect.any(Number),
      }),
    );
  });

  it('falls back to the safe reply and logs a warning on refusal', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'refusal',
      stop_details: { category: 'cyber' },
      model: 'claude-haiku-4-5',
      usage: { input_tokens: 10, output_tokens: 0 },
      content: [],
    });

    const result = await adapter.reply('conv-1', history);

    expect(result.scamProbability).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'AnthropicAdapter.reply: Claude refused',
      expect.objectContaining({ conversationId: 'conv-1', category: 'cyber' }),
    );
  });

  it('logs and rethrows when the request fails after retries are exhausted', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));

    await expect(adapter.reply('conv-1', history)).rejects.toThrow(
      'rate limited',
    );

    expect(logger.error).toHaveBeenCalledWith(
      'AnthropicAdapter.reply: request failed after retries',
      expect.objectContaining({
        conversationId: 'conv-1',
        error: 'rate limited',
      }),
    );
  });
});
