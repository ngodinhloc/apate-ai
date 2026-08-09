import { Module } from '@nestjs/common';
import { ExtractClient } from './services/extract.client';

@Module({
  providers: [ExtractClient],
  exports: [ExtractClient],
})
export class ExtractModule {}
