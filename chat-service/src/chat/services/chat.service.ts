import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppLogger } from '../../common/logger/services/app-logger';
import { RedisService } from '../../redis/services/redis.service';
import { ChatAgentService } from '../../anthropic/services/chat-agent.service';
import { ExtractClient } from '../../extract/services/extract.client';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import {
  AgentStatus,
  ChatSender,
  Conversation,
  ConversationSummary,
  LiveConversation,
  Message,
  StatusEnum,
} from '../contracts/chat.interface';

const TITLE_MAX_LENGTH = 60;

@Injectable()
export class ChatService {
  constructor(
    private readonly logger: AppLogger,
    private readonly redisService: RedisService,
    private readonly chatAgentService: ChatAgentService,
    private readonly extractClient: ExtractClient,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
  ) {}

  async create(text: string): Promise<LiveConversation> {
    const conversationId = randomUUID();
    const now = new Date();
    const userMessage: Message = {
      sender: ChatSender.user,
      text,
      timestamp: now,
    };

    let conversation: LiveConversation = {
      conversationId,
      messages: [userMessage],
      scamProbability: 0,
      status: StatusEnum.Inprogress,
      createdAt: now,
      modifiedAt: now,
      agentStatus: AgentStatus.isThinking,
    };
    await this.saveLive(conversation);

    conversation = await this.reply(conversation);
    this.logger.log('ChatService.create: conversation created', {
      conversationId,
    });
    return conversation;
  }

  async continueChat(
    conversationId: string,
    text: string,
  ): Promise<LiveConversation> {
    let conversation = await this.loadOrResumeLive(conversationId);
    conversation.messages.push({
      sender: ChatSender.user,
      text,
      timestamp: new Date(),
    });
    conversation.agentStatus = AgentStatus.isThinking;
    await this.saveLive(conversation);

    conversation = await this.reply(conversation);
    return conversation;
  }

  async end(conversationId: string): Promise<void> {
    const live = await this.loadLive(conversationId);
    // Strip agentStatus (LiveConversation-only) — extract-service's DTO
    // rejects unrecognized fields, and persist()/notify() only need Conversation.
    const conversation: Conversation = {
      conversationId: live.conversationId,
      messages: live.messages,
      scamProbability: live.scamProbability,
      status: StatusEnum.Ended,
      createdAt: live.createdAt,
      modifiedAt: new Date(),
    };

    await this.persist(conversation);
    await this.redisService.del(this.redisKey(conversationId));

    this.extractClient.notify(conversation);
    this.logger.log('ChatService.end: conversation ended', { conversationId });
  }

  async history(): Promise<ConversationSummary[]> {
    const rows = await this.conversationRepo.find({
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      conversationId: row.uuid,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt,
    }));
  }

  async detail(conversationId: string): Promise<Conversation> {
    const live = await this.redisService.getJson<LiveConversation>(
      this.redisKey(conversationId),
    );
    if (live) return live;

    const row = await this.conversationRepo.findOne({
      where: { uuid: conversationId },
    });
    if (!row) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    return {
      conversationId: row.uuid,
      messages: row.messages,
      scamProbability: row.scamProbability,
      status: row.status,
      createdAt: row.createdAt,
      modifiedAt: row.modifiedAt,
    };
  }

  /** Calls Claude, appends the reply, updates scamProbability, and flips agentStatus so the WS gateway can stop polling. */
  private async reply(
    conversation: LiveConversation,
  ): Promise<LiveConversation> {
    const agentReply = await this.chatAgentService.reply(conversation.messages);
    conversation.messages.push({
      sender: ChatSender.agent,
      text: agentReply.text,
      timestamp: new Date(),
    });
    conversation.scamProbability = agentReply.scamProbability;
    conversation.modifiedAt = new Date();
    conversation.agentStatus = AgentStatus.hasReplied;
    await this.saveLive(conversation);
    return conversation;
  }

  private async loadLive(conversationId: string): Promise<LiveConversation> {
    const conversation = await this.redisService.getJson<LiveConversation>(
      this.redisKey(conversationId),
    );
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
  private async loadOrResumeLive(
    conversationId: string,
  ): Promise<LiveConversation> {
    const live = await this.redisService.getJson<LiveConversation>(
      this.redisKey(conversationId),
    );
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
    this.logger.log('ChatService.loadOrResumeLive: resumed from database', {
      conversationId,
    });
    return resumed;
  }

  private async saveLive(conversation: LiveConversation): Promise<void> {
    await this.redisService.setJson(
      this.redisKey(conversation.conversationId),
      conversation,
    );
  }

  /** title has no place in the Conversation/LiveConversation shape — it's a persistence-only field, derived once from the opening message. */
  private async persist(conversation: Conversation): Promise<void> {
    const title =
      conversation.messages[0]?.text.slice(0, TITLE_MAX_LENGTH) ?? null;
    await this.conversationRepo.upsert(
      {
        uuid: conversation.conversationId,
        title,
        messages: conversation.messages,
        scamProbability: conversation.scamProbability,
        status: conversation.status,
      },
      ['uuid'],
    );
  }

  private redisKey(conversationId: string): string {
    return `chat:${conversationId}`;
  }
}
