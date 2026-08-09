import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvService } from '../common/env/services/env.service';
import { ConversationEntity } from './entities/conversation.entity';

@Module({
  imports: [
    // EnvService comes from the @Global() EnvModule — no need to import it here.
    TypeOrmModule.forRootAsync({
      inject: [EnvService],
      useFactory: (envService: EnvService) => ({
        type: 'postgres',
        url: envService.getDatabaseUrl(),
        schema: envService.getDbSchema(),
        entities: [ConversationEntity],
        synchronize: true,
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([ConversationEntity]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
