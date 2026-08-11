import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  ChannelEnum,
  ExtractMessage,
  ExtractStatusEnum,
} from '../../extract/contracts/extract.interface';

/**
 * Own copy of the conversation, in extract-service's own schema — chat-service
 * owns the canonical row; this one exists so extraction runs are queryable and
 * re-processable independent of chat-service's retention.
 */
@Entity('conversations')
export class ConversationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  uuid!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 20, default: ChannelEnum.Portal })
  channel!: ChannelEnum;

  @Column({ type: 'jsonb', default: '[]' })
  messages!: ExtractMessage[];

  @Column({ name: 'scam_probability', type: 'real', default: 0 })
  scamProbability!: number;

  @Column({ type: 'smallint', default: ExtractStatusEnum.NEW })
  status!: ExtractStatusEnum;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'modified_at' })
  modifiedAt!: Date;
}
