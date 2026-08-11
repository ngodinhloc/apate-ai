import { Repository } from 'typeorm';
import { ExtractService } from '../../../src/extract/services/extract.service';
import { AppLogger } from '../../../src/common/logger/services/app-logger';
import { AnthropicAdapter } from '../../../src/llm/adapters/anthropic.adapter';
import { ObjectFactory } from '../../../src/extract/services/object.factory';
import { Email } from '../../../src/extract/services/value-objects/email';
import { ConversationEntity } from '../../../src/database/entities/conversation.entity';
import { ExtractionEntity } from '../../../src/database/entities/extraction.entity';
import {
  ChannelEnum,
  ExtractConversationInput,
  ExtractDataTypeEnum,
  ExtractItem,
  ExtractStatusEnum,
} from '../../../src/extract/contracts/extract.interface';

describe('ExtractService', () => {
  let logger: jest.Mocked<Pick<AppLogger, 'log' | 'warn' | 'error'>>;
  let anthropicAdapter: jest.Mocked<Pick<AnthropicAdapter, 'extractBatch'>>;
  let objectFactory: jest.Mocked<Pick<ObjectFactory, 'create'>>;
  let conversationRepo: jest.Mocked<
    Pick<Repository<ConversationEntity>, 'update' | 'upsert'>
  >;
  let extractionRepo: jest.Mocked<
    Pick<Repository<ExtractionEntity>, 'upsert' | 'find'>
  >;
  let service: ExtractService;

  const conversation: ExtractConversationInput = {
    conversationId: 'conv-1',
    channel: ChannelEnum.Portal,
    messages: [{ sender: 'user', text: 'hi there', timestamp: new Date() }],
    scamProbability: 0.5,
    status: ExtractStatusEnum.NEW,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };

  beforeEach(() => {
    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    anthropicAdapter = { extractBatch: jest.fn() };
    objectFactory = { create: jest.fn() };
    conversationRepo = { update: jest.fn(), upsert: jest.fn() };
    extractionRepo = { upsert: jest.fn(), find: jest.fn() };

    service = new ExtractService(
      logger as unknown as AppLogger,
      anthropicAdapter as unknown as AnthropicAdapter,
      objectFactory as unknown as ObjectFactory,
      conversationRepo as unknown as Repository<ConversationEntity>,
      extractionRepo as unknown as Repository<ExtractionEntity>,
    );
  });

  describe('extractAll', () => {
    it('persists every conversation, then extracts them all in one batched call', async () => {
      const items: ExtractItem[] = [
        { dataType: ExtractDataTypeEnum.EMAIL, value: 'scammer@example.com' },
      ];
      anthropicAdapter.extractBatch.mockResolvedValue([
        { conversationUuid: conversation.conversationId, items },
      ]);
      objectFactory.create.mockReturnValue(new Email('scammer@example.com'));

      const result = await service.extractAll({
        conversations: [conversation],
      });

      expect(conversationRepo.upsert).toHaveBeenCalled();
      expect(anthropicAdapter.extractBatch).toHaveBeenCalledTimes(1);
      expect(anthropicAdapter.extractBatch).toHaveBeenCalledWith([
        conversation,
      ]);
      expect(result).toEqual([
        { conversationUuid: conversation.conversationId, items },
      ]);
    });
  });

  describe('resetToNew', () => {
    it('resets the conversation status back to NEW', async () => {
      await service.resetToNew('conv-1');

      expect(conversationRepo.update).toHaveBeenCalledWith(
        { uuid: 'conv-1' },
        { status: ExtractStatusEnum.NEW },
      );
    });
  });

  describe('processBatch', () => {
    const asInput = (conversationId: string): ExtractConversationInput => ({
      conversationId,
      channel: conversation.channel,
      messages: conversation.messages,
      scamProbability: conversation.scamProbability,
      status: conversation.status,
      createdAt: conversation.createdAt,
      modifiedAt: conversation.modifiedAt,
    });

    it('returns [] and calls nothing when there are no conversations', async () => {
      const result = await service.processBatch([]);

      expect(result).toEqual([]);
      expect(anthropicAdapter.extractBatch).not.toHaveBeenCalled();
      expect(conversationRepo.update).not.toHaveBeenCalled();
    });

    it('sends one batched request and persists each conversation independently', async () => {
      const entities = [asInput('a'), asInput('b')];
      anthropicAdapter.extractBatch.mockResolvedValue([
        {
          conversationUuid: 'a',
          items: [
            { dataType: ExtractDataTypeEnum.EMAIL, value: 'good@example.com' },
          ],
        },
        {
          conversationUuid: 'b',
          items: [{ dataType: ExtractDataTypeEnum.EMAIL, value: 'bad' }],
        },
      ]);
      objectFactory.create.mockImplementation((item) =>
        item.value === 'good@example.com' ? new Email('good@example.com') : null,
      );

      const result = await service.processBatch(entities);

      expect(anthropicAdapter.extractBatch).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          conversationUuid: 'a',
          items: [
            { dataType: ExtractDataTypeEnum.EMAIL, value: 'good@example.com' },
          ],
        },
        { conversationUuid: 'b', items: [] },
      ]);
      expect(extractionRepo.upsert).toHaveBeenCalledWith(
        [
          {
            conversationUuid: 'a',
            dataType: ExtractDataTypeEnum.EMAIL,
            value: 'good@example.com',
          },
        ],
        ['conversationUuid', 'dataType', 'value'],
      );
      expect(extractionRepo.upsert).toHaveBeenCalledTimes(1);
      expect(conversationRepo.update).toHaveBeenCalledWith(
        { uuid: expect.anything() },
        { status: ExtractStatusEnum.PROCESSED },
      );
    });
  });

  describe('getExtractions', () => {
    it('maps persisted extraction rows to an ExtractConversation', async () => {
      extractionRepo.find.mockResolvedValue([
        {
          dataType: ExtractDataTypeEnum.EMAIL,
          value: 'a@b.com',
        } as ExtractionEntity,
      ]);

      const result = await service.getExtractions('conv-1');

      expect(result).toEqual({
        conversationUuid: 'conv-1',
        items: [{ dataType: ExtractDataTypeEnum.EMAIL, value: 'a@b.com' }],
      });
    });
  });

  describe('persistConversation', () => {
    it('upserts the conversation with a title derived from the first message', async () => {
      await service.persistConversation(conversation);

      expect(conversationRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          uuid: conversation.conversationId,
          title: 'hi there',
          status: ExtractStatusEnum.NEW,
        }),
        ['uuid'],
      );
    });

    it('uses a null title when there are no messages', async () => {
      await service.persistConversation({ ...conversation, messages: [] });

      expect(conversationRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ title: null }),
        ['uuid'],
      );
    });
  });
});
