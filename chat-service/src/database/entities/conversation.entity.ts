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
  Message,
  StatusEnum,
} from '../../chat/contracts/chat.interface';

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
  messages!: Message[];

  @Column({ name: 'scam_probability', type: 'real', default: 0 })
  scamProbability!: number;

  @Column({ type: 'smallint', default: StatusEnum.Inprogress })
  status!: StatusEnum;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'modified_at' })
  modifiedAt!: Date;
}
