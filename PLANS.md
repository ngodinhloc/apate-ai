# Plan: Apate AI

## Overview

Build a scam-detection chatbot system. A user forwards/pastes scammer messages into a chat interface; a chat-service persona calls Claude directly (no separate agent microservice — this is simpler than `../architect-multi-agent`, which needs a LangGraph agent because it runs a multi-step review loop) to play along with the scammer, stalling and steering the conversation toward disclosing identifying information (bank details, PayID, email, phone). When the user ends the conversation, chat-service persists it and hands it to extract-service, which runs a second, independent Claude call to pull out structured intelligence items with format validation, storing each in a dedicated `extractions` table.

Three services, following the same NestJS/Next.js conventions as `../architect-multi-agent`, but without RabbitMQ or a Python agent — both LLM calls happen inline in NestJS via `@anthropic-ai/sdk`, since neither is a multi-step reviewed pipeline.

---

## Project structure

```
apate-ai/
├── docker-compose.yml
├── chat-frontend/         Next.js 16 / React 19 / Tailwind CSS 4
├── chat-service/           NestJS 11, TypeORM, Redis, Anthropic SDK
└── extract-service/        NestJS 11, TypeORM (same PostgreSQL, different schema), Anthropic SDK
```

No RabbitMQ, no MCP server, no Python agent — `chat-service` calls Claude in-process for the persona reply, and calls `extract-service` over plain HTTP when a conversation ends. `extract-service` calls Claude in-process for structured extraction.

---

## 1. docker-compose.yml

Five services (Postgres, Redis, three apps), health-checked, one shared Postgres instance across two schemas:

| Service | Port | Depends on |
|---------|------|-----------|
| postgres | 5432 | — |
| redis | internal | — |
| chat-service | 8000 | postgres, redis |
| extract-service | 8001 | postgres |
| chat-frontend | 3000 | chat-service |

Key environment wiring:
- `chat-service` → `DATABASE_URL=postgresql://apate:apate@postgres:5432/apate?schema=chat_service`, `REDIS_URL=redis://redis:6379`, `EXTRACT_SERVICE_URL=http://extract-service:8000`, `ANTHROPIC_API_KEY` (from `chat-service/.env`)
- `extract-service` → `DATABASE_URL=postgresql://apate:apate@postgres:5432/apate?schema=extract_service`, `ANTHROPIC_API_KEY` (from `extract-service/.env`)
- `chat-frontend` → `API_TARGET=http://chat-service:8000`, `NEXT_PUBLIC_WS_URL=ws://localhost:8000`

Both NestJS services connect to the **same** `apate` database (`POSTGRES_DB=apate`) but each owns its own Postgres **schema** (`chat_service`, `extract_service`) — matches SPECS.md's "same PostgreSQL, different schema" note. `synchronize: true`, no migration files (same as `../architect-multi-agent`).

---

## 2. Chat Service (NestJS 11)

Owns conversation state, plays the scam-baiter persona via Claude, and hands off to extract-service when a conversation ends.

### Module layout

```
src/
  main.ts                                 Bootstrap, CORS, WsAdapter, ValidationPipe
  app.module.ts
  chat/
    chat.module.ts
    contracts/
      chat.interface.ts                   Message, Conversation, ChatMessage, ChatEnd, StatusEnum
      live-conversation.interface.ts       LiveConversation = Conversation & { agentStatus }
    controllers/
      chat.controller.ts                  REST endpoints under /api/chat
    services/
      chat.service.ts                     Core logic — Postgres + Redis reads/writes, drives Claude
    dto/
      chat-message.dto.ts                 { conversationId: string, text: string }
      chat-end.dto.ts                     { conversationId: string }
    gateways/
      chat.gateway.ts                     WebSocket at /ws — polls Redis at 500 ms
  database/
    database.module.ts                    TypeORM root config, schema: 'chat_service'
    entities/
      conversation.entity.ts              id, uuid, title, messages (jsonb), status, timestamps
  redis/
    redis.module.ts                       @Global()
    services/
      redis.service.ts                    getJson<T> / setJson / del
  anthropic/
    anthropic.module.ts
    services/
      chat-agent.service.ts               Wraps @anthropic-ai/sdk — persona system prompt + reply()
  extract/
    extract.module.ts
    services/
      extract.client.ts                  POST { conversation } to extract-service
  health/
    controllers/health.controller.ts      GET /api/health → { status: 'ok' }
```

