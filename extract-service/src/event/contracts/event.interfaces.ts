export interface EventHandler {
  handle(payload: Record<string, unknown>): Promise<void>;
}
