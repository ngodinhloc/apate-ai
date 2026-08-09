import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ExtractService } from '../services/extract.service';
import { ExtractInputDto } from '../dto/extract-input.dto';

@Controller('api/extract')
export class ExtractController {
  constructor(private readonly extractService: ExtractService) {}

  @Post()
  process(@Body() dto: ExtractInputDto) {
    return this.extractService.extractAll(dto);
  }

  @Get(':uuid')
  getExtractions(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.extractService.getExtractions(uuid);
  }
}
