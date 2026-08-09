import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/services/app-logger';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import { ExtractStatusEnum } from '../contracts/extract.interface';
import { ExtractService } from './extract.service';

@Injectable()
export class ExtractCronService {
  constructor(
    private readonly logger: AppLogger,
    private readonly extractService: ExtractService,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    const claimed = await this.claimNewConversations();
    if (claimed.length === 0) return;

    this.logger.log('ExtractCronService.handleCron: claimed conversations', {
      count: claimed.length,
    });

    await Promise.all(
      claimed.map((conversation) => this.processClaimed(conversation)),
    );
  }

  private async processClaimed(
    conversation: ConversationEntity,
  ): Promise<void> {
    try {
      await this.extractService.processClaimed(conversation);
    } catch (error) {
      this.logger.error(
        'ExtractCronService.processClaimed: extraction failed',
        {
          conversationId: conversation.uuid,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Release the claim so a later run retries this conversation.
      await this.extractService.resetToNew(conversation.uuid);
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
