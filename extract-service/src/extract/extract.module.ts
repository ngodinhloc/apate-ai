import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { ExtractController } from './controllers/extract.controller';
import { ExtractService } from './services/extract.service';
import { CronService } from './services/cron.service';
import { ObjectValidator } from './services/object.validator';

@Module({
  imports: [DatabaseModule, LlmModule],
  controllers: [ExtractController],
  providers: [ExtractService, CronService, ObjectValidator],
  exports: [ExtractService],
})
export class ExtractModule {}