### REST API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat/` | Create conversation: title = first ~60 chars of the message, insert row in `conversations` (status `Inprogress`), write live copy to Redis, return `{ uuid }` |
| `POST` | `/api/chat/:uuid` | Accept `ChatMessage`, append as `Message{ sender: "user" }` to the live Redis conversation, call Claude with the full history, append the reply as `Message{ sender: "agent" }`, persist the live copy back to Redis, return the updated `Conversation` |
| `POST` | `/api/chat/:uuid/end` | Load conversation from Redis, upsert into `conversations` (status `Ended`), delete the Redis key, fire `POST /api/extract` on extract-service with the full `Conversation` as payload (fire-and-forget with logging — the user has already left the page) |
| `GET` | `/api/chat/` | List conversations: `{ uuid, title, createdAt }[]` |
| `GET` | `/api/chat/:uuid` | Conversation detail — live from Redis if present, else persisted from PostgreSQL |
| `WS` | `/ws` | Client sends `{ event: "subscribe", data: uuid }`; gateway polls `chat:{uuid}` in Redis every 500 ms and pushes `{ event: "chat-update", data: LiveConversation }` until `agentStatus === "hasReplied"` |
| `GET` | `/api/health` | `{ status: 'ok' }` |

### Data model (canonical — mirrors SPECS.md verbatim)

```typescript
enum StatusEnum { Inprogress = 0, Ended = 1 }

interface Message {
  sender:    "user" | "agent";   // "user" = the scammer's message, "agent" = our bot's reply
  text:      string;
  timestamp: Date;
}

interface Conversation {
  conversationId: string;        // uuid
  messages:       Message[];
  status:         StatusEnum;
  createdAt:      Date;
  modifiedAt:     Date;
}

// Live-only shape held in Redis; never persisted to PostgreSQL
interface LiveConversation extends Conversation {
  agentStatus: "isThinking" | "hasReplied";
}

// Request DTOs
interface ChatMessage { conversationId: string; text: string; }
interface ChatEnd     { conversationId: string; }
```

### `conversations` table (chat_service schema)

```typescript
@Entity('conversations')
class ConversationEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'uuid' }) uuid!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) title!: string | null;
  @Column({ type: 'jsonb', default: '[]' }) messages!: Message[];
  @Column({ type: 'smallint', default: 0 }) status!: StatusEnum;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'modified_at' }) modifiedAt!: Date;
}
```

### Claude integration — the persona

