import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    return this.configService.get<string>('DB_SCHEMA') ?? 'extract_service';
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

  getCorsOrigins(): string[] {
    const raw = this.configService.get<string>('CORS_ORIGINS');
    return raw
      ? raw.split(',').map((o) => o.trim())
      : ['http://localhost:8000'];
  }
}
