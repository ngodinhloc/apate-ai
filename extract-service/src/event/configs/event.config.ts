import { EventHandler } from '../contracts/event.interfaces';
import { EVENT_CONVERSATION_ENDED } from '../../extract/contracts/extract.interface';
import { ConversationEndedHandler } from '../handlers/conversation-ended.handler';

export const EVENT_REGISTRY = 'EVENT_REGISTRY';

export function createEventRegistry(
  conversationEndedHandler: ConversationEndedHandler,
): Record<string, EventHandler> {
  return {
    [EVENT_CONVERSATION_ENDED]: conversationEndedHandler,
  };
}
