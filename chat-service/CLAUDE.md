# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev   # nest start --watch, http://localhost:8000
npm run build        # nest build
npm run start
npm run lint          # eslint "{src,test}/**/*.ts"
npm run format        # prettier --write "{src,test}/**/*.ts"
npm run test           # jest, runs tests/**/*.spec.ts
npx jest tests/llm/adapters/anthropic.adapter.spec.ts   # single test file
```

Needs Postgres, Redis, and RabbitMQ reachable — set `DATABASE_URL`/`REDIS_URL`/`RABBITMQ_URL` (see `.env.example`), or run `docker compose up --build` from the repo root to start all three plus `extract-service` and `chat-frontend` together.

## Architecture

This is chat-service, the NestJS/TypeORM backend that runs the live chat side of Apate AI, a scam-baiting chatbot. It is one of three services in the monorepo (`chat-frontend`, `chat-service`, `extract-service`) — see the root `README.md` and `SPECS.md` for the system-wide architecture and the `Conversation`/`Message`/`ExtractOutput` wire interfaces, and `src/chat/contracts/chat.interface.ts` for this service's TypeScript source of truth for them.

**Redis holds the live conversation, Postgres holds the record of it.** A conversation in progress lives only in Redis (`ConversationManager`, key `chat:<uuid>`, 2h TTL) as a `LiveConversation` (`Conversation` + `agentStatus`). It is only written to the `conversations` table (schema `chat_service`) once, in `ChatService.end()`. If Redis's copy expires before the frontend calls `end()` (idle tab), `ConversationManager.loadOrResumeLive` falls back to the Postgres row, revives it as `Inprogress`, and re-syncs Postgres so `history()` (which reads only from Postgres) doesn't show it as stuck `Ended`.

**Reply flow** — `ChatController` (`POST /api/chat/`, `POST /api/chat/{uuid}`) → `ChatService.create`/`continueChat` appends the user `Message`, saves to Redis, then `ChatService.reply` calls `AnthropicAdapter.reply` (Claude Haiku, `output_config.format: json_schema` against `AGENT_REPLY_SCHEMA` in `llm/templates/output.schemas.ts`) for a `{ text, scamProbability }` reply, appends it, and flips `agentStatus` to `hasReplied`.

**WebSocket delivery is poll-based, not pushed.** `ChatGateway` (`/ws`) doesn't get notified when a reply lands — on `subscribe`, it polls Redis every 500ms (up to 300s) for the given conversation id and forwards `chat-update` events to that one socket until `agentStatus === hasReplied`, then clears the interval. There's no fan-out registry; each subscription is a self-contained `setInterval` closing over its own `WebSocket` client.

**Ending a conversation** (`POST /api/chat/{uuid}/end`) — `ChatService.end` upserts the final state into Postgres, deletes the Redis key, then hands off to extract-service via `NotifyService`, which branches on `EnvService.getExtractAction()` (`EXTRACT_ACTION=1`→Sync, `2`→Async, default Sync):
- **Sync** — `ExtractClient` fires an unawaited `POST {EXTRACT_SERVICE_URL}/api/extract` and only logs on failure — a dropped call silently loses that conversation's extraction, which is the coupling `README.md` calls out as a known issue.
- **Async** — `EventPublisher` publishes a `ConversationEvent` to the `apate` exchange (constant `EXCHANGE_APATE`, literally `'apapte'` — a typo baked into both services' contracts, must stay byte-identical across `chat-service`/`extract-service` if ever "fixed") under routing key `apate.conversation.ended`. Both branches only ever notify — neither is awaited by the HTTP response.

**RabbitMQService** (`src/rabbitmq/services/rabbitmq.service.ts`) — bounded retry (10 attempts, capped backoff) on initial boot connect so an unreachable broker fails NestJS startup and lets `restart: unless-stopped` cycle the container; unbounded retry on a later dropped connection so a mid-run outage self-heals without a manual restart. `subscribe()` bindings registered before the channel exists are queued and replayed on connect/reconnect — this service only publishes today, but the mechanism is shared with extract-service's consumer.

**Config/logging** — `EnvService`/`AppLogger` follow this codebase's standard `env-module-pattern`/`logger-module-pattern` Claude skills; reach for those skills before hand-rolling either.

**Testing** — only `AnthropicAdapter` has spec coverage (`tests/llm/adapters/anthropic.adapter.spec.ts`), mocking the `@anthropic-ai/sdk` client.
