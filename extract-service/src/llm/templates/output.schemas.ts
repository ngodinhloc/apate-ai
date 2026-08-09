import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ExtractDataTypeEnum } from '../../extract/contracts/extract.interface';

const ExtractItemSchema = z.object({
  dataType: z.enum(ExtractDataTypeEnum),
  value: z.string(),
});

export const ExtractConversationSchema = z.object({
  conversationUuid: z.string(),
  items: z.array(ExtractItemSchema),
});

export const ExtractOutputSchema = z.object({
  conversations: z.array(ExtractConversationSchema),
});

export const EXTRACT_OUTPUT_SCHEMA =
  zodOutputFormat(ExtractOutputSchema).schema;
