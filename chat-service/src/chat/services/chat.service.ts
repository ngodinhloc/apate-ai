import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppLogger } from '../../common/logger/services/app-logger';
import { AnthropicAdapter } from '../../llm/adapters/anthropic.adapter';
import { NotifyService } from './notify.service';
import { ConversationEntity } from '../../database/entities/conversation.entity';
import { ConversationManager } from './conversation.manager';
import {
  AgentStatus,
  ChannelEnum,
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
    private readonly conversationManager: ConversationManager,
    private readonly anthropicAdapter: AnthropicAdapter,
    private readonly notifyService: NotifyService,
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
     private readonly logger: AppLogger,
  ) {}

  async create(
    text: string,
    channel: ChannelEnum = ChannelEnum.Portal,
  ): Promise<LiveConversation> {
    const conversationId = randomUUID();
    const now = new Date();
    const userMessage: Message = {
      sender: ChatSender.user,
      text,
      timestamp: now,
    };

    let conversation: LiveConversation = {
      conversationId,
      channel,
      messages: [userMessage],
      scamProbability: 0,
      status: StatusEnum.Inprogress,
      createdAt: now,
      modifiedAt: now,
      agentStatus: AgentStatus.isThinking,
    };
    await this.conversationManager.saveLive(conversation);

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
    let conversation =
      await this.conversationManager.loadOrResumeLive(conversationId);
    conversation.messages.push({
      sender: ChatSender.user,
      text,
      timestamp: new Date(),
    });
    conversation.agentStatus = AgentStatus.isThinking;
    await this.conversationManager.saveLive(conversation);

    conversation = await this.reply(conversation);
    return conversation;
  }

  async end(conversationId: string): Promise<void> {
    // Redis's live copy has a TTL — a conversation can be idle long enough
    // for it to expire while the Postgres row is still Inprogress. Fall back
    // and resume it (same as continueChat)
    const live =
      await this.conversationManager.loadOrResumeLive(conversationId);
    // Strip agentStatus (LiveConversation-only) — extract-service's DTO
    // rejects unrecognized fields, and persist()/notify() only need Conversation.
    const conversation: Conversation = {
      conversationId: live.conversationId,
      channel: live.channel,
      messages: live.messages,
      scamProbability: live.scamProbability,
      status: StatusEnum.Ended,
      createdAt: live.createdAt,
      modifiedAt: new Date(),
    };

    await this.persist(conversation);
    await this.conversationManager.deleteLive(conversationId);

    this.notifyService.notify(conversation);
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
    const live = await this.conversationManager.getLive(conversationId);
    if (live) return live;

    const row = await this.conversationRepo.findOne({
      where: { uuid: conversationId },
    });
    if (!row) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
    return {
      conversationId: row.uuid,
      channel: row.channel,
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
    const agentReply = await this.anthropicAdapter.reply(
      conversation.conversationId,
      conversation.messages,
    );
    conversation.messages.push({
      sender: ChatSender.agent,
      text: agentReply.text,
      timestamp: new Date(),
    });
    conversation.scamProbability = agentReply.scamProbability;
    conversation.modifiedAt = new Date();
    conversation.agentStatus = AgentStatus.hasReplied;
    await this.conversationManager.saveLive(conversation);
    return conversation;
  }

  /** title has no place in the Conversation/LiveConversation shape — it's a persistence-only field, derived once from the opening message. */
  private async persist(conversation: Conversation): Promise<void> {
    const title =
      conversation.messages[0]?.text.slice(0, TITLE_MAX_LENGTH) ?? null;
    await this.conversationRepo.upsert(
      {
        uuid: conversation.conversationId,
        title,
        channel: conversation.channel,
        messages: conversation.messages,
        scamProbability: conversation.scamProbability,
        status: conversation.status,
      },
      ['uuid'],
    );
  }
}