`ChatAgentService` wraps `@anthropic-ai/sdk`. Model: `claude-opus-5`, `output_config: { effort: "medium" }` (balances persona quality against per-message latency in an interactive chat — see the `claude-api` skill's defaults). No structured output needed here — the reply is free text.

**Role mapping:** `Message.sender === "user"` → Anthropic `role: "user"` (the scammer's line), `Message.sender === "agent"` → Anthropic `role: "assistant"` (our bot's prior reply). The full `messages[]` array is replayed on every turn (the API is stateless); no compaction needed at chat-message scale.

**System prompt** (persona, kept in `anthropic/personas/scam-baiter.persona.ts`): instructs Claude to play a plausible, mildly credulous potential victim; string the scammer along with believable follow-up questions; steer naturally toward the scammer volunteering a bank account, PayID, email, or phone number for a "refund" / "verification" / "payment"; stay in character; never break the fourth wall; never send any real personal or financial information (this is a defensive honeypot for scam intelligence gathering, not a real transaction). Flag this system prompt explicitly to the user as the one piece of this plan that most needs their review/tuning before going live — its wording controls both bait quality and safety.

```typescript
class ChatAgentService {
  async reply(history: Message[]): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: SCAM_BAITER_PERSONA,
      output_config: { effort: 'medium' },
      messages: history.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
    });
    const text = response.content.find(b => b.type === 'text');
    return text?.text ?? '';
  }
}
```

Handle `response.stop_reason === "refusal"` (Claude Opus 5 runs safety classifiers) by returning a generic in-character deflection rather than surfacing an error to the scammer-facing UI.

### Redis key convention

`chat:{uuid}` — JSON-serialised `LiveConversation`, TTL 2 hours. Written on create, mutated in place on every `POST /api/chat/:uuid` turn (agentStatus flips `isThinking` → `hasReplied` around the Claude call so the WS gateway has something to poll), deleted on `end`.

### Calling extract-service

`ExtractClient.notify(conversation: Conversation)` — `POST {EXTRACT_SERVICE_URL}/api/extract` with body `{ conversations: [conversation] }` (see extract-service's `ExtractInput` shape below — the array wrapper matches its schema even though chat-service always sends exactly one). Called from `ChatService.end()`, not awaited by the client-facing response — log failures, don't fail the `end` request over them.

### Environment

```
PORT=8000
DATABASE_URL=postgresql://apate:apate@localhost:5432/apate?schema=chat_service
REDIS_URL=redis://localhost:6379
EXTRACT_SERVICE_URL=http://localhost:8001
ANTHROPIC_API_KEY=
CORS_ORIGINS=http://localhost:3000
```

---

## 3. Extract Service (NestJS 11)

Standalone NestJS service. Same PostgreSQL instance as chat-service, `extract_service` schema. No Redis, no WebSocket — a single synchronous REST endpoint.

### Module layout

```
src/
  main.ts
  app.module.ts
  extract/
    extract.module.ts
    contracts/
      extract.interface.ts                ExtractDataTypeEnum, ExtractOutput, ExtractConversation,
                                           ExtractItem, ExtractStatusEnum, ExtractInput
    controllers/
      extract.controller.ts               POST /api/extract
    services/
      extract.service.ts                  Calls Claude, upserts into extractions
    dto/
      extract-input.dto.ts                { conversations: ConversationDto[] }
  anthropic/
    anthropic.module.ts
    services/
      extraction-agent.service.ts         Structured-output extraction call
    schemas/
      extract-output.schema.ts            JSON schema mirroring ExtractOutput
    personas/
      extractor.persona.ts                Per-ExtractDataTypeEnum instructions + format rules
  database/
    database.module.ts                    TypeORM root config, schema: 'extract_service'
    entities/
      conversation.entity.ts              Mirrors chat-service's persisted shape (own copy, own schema)
      extraction.entity.ts                 conversation_uuid, data_type, value, created_at
  health/
    controllers/health.controller.ts
```

### Data model (canonical — mirrors SPECS.md verbatim)

```typescript
enum ExtractDataTypeEnum {
  NAME           = "name",
  EMAIL          = "email",
  PHONE          = "phone",
  ADDRESS        = "address",
  BANK_ACCOUNT_AU = "bank_account_au",
  BANK_ACCOUNT_UK = "bank_account_uk",
  PAYID          = "pay_id",
}

enum ExtractStatusEnum { NEW = 0, PROCESSED = 1 }

interface ExtractItem       { dataType: ExtractDataTypeEnum; value: string; }
interface ExtractConversation { conversationUuid: string; items: ExtractItem[]; }
interface ExtractOutput      { conversations: ExtractConversation[]; }
interface ExtractInput       { conversations: Conversation[]; }   // request payload from chat-service
```

**Format validation** (enforced both in the extraction prompt and re-checked server-side before insert — never trust the model's output for a value shape that gates a unique index):

| `dataType` | Format |
|---|---|
| `bank_account_au` | BSB `NNN-NNN` + account `NNNNNNNN` |
| `bank_account_uk` | sort code `NN-NN-NN` + account `NNNNNNNN` |
| `pay_id` | email / phone / ABN |

### REST API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/extract` | Body: `ExtractInput`. For each `Conversation`, call Claude with structured output to produce one `ExtractConversation`; validate each item's format server-side; upsert into `extractions` on `(conversation_uuid, data_type, value)`; return the resulting `ExtractOutput` |
| `GET` | `/api/health` | `{ status: 'ok' }` |

### Tables (extract_service schema)

```typescript
@Entity('conversations')
class ConversationEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'uuid' }) uuid!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) title!: string | null;
  @Column({ type: 'jsonb', default: '[]' }) messages!: Message[];
  @Column({ type: 'smallint', default: 0 }) status!: ExtractStatusEnum;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'modified_at' }) modifiedAt!: Date;
}

@Entity('extractions')
@Unique(['conversationUuid', 'dataType', 'value'])
class Extraction {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'conversation_uuid', type: 'uuid' }) conversationUuid!: string;
  @Column({ name: 'data_type', type: 'varchar' }) dataType!: ExtractDataTypeEnum;
  @Column({ type: 'varchar' }) value!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
```

`extract.service.ts` upserts with `ON CONFLICT (conversation_uuid, data_type, value) DO NOTHING` (TypeORM `.upsert()` with the composite unique constraint) — re-processing the same conversation is idempotent.

### Claude integration — structured extraction

`ExtractionAgentService` uses `output_config.format` (structured outputs), **not** a hand-rolled JSON prompt — this guarantees schema-valid output instead of a parse-and-retry loop. Model: `claude-opus-5`, `output_config: { effort: "low" }` — extraction is a bounded classification/extraction task, not open-ended reasoning, so low effort is the right default (see the `claude-api` skill's effort guidance); raise to `medium` if recall on adversarial/obfuscated scammer text proves insufficient.

**System prompt** contains, for every `ExtractDataTypeEnum` value, what counts as a match and its exact format-validation rule (the AU/UK bank account and PayID rules above) so the model self-filters before the response is even generated — one call per conversation, not per data type.

```typescript
class ExtractionAgentService {
  async extract(conversation: Conversation): Promise<ExtractConversation> {
    const response = await this.client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      system: EXTRACTOR_PERSONA,        // instructions + format rules per ExtractDataTypeEnum
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: EXTRACT_CONVERSATION_SCHEMA },
      },
      messages: [{
        role: 'user',
        content: JSON.stringify({ conversationUuid: conversation.conversationId, messages: conversation.messages }),
      }],
    });
    const text = response.content.find(b => b.type === 'text');
    return JSON.parse(text!.text) as ExtractConversation;   // output_config.format guarantees valid JSON
  }
}
```

`EXTRACT_CONVERSATION_SCHEMA` mirrors the `ExtractConversation` TypeScript interface (`conversationUuid: string`, `items: { dataType: enum, value: string }[]`), with `additionalProperties: false` and `dataType` constrained via `enum` to the `ExtractDataTypeEnum` values.

### Environment

```
PORT=8000
DATABASE_URL=postgresql://apate:apate@localhost:5432/apate?schema=extract_service
ANTHROPIC_API_KEY=
CORS_ORIGINS=http://localhost:8000
```

---

## 4. Chat Frontend (Next.js 16 / React 19 / Tailwind CSS 4)

Very similar to `../architect-multi-agent/frontend` — same WebSocket-poll UX, same file layout, different domain types.

### Component architecture

```
src/
  app/
    layout.tsx          Root layout — Sidebar + main area
    page.tsx             Renders <ScamChat> in a Suspense boundary
    globals.css
  components/
    ScamChat.tsx         Main chat component — POST to create/continue, WebSocket for live updates
    MessageBubble.tsx     Renders a single Message, styled by sender ("user" = scammer, "agent" = bot)
    LoadingSkeleton.tsx   Shown while agentStatus === "isThinking"
    Sidebar.tsx           Expandable left menu — New Chat button + chat history list
  lib/
    api.ts               newChat, continueChat, endChat, getChat, getHistory
  types/
    chat.ts              TypeScript interfaces mirroring chat-service's contracts (Message, Conversation, …)
```

### Key flows

**New chat**
1. Sidebar "New Chat" → navigates to a new chat page
2. First message submit → `newChat(text)` → `POST /api/chat/` → `{ uuid }`
3. Open `WebSocket` at `NEXT_PUBLIC_WS_URL/ws`, send `{ event: "subscribe", data: uuid }`
4. `continueChat(uuid, text)` → `POST /api/chat/:uuid` — response already carries the updated `Conversation`; the WebSocket subscription is what lets `LoadingSkeleton` show while `agentStatus === "isThinking"` and clears on `"hasReplied"`

**Chat history**
- Sidebar loads `GET /api/chat/history` (list) on mount
- Selecting a past conversation loads `GET /api/chat/history/:uuid` (detail) — read-only view; no reconnect to Claude for ended conversations

**Ending a chat**
- On unmount / navigate-away from an in-progress chat page, fire `POST /api/chat/:uuid/end` (`navigator.sendBeacon` or a `beforeunload` handler) so the conversation is persisted and handed to extract-service even if the user just closes the tab

### Environment

```
NODE_ENV=development
API_TARGET=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

All REST calls use relative `/api/` paths (proxied by Next.js `rewrites()` to `API_TARGET`), same convention as `../architect-multi-agent/frontend`.

---

## Verification checklist

1. `cp chat-service/.env.example chat-service/.env` and `cp extract-service/.env.example extract-service/.env` — set `ANTHROPIC_API_KEY` in both
2. `docker compose up --build` — postgres, redis, chat-service, extract-service, chat-frontend all start healthy
3. Open `http://localhost:3000`, click "New Chat", paste a sample scam opener (e.g. "Hi, this is your bank, we detected suspicious activity on your account")
4. Confirm the bot replies in character and asks a plausible follow-up rather than breaking the fourth wall
5. Continue the conversation until the (simulated) scammer volunteers a BSB/account number or email
6. Navigate away from the chat (triggering `end`) — confirm a row appears in chat-service's `conversations` table with `status = Ended`
7. `GET http://localhost:8001/api/health` — confirm extract-service received the `POST /api/extract` call (check logs) and confirm rows in extract-service's `extractions` table match the bank/PayID details from the transcript
8. Re-trigger `end` for the same conversation (idempotency check) — confirm no duplicate rows in `extractions` (unique index holds)
9. `GET http://localhost:8000/api/chat/history` — confirm the conversation appears with a sensible auto-generated title
