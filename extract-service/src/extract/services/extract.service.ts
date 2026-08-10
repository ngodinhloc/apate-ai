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
  ExtractDataTypeEnum,
  ExtractInput,
  ExtractItem,
  ExtractStatusEnum,
} from '../contracts/extract.interface';
import { ObjectFactory } from './object.factory';

const TITLE_MAX_LENGTH = 60;

@Injectable()
export class ExtractService {
  constructor(
    private readonly logger: AppLogger,
    private readonly anthropicAdapter: AnthropicAdapter,
    private readonly objectFactory: ObjectFactory,
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

    const scamProbabilityByUuid = new Map(
      conversations.map((c) => [c.conversationId, c.scamProbability]),
    );

    const results = await Promise.all(
      extracted.map(async (conversation) => {
        // Persist the scam probability as its own extraction record, even if it is 0 or null
        await this.persistScamProbability(
          conversation.conversationUuid,
          scamProbabilityByUuid.get(conversation.conversationUuid),
        );
        
        // Persist the valid items only, dropping any that fail re-validation
        const items = await this.persistValidItems(
          conversation.conversationUuid,
          conversation.items,
        );

        return { conversationUuid: conversation.conversationUuid, items };
      }),
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

  /** Upserts the conversation's scam probability as its own extraction record. */
  private async persistScamProbability(
    conversationUuid: string,
    scamProbability: number | undefined,
  ): Promise<void> {
    await this.extractionRepo.upsert(
      {
        conversationUuid,
        dataType: ExtractDataTypeEnum.SCAM_PROBABILITY,
        value: String(scamProbability),
      },
      ['conversationUuid', 'dataType', 'value'],
    );
  }

  private async persistValidItems(
    conversationId: string,
    items: ExtractItem[],
  ): Promise<ExtractItem[]> {
    const validItems: ExtractItem[] = items.flatMap((item) => {
      const valueObject = this.objectFactory.create(item);
      if (valueObject === null) {
        this.logger.warn(
          'ExtractService.persistValidItems: dropped invalid item',
          { conversationId, dataType: item.dataType },
        );
        return [];
      }
      return [{ dataType: item.dataType, value: valueObject.getValue() }];
    });

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
