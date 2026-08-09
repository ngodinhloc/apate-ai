import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { RedisService } from '../../redis/services/redis.service';
import { AgentStatus, LiveConversation } from '../contracts/chat.interface';

const POLL_INTERVAL_MS = 500;
const MAX_POLLS = 600; // 300 s timeout

@Injectable()
@WebSocketGateway({ path: '/ws' })
export class ChatGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly subscriptions = new Map<WebSocket, NodeJS.Timeout>();

  constructor(private readonly redisService: RedisService) {}

  // Client connects once to the shared /ws endpoint, then sends
  // { event: "subscribe", data: "<conversationId>" }. `client` here is a
  // reference to that specific socket — the interval below closes over it,
  // so pushes only ever go to the subscriber that asked for this conversation.
  @SubscribeMessage('subscribe')
  handleSubscribe(client: WebSocket, conversationId: string): void {
    this.clearSubscription(client);

    let polls = 0;

    const intervalId = setInterval(() => {
      void (async () => {
        if (++polls > MAX_POLLS) {
          this.clearSubscription(client);
          client.send(
            JSON.stringify({
              event: 'error',
              data: 'Timed out waiting for agent.',
            }),
          );
          return;
        }

        try {
          const conversation =
            await this.redisService.getJson<LiveConversation>(
              `chat:${conversationId}`,
            );
          if (!conversation) return;

          client.send(
            JSON.stringify({ event: 'chat-update', data: conversation }),
          );

          if (conversation.agentStatus === AgentStatus.hasReplied) {
            this.clearSubscription(client);
          }
        } catch {
          // Redis transient error — keep polling
        }
      })();
    }, POLL_INTERVAL_MS);

    this.subscriptions.set(client, intervalId);
  }

  handleDisconnect(client: WebSocket): void {
    this.clearSubscription(client);
  }

  private clearSubscription(client: WebSocket): void {
    const existing = this.subscriptions.get(client);
    if (existing) {
      clearInterval(existing);
      this.subscriptions.delete(client);
    }
  }
}
