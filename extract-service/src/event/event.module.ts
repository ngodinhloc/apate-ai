import { Module } from '@nestjs/common';
import { ExtractModule } from '../extract/extract.module';
import { ConversationEndedHandler } from './handlers/conversation-ended.handler';
import { EVENT_REGISTRY, createEventRegistry } from './configs/event.config';
import { MessageProcessor } from './services/message.processor';
import { RabbitMqConsumer } from './services/rabbitmq.consumer';

@Module({
  imports: [ExtractModule],
  providers: [
    ConversationEndedHandler,
    MessageProcessor,
    RabbitMqConsumer,
    {
      provide: EVENT_REGISTRY,
      useFactory: createEventRegistry,
      inject: [ConversationEndedHandler],
    },
  ],
})
export class EventModule {}
