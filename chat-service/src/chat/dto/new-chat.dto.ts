import { IsNotEmpty, IsString } from 'class-validator';

export class NewChatDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
