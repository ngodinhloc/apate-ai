import { Repository } from 'typeorm';
import { CronService } from '../../../src/extract/services/cron.service';
import { AppLogger } from '../../../src/common/logger/services/app-logger';
import { ExtractService } from '../../../src/extract/services/extract.service';
import { ConversationEntity } from '../../../src/database/entities/conversation.entity';
import { ExtractStatusEnum } from '../../../src/extract/contracts/extract.interface';

describe('CronService', () => {
  let logger: jest.Mocked<Pick<AppLogger, 'log' | 'error'>>;
  let extractService: jest.Mocked<
    Pick<ExtractService, 'processBatch' | 'resetToNew'>
  >;
  let transaction: jest.Mock;
  let conversationRepo: { manager: { transaction: jest.Mock } };
  let service: CronService;

  const conversation = (uuid: string): ConversationEntity =>
    ({
      uuid,
      messages: [],
      scamProbability: 0,
      status: ExtractStatusEnum.PROCESSING,
      createdAt: new Date(),
      modifiedAt: new Date(),
    }) as ConversationEntity;

  beforeEach(() => {
    logger = { log: jest.fn(), error: jest.fn() };
    extractService = { processBatch: jest.fn(), resetToNew: jest.fn() };
    transaction = jest.fn();
    conversationRepo = { manager: { transaction } };

    service = new CronService(
      logger as unknown as AppLogger,
      extractService as unknown as ExtractService,
      conversationRepo as unknown as Repository<ConversationEntity>,
    );
  });

  describe('handleCron', () => {
    it('does nothing when there are no NEW conversations to claim', async () => {
      transaction.mockResolvedValue([]);

      await service.handleCron();

      expect(extractService.processBatch).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(
        'CronService.handleCron: no NEW conversations to claim',
      );
    });

    it('sends every claimed conversation in a single batched call', async () => {
      const claimed = [conversation('a'), conversation('b')];
      transaction.mockResolvedValue(claimed);
      extractService.processBatch.mockResolvedValue([
        { conversationUuid: 'a', items: [] },
        { conversationUuid: 'b', items: [] },
      ]);

      await service.handleCron();

      expect(extractService.processBatch).toHaveBeenCalledTimes(1);
      expect(extractService.processBatch).toHaveBeenCalledWith(
        claimed.map((c) => ({
          conversationId: c.uuid,
          messages: c.messages,
          scamProbability: c.scamProbability,
          status: c.status,
          createdAt: c.createdAt,
          modifiedAt: c.modifiedAt,
        })),
      );
      expect(logger.log).toHaveBeenCalledWith(
        'CronService.handleCron: claimed conversations',
        { count: 2, conversationIds: ['a', 'b'] },
      );
    });

    it('resets every claimed conversation to NEW and logs when the batch call fails', async () => {
      const claimed = [conversation('a'), conversation('b')];
      transaction.mockResolvedValue(claimed);
      extractService.processBatch.mockRejectedValue(new Error('boom'));

      await service.handleCron();

      expect(extractService.resetToNew).toHaveBeenCalledWith('a');
      expect(extractService.resetToNew).toHaveBeenCalledWith('b');
      expect(logger.error).toHaveBeenCalledWith(
        'CronService.processBatch: extraction failed',
        expect.objectContaining({
          conversationIds: ['a', 'b'],
          error: 'boom',
        }),
      );
    });
  });
});
