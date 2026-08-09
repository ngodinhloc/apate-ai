import { ExtractDataTypeEnum } from '../../extract/contracts/extract.interface';

/** Mirrors the ExtractConversation interface — used as output_config.format's json_schema. */
export const EXTRACT_CONVERSATION_SCHEMA = {
  type: 'object',
  properties: {
    conversationUuid: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dataType: {
            type: 'string',
            enum: Object.values(ExtractDataTypeEnum),
          },
          value: { type: 'string' },
        },
        required: ['dataType', 'value'],
        additionalProperties: false,
      },
    },
  },
  required: ['conversationUuid', 'items'],
  additionalProperties: false,
} as const;
