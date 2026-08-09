import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtractAction } from '../../../chat/contracts/chat.interface';

@Injectable()
export class EnvService {
  constructor(private readonly configService: ConfigService) {}

  getPort(): number {
    return parseInt(this.configService.get<string>('PORT') ?? '8000', 10);
  }

  getDatabaseUrl(): string {
    return (
      this.configService.get<string>('DATABASE_URL') ??
      'postgresql://apate:apate@localhost:5432/apate'
    );
  }

  getDbSchema(): string {
    return this.configService.get<string>('DB_SCHEMA') ?? 'chat_service';
  }

  getRedisUrl(): string {
    return (
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379'
    );
  }

  getExtractServiceUrl(): string {
    return (
      this.configService.get<string>('EXTRACT_SERVICE_URL') ??
      'http://localhost:8001'
    );
  }

  getAnthropicApiKey(): string | undefined {
    return this.configService.get<string>('ANTHROPIC_API_KEY');
  }

  getRabbitMqUrl(): string {
    return (
      this.configService.get<string>('RABBITMQ_URL') ??
      'amqp://guest:guest@localhost:5672/'
    );
  }

  /** EXTRACT_ACTION=1 -> Sync (HTTP call to extract-service), 2 -> Async (publish to RabbitMQ). Defaults to Sync. */
  getExtractAction(): ExtractAction {
    const raw = this.configService.get<string>('EXTRACT_ACTION');
    return raw === String(ExtractAction.Async)
      ? ExtractAction.Async
      : ExtractAction.Sync;
  }

  getCorsOrigins(): string[] {
    const raw = this.configService.get<string>('CORS_ORIGINS');
    return raw
      ? raw.split(',').map((o) => o.trim())
      : ['http://localhost:3000'];
  }
}
