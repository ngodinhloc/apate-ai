import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { Binding } from '../../rabbitmq/contracts/rabbitmq.interfaces';
import { MessageProcessor } from './message.processor';
import {
  EVENT_CONVERSATION_ENDED,
  EXCHANGE_APATE,
  QUEUE_CONVERSATION_ENDED,
} from '../../extract/contracts/extract.interface';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  constructor(
    private readonly messageProcessor: MessageProcessor,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bindings: Binding[] = [
      { exchange: EXCHANGE_APATE, routingKey: EVENT_CONVERSATION_ENDED },
    ];

    await this.rabbitMQService.subscribe(
      QUEUE_CONVERSATION_ENDED,
      bindings,
      (payload, eventName) =>
        this.messageProcessor.process({ ...payload, eventName }),
    );
  }
}
