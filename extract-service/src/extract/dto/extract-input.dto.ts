import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExtractMessageDto {
  @IsIn(['user', 'agent'])
  sender!: 'user' | 'agent';

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsDate()
  @Type(() => Date)
  timestamp!: Date;
}

export class ExtractConversationInputDto {
  @IsUUID()
  conversationId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractMessageDto)
  messages!: ExtractMessageDto[];

  @IsNumber()
  @Min(0)
  @Max(1)
  scamProbability!: number;

  @IsInt()
  status!: number;

  @IsDate()
  @Type(() => Date)
  createdAt!: Date;

  @IsDate()
  @Type(() => Date)
  modifiedAt!: Date;
}

export class ExtractInputDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractConversationInputDto)
  conversations!: ExtractConversationInputDto[];
}
