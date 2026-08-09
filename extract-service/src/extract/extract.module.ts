import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AnthropicModule } from '../anthropic/anthropic.module';
import { ExtractController } from './controllers/extract.controller';
import { ExtractService } from './services/extract.service';
import { ExtractCronService } from './services/extract-cron.service';

@Module({
  imports: [DatabaseModule, AnthropicModule],
  controllers: [ExtractController],
  providers: [ExtractService, ExtractCronService],
  exports: [ExtractService],
})
export class ExtractModule {}
