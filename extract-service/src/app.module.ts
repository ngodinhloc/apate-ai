import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EnvModule } from './common/env/env.module';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { ExtractModule } from './extract/extract.module';
import { EventModule } from './event/event.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EnvModule,
    LoggerModule,
    DatabaseModule,
    RabbitMQModule,
    ExtractModule,
    EventModule,
    HealthModule,
  ],
})
export class AppModule {}
