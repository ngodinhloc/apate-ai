import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { ExtractController } from './controllers/extract.controller';
import { ExtractService } from './services/extract.service';
import { CronService } from './services/cron.service';
import { ObjectFactory } from './services/object.factory';

@Module({
  imports: [DatabaseModule, LlmModule],
  controllers: [ExtractController],
  providers: [ExtractService, CronService, ObjectFactory],
  exports: [ExtractService],
})
export class ExtractModule {}
