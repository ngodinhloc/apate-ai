import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ChannelEnum } from '../contracts/chat.interface';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsIn(Object.values(ChannelEnum))
  channel?: ChannelEnum;
}
