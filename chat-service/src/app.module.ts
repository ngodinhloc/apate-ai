import { Module } from '@nestjs/common';
import { EnvModule } from './common/env/env.module';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule,
    DatabaseModule,
    RedisModule,
    RabbitMQModule,
    ChatModule,
    HealthModule,
  ],
})
export class AppModule {}
