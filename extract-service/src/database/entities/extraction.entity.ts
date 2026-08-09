import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { ExtractDataTypeEnum } from '../../extract/contracts/extract.interface';

@Entity('extractions')
@Unique(['conversationUuid', 'dataType', 'value'])
export class ExtractionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'conversation_uuid', type: 'uuid' })
  conversationUuid!: string;

  @Column({ name: 'data_type', type: 'varchar' })
  dataType!: ExtractDataTypeEnum;

  @Column({ type: 'varchar' })
  value!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
