import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { ChatMessageDto } from '../dto/chat-message.dto';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  create(@Body() dto: ChatMessageDto) {
    return this.chatService.create(dto.text);
  }

  @Post(':uuid')
  continueChat(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: ChatMessageDto,
  ) {
    return this.chatService.continueChat(uuid, dto.text);
  }

  @Post(':uuid/end')
  async end(@Param('uuid', ParseUUIDPipe) uuid: string) {
    await this.chatService.end(uuid);
    return { ended: true };
  }

  @Get()
  history() {
    return this.chatService.history();
  }

  @Get(':uuid')
  detail(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.chatService.detail(uuid);
  }
}
