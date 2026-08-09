import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger } from '../../common/logger/services/app-logger';
import { RedisService } from '../../redis/services/redis.service';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import {
  AgentStatus,
  LiveConversation,
  StatusEnum,
} from '../contracts/chat.interface';

@Injectable()
export class ConversationManager {
  constructor(
    private readonly logger: AppLogger,
    private readonly redisService: RedisService,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
  ) {}

  async getLive(conversationId: string): Promise<LiveConversation | null> {
    return this.redisService.getJson<LiveConversation>(
      this.redisKey(conversationId),
    );
  }

  async loadLive(conversationId: string): Promise<LiveConversation> {
    const conversation = await this.getLive(conversationId);
    if (!conversation) {
      throw new NotFoundException(
        `Conversation ${conversationId} not found or already ended`,
      );
    }
    return conversation;
  }

  /**
   * Resolves the live conversation from Redis; if it's not there (e.g. the
   * user resumed an already-ended chat), falls back to the persisted row and
   * revives it as Inprogress so the reply flow can pick up where it left off.
   */
  async loadOrResumeLive(conversationId: string): Promise<LiveConversation> {
    const live = await this.getLive(conversationId);
    if (live) return live;

    const row = await this.conversationRepo.findOne({
      where: { uuid: conversationId },
    });
    if (!row) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const resumed: LiveConversation = {
      conversationId: row.uuid,
      messages: row.messages,
      scamProbability: row.scamProbability,
      status: StatusEnum.Inprogress,
      createdAt: row.createdAt,
      modifiedAt: new Date(),
      agentStatus: AgentStatus.hasReplied,
    };
    await this.saveLive(resumed);
    // Keep the persisted row's status in sync so history() (which reads only
    // from Postgres) doesn't keep showing this conversation as Ended.
    await this.conversationRepo.update(
      { uuid: row.uuid },
      { status: StatusEnum.Inprogress },
    );
    this.logger.log(
      'ConversationManager.loadOrResumeLive: resumed from database',
      {
        conversationId,
      },
    );
    return resumed;
  }

  async saveLive(conversation: LiveConversation): Promise<void> {
    await this.redisService.setJson(
      this.redisKey(conversation.conversationId),
      conversation,
    );
  }

  async deleteLive(conversationId: string): Promise<void> {
    await this.redisService.del(this.redisKey(conversationId));
  }

  private redisKey(conversationId: string): string {
    return `chat:${conversationId}`;
  }
}
