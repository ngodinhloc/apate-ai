import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export const AgentReplySchema = z.object({
  text: z.string(),
  scamProbability: z.number(),
});

export const AGENT_REPLY_SCHEMA = zodOutputFormat(AgentReplySchema).schema;
