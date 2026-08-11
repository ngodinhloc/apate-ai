import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/services/app-logger';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import {
  ExtractConversationInput,
  ExtractStatusEnum,
} from '../contracts/extract.interface';
import { ExtractService } from './extract.service';

const CLAIM_BATCH_LIMIT = 100;

@Injectable()
export class CronService {
  constructor(
    private readonly logger: AppLogger,
    private readonly extractService: ExtractService,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    const claimed = await this.claimNewConversations();
    if (claimed.length === 0) {
      this.logger.log('CronService.handleCron: no NEW conversations to claim');
      return;
    }

    this.logger.log('CronService.handleCron: claimed conversations', {
      count: claimed.length,
      conversationIds: claimed.map((c) => c.uuid),
    });

    await this.processBatch(claimed);
  }

  /** One Claude call covers every conversation claimed this run, instead of one call each. */
  private async processBatch(
    conversations: ConversationEntity[],
  ): Promise<void> {
    try {
      const inputs: ExtractConversationInput[] = conversations.map((c) => ({
        conversationId: c.uuid,
        channel: c.channel,
        messages: c.messages,
        scamProbability: c.scamProbability,
        status: c.status,
        createdAt: c.createdAt,
        modifiedAt: c.modifiedAt,
      }));
      await this.extractService.processBatch(inputs);
    } catch (error) {
      this.logger.error('CronService.processBatch: extraction failed', {
        conversationIds: conversations.map((c) => c.uuid),
        error: error instanceof Error ? error.message : String(error),
      });
      // Release the whole batch so a later run retries it — we can't tell
      // which conversation(s) caused a batch-level failure.
      await Promise.all(
        conversations.map((c) => this.extractService.resetToNew(c.uuid)),
      );
    }
  }

  /**
   * SELECT ... FOR UPDATE + UPDATE inside one transaction claims NEW
   * conversations atomically: a concurrent instance's transaction blocks on
   * the row lock until this one commits, then finds nothing left at NEW.
   */
  private async claimNewConversations(): Promise<ConversationEntity[]> {
    return this.conversationRepo.manager.transaction(async (manager) => {
      const rows = await manager
        .createQueryBuilder(ConversationEntity, 'conversation')
        .setLock('pessimistic_write')
        .where('conversation.status = :status', {
          status: ExtractStatusEnum.NEW,
        })
        .orderBy('conversation.createdAt', 'ASC')
        .limit(CLAIM_BATCH_LIMIT)
        .getMany();

      if (rows.length === 0) return [];

      await manager.update(
        ConversationEntity,
        { uuid: In(rows.map((row) => row.uuid)) },
        { status: ExtractStatusEnum.PROCESSING },
      );

      return rows.map((row) => ({
        ...row,
        status: ExtractStatusEnum.PROCESSING,
      }));
    });
  }
}
