import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/services/app-logger';
import { ExtractionAgentService } from '../../anthropic/services/extraction-agent.service';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import { ExtractionEntity } from '../../database/entities/extraction.entity';
import {
  ExtractConversation,
  ExtractConversationInput,
  ExtractInput,
  ExtractItem,
  ExtractOutput,
  ExtractStatusEnum,
} from '../contracts/extract.interface';
import { isValidFormat } from './format-validators';

const TITLE_MAX_LENGTH = 60;

@Injectable()
export class ExtractService {
  constructor(
    private readonly logger: AppLogger,
    private readonly extractionAgentService: ExtractionAgentService,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(ExtractionEntity)
    private readonly extractionRepo: Repository<ExtractionEntity>,
  ) {}

  async processAll(input: ExtractInput): Promise<ExtractOutput> {
    const conversations = await Promise.all(
      input.conversations.map((conversation) => this.processOne(conversation)),
    );
    return { conversations };
  }

  private async processOne(conversation: ExtractConversationInput) {
    await this.persistConversation(conversation);
    return this.extractAndPersist(conversation);
  }

  /** Extraction path for conversations already claimed (status flipped NEW -> PROCESSING) by the cron task. */
  async processClaimed(
    conversation: ConversationEntity,
  ): Promise<ExtractConversation> {
    return this.extractAndPersist({
      conversationId: conversation.uuid,
      messages: conversation.messages,
      scamProbability: conversation.scamProbability,
      status: conversation.status,
      createdAt: conversation.createdAt,
      modifiedAt: conversation.modifiedAt,
    });
  }

  /** Resets a claimed conversation back to NEW so a later cron run retries it. */
  async resetToNew(conversationUuid: string): Promise<void> {
    await this.conversationRepo.update(
      { uuid: conversationUuid },
      { status: ExtractStatusEnum.NEW },
    );
  }

  private async extractAndPersist(
    conversation: ExtractConversationInput,
  ): Promise<ExtractConversation> {
    const extracted = await this.extractionAgentService.extract(conversation);

    const validItems = extracted.items.filter((item: ExtractItem) => {
      const valid = isValidFormat(item);
      if (!valid) {
        this.logger.warn(
          'ExtractService.extractAndPersist: dropped invalid item',
          {
            conversationId: conversation.conversationId,
            dataType: item.dataType,
          },
        );
      }
      return valid;
    });

    if (validItems.length > 0) {
      await this.extractionRepo.upsert(
        validItems.map((item) => ({
          conversationUuid: conversation.conversationId,
          dataType: item.dataType,
          value: item.value,
        })),
        ['conversationUuid', 'dataType', 'value'],
      );
    }

    await this.conversationRepo.update(
      { uuid: conversation.conversationId },
      { status: ExtractStatusEnum.PROCESSED },
    );

    this.logger.log('ExtractService.extractAndPersist: processed', {
      conversationId: conversation.conversationId,
      itemCount: validItems.length,
    });

    return { conversationUuid: conversation.conversationId, items: validItems };
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
}
