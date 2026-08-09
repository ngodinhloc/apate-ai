import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/services/app-logger';
import { AnthropicAdapter } from '../../llm/adapters/anthropic.adapter';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import { ExtractionEntity } from '../../database/entities/extraction.entity';
import {
  ExtractConversation,
  ExtractConversationInput,
  ExtractInput,
  ExtractItem,
  ExtractStatusEnum,
} from '../contracts/extract.interface';
import { ObjectValidator } from './object.validator';

const TITLE_MAX_LENGTH = 60;

@Injectable()
export class ExtractService {
  constructor(
    private readonly logger: AppLogger,
    private readonly anthropicAdapter: AnthropicAdapter,
    private readonly objectValidator: ObjectValidator,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(ExtractionEntity)
    private readonly extractionRepo: Repository<ExtractionEntity>,
  ) {}

  async extractAll(input: ExtractInput): Promise<ExtractConversation[]> {
    await Promise.all(
      input.conversations.map((conversation) =>
        this.persistConversation(conversation),
      ),
    );
    return this.processBatch(input.conversations);
  }

  async getExtractions(conversationUuid: string): Promise<ExtractConversation> {
    const rows = await this.extractionRepo.find({
      where: { conversationUuid },
      order: { dataType: 'ASC' },
    });
    return {
      conversationUuid,
      items: rows.map((row) => ({
        dataType: row.dataType,
        value: row.value,
      })),
    };
  }

  /** Resets a claimed conversation back to NEW so a later cron run retries it. */
  async resetToNew(conversationUuid: string): Promise<void> {
    await this.conversationRepo.update(
      { uuid: conversationUuid },
      { status: ExtractStatusEnum.NEW },
    );
  }

  /**
   * Batched extraction path: one Claude call covers every conversation passed in,
   * instead of one call per conversation. Marks every conversation PROCESSED
   * regardless of how many items each one yielded.
   */
  async processBatch(
    conversations: ExtractConversationInput[],
  ): Promise<ExtractConversation[]> {
    if (conversations.length === 0) return [];

    const extracted = await this.anthropicAdapter.extractBatch(conversations);

    const results = await Promise.all(
      extracted.map(async (conversation) => ({
        conversationUuid: conversation.conversationUuid,
        items: await this.persistValidItems(
          conversation.conversationUuid,
          conversation.items,
        ),
      })),
    );

    await this.conversationRepo.update(
      { uuid: In(conversations.map((c) => c.conversationId)) },
      { status: ExtractStatusEnum.PROCESSED },
    );

    this.logger.log('ExtractService.processBatch: processed', {
      conversationCount: conversations.length,
      conversationIds: conversations.map((c) => c.conversationId),
    });

    return results;
  }

  /** Upserts the conversation by uuid; also called directly by the RabbitMQ consumer path. */
  async persistConversation(
    conversation: ExtractConversationInput,
  ): Promise<void> {
    const title =
      conversation.messages[0]?.text.slice(0, TITLE_MAX_LENGTH) ?? null;
    await this.conversationRepo.upsert(
      {
        uuid: conversation.conversationId,
        title,
        messages: conversation.messages,
        scamProbability: conversation.scamProbability,
        status: ExtractStatusEnum.NEW,
      },
      ['uuid'],
    );
  }

  /** Re-validates raw extracted items and upserts only the ones that pass. */
  private async persistValidItems(
    conversationId: string,
    items: ExtractItem[],
  ): Promise<ExtractItem[]> {
    const validItems: ExtractItem[] = [];
    for (const item of items) {
      const value = this.objectValidator.validate(item);
      if (value === null) {
        this.logger.warn(
          'ExtractService.persistValidItems: dropped invalid item',
          { conversationId, dataType: item.dataType },
        );
        continue;
      }
      validItems.push({ dataType: item.dataType, value });
    }

    if (validItems.length > 0) {
      await this.extractionRepo.upsert(
        validItems.map((item) => ({
          conversationUuid: conversationId,
          dataType: item.dataType,
          value: item.value,
        })),
        ['conversationUuid', 'dataType', 'value'],
      );
    }

    return validItems;
  }
}
